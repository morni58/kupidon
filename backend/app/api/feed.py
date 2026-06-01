from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json

from app.core.deps import get_db, get_current_user
from app.core.redis import get_redis
from app.core.media import to_public_url
from app.models.user import User
from app.models.tag import AdminTag, UserTag
from app.models.media import MediaSlot
from app.models.city import City
from app.services.matching import get_feed, handle_swipe
from app.schemas.feed import FeedCard, SwipeRequest, SwipeResponse, TagOut
from sqlalchemy import select

router = APIRouter(prefix="/api", tags=["feed"])

FEED_CACHE_TTL = 300  # 5 min


async def _invalidate_feed(redis, user_id) -> None:
    """Drop all cached feed variants (verified/tags combos) for a user."""
    try:
        async for key in redis.scan_iter(match=f"feed:{user_id}:*"):
            await redis.delete(key)
    except Exception:
        pass


def _distance_label(me: User, c: User) -> Optional[str]:
    """Human-readable approximate distance for a feed card (L11)."""
    import math
    if None in (me.lat, me.lng, c.lat, c.lng):
        return None
    dx = (float(me.lat) - float(c.lat)) * 111000
    dy = (float(me.lng) - float(c.lng)) * 111000 * math.cos(math.radians(float(me.lat)))
    km = math.sqrt(dx ** 2 + dy ** 2) / 1000
    if km < 1:
        return "меньше 1 км"
    if km < 100:
        return f"{round(km)} км"
    return f"{round(km / 10) * 10} км"


@router.get("/feed", response_model=List[FeedCard])
async def feed(
    verified_only: bool = Query(False),
    tags: Optional[str] = Query(None, description="comma-separated tag ids to filter by"),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    tag_ids = None
    if tags:
        try:
            tag_ids = [int(x) for x in tags.split(",") if x.strip()]
        except ValueError:
            tag_ids = None

    redis = await get_redis()
    cache_key = f"feed:{me.id}:{verified_only}:{tags or ''}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    candidates = await get_feed(db, me, verified_only=verified_only, tag_ids=tag_ids)

    # My tags — once, not per candidate (P1)
    my_tags_r = await db.execute(select(UserTag.tag_id).where(UserTag.user_id == me.id))
    my_tag_ids = {r[0] for r in my_tags_r.all()}

    # City name cache to avoid repeated lookups (L11)
    city_names: dict[int, Optional[str]] = {}

    async def city_name_for(city_id: Optional[int]) -> Optional[str]:
        if not city_id:
            return None
        if city_id not in city_names:
            cr = await db.execute(select(City.name).where(City.id == city_id))
            city_names[city_id] = cr.scalar_one_or_none()
        return city_names[city_id]

    cards = []
    for c in candidates:
        tag_r = await db.execute(
            select(AdminTag).join(UserTag, AdminTag.id == UserTag.tag_id).where(UserTag.user_id == c.id)
        )
        tags = tag_r.scalars().all()

        media_r = await db.execute(
            select(MediaSlot).where(MediaSlot.user_id == c.id).order_by(MediaSlot.slot_index)
        )
        media_slots = media_r.scalars().all()

        c_tag_ids = {t.id for t in tags}

        card = FeedCard(
            id=c.id,
            name=c.name,
            birth_date=c.birth_date,
            gender=c.gender,
            bio=c.bio,
            profile_score=c.profile_score,
            is_verified=c.is_verified,
            tier=c.tier,
            city_id=c.city_id,
            city_name=await city_name_for(c.city_id),
            dist=_distance_label(me, c),
            lat=c.lat,
            lng=c.lng,
            tags=[TagOut.model_validate(t) for t in tags],
            media=[to_public_url(m.media_url) for m in media_slots if m.media_url],
            common_tags_count=len(my_tag_ids & c_tag_ids),
        )
        cards.append(card.model_dump(mode="json"))

    await redis.setex(cache_key, FEED_CACHE_TTL, json.dumps(cards))
    return cards


@router.post("/swipe", response_model=SwipeResponse)
async def swipe(
    body: SwipeRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from app.models.swipe import ActionTypeEnum

    if body.action_type not in ("left", "right", "superlike"):
        raise HTTPException(status_code=422, detail="Invalid action_type")

    result = await handle_swipe(db, me, body.target_id, body.action_type, body.vip_message)

    if "error" in result:
        codes = {"swipe_limit": 429, "superlike_limit": 402, "vip_cap": 429}
        raise HTTPException(status_code=codes.get(result["error"], 400), detail=result["error"])

    # Invalidate feed cache
    redis = await get_redis()
    await _invalidate_feed(redis, me.id)

    # Send notifications (L9/L10)
    import asyncio
    target_r = await db.execute(select(User).where(User.id == body.target_id))
    target = target_r.scalar_one_or_none()
    if target and not me.is_shadowbanned:
        from app.services import notifications as notif
        if result["is_match"]:
            # Notify both sides of the match.
            asyncio.create_task(notif.notify_match(target.tg_id, me.name))
            asyncio.create_task(notif.notify_match(me.tg_id, target.name))
        elif body.action_type in ("right", "superlike"):
            if me.is_oligarch_mode and not target.is_anti_oligarch:
                asyncio.create_task(notif.notify_vip_like(target.tg_id, body.vip_message))
            elif body.action_type == "superlike":
                asyncio.create_task(notif.notify_superlike(target.tg_id))

    return SwipeResponse(is_match=result["is_match"], match_id=result.get("match_id"))


@router.post("/rewind")
async def rewind(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Premium/Kupidon only: undo the last 'left' swipe within 24h."""
    from fastapi import HTTPException
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import delete as sa_delete
    from app.models.swipe import Swipe

    if me.tier.value == "free":
        raise HTTPException(status_code=403, detail="rewind_requires_premium")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    last_r = await db.execute(
        select(Swipe)
        .where(
            Swipe.actor_id == me.id,
            Swipe.action_type == "left",
            Swipe.created_at >= cutoff,
        )
        .order_by(Swipe.created_at.desc())
        .limit(1)
    )
    last = last_r.scalar_one_or_none()
    if not last:
        raise HTTPException(status_code=404, detail="nothing_to_rewind")

    target_id = last.target_id
    await db.execute(sa_delete(Swipe).where(Swipe.id == last.id))
    me.swipes_left += 1
    await db.commit()

    # Invalidate feed cache so the card comes back
    redis = await get_redis()
    await _invalidate_feed(redis, me.id)

    return {"ok": True, "restored_target_id": str(target_id)}


@router.get("/sympathies")
async def sympathies(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Users who liked me without existing match."""
    from app.models.swipe import Swipe, ActionTypeEnum
    from app.models.match import Match
    from sqlalchemy import or_

    # Find who liked me
    liked_me_r = await db.execute(
        select(Swipe).where(
            Swipe.target_id == me.id,
            Swipe.action_type.in_(["right", "superlike"]),
        )
    )
    liked_me = liked_me_r.scalars().all()

    # Get existing matches
    matches_r = await db.execute(
        select(Match).where(
            or_(Match.user1_id == me.id, Match.user2_id == me.id)
        )
    )
    matched_ids = set()
    for m in matches_r.scalars().all():
        matched_ids.add(m.user1_id)
        matched_ids.add(m.user2_id)
    matched_ids.discard(me.id)

    result = []
    for swipe in liked_me:
        if swipe.actor_id in matched_ids:
            continue
        actor_r = await db.execute(select(User).where(User.id == swipe.actor_id))
        actor = actor_r.scalar_one_or_none()
        if not actor or actor.is_banned or actor.is_shadowbanned:
            continue

        vip_info = None
        if swipe.is_vip_like:
            vip_info = {"is_vip": True, "message": swipe.vip_message}

        from app.models.media import MediaSlot
        from app.models.user import GenderEnum
        ph_r = await db.execute(
            select(MediaSlot.media_url).where(MediaSlot.user_id == actor.id)
            .order_by(MediaSlot.slot_index).limit(1)
        )
        photo = to_public_url(ph_r.scalar_one_or_none())
        age = None
        if actor.birth_date:
            from datetime import date
            t = date.today()
            age = t.year - actor.birth_date.year - ((t.month, t.day) < (actor.birth_date.month, actor.birth_date.day))

        result.append({
            "user_id": str(actor.id),
            "name": actor.name,
            "age": age,
            "is_verified": actor.is_verified,
            "is_vip": swipe.is_vip_like,
            "vip_info": vip_info,
            "photo": photo,
            "media": [photo] if photo else [],
            "liked_at": swipe.created_at.isoformat(),
        })

    return result


@router.post("/force_chat")
async def force_chat(
    body: __import__("app.schemas.feed", fromlist=["ForceChatRequest"]).ForceChatRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from app.models.match import Match
    from app.models.user import TierEnum
    from app.services.economy import get_config_value
    from app.services.tickets import consume_force_chat_ticket
    from sqlalchemy import or_

    used_ticket = False
    if me.tier == TierEnum.free:
        # Free users need a paid ticket (C2). Consume one or 402.
        if not await consume_force_chat_ticket(me.id):
            raise HTTPException(status_code=402, detail="force_chat_requires_payment")
        used_ticket = True
    else:
        # Daily limit from config; use enum .value to build the key (C6).
        max_fc = int(await get_config_value(db, f"{me.tier.value}_force_chats", "3"))
        if me.force_chats_used >= max_fc:
            raise HTTPException(status_code=429, detail="force_chat_limit")

    # Check existing match
    existing_r = await db.execute(
        select(Match).where(
            or_(
                (Match.user1_id == me.id) & (Match.user2_id == body.target_id),
                (Match.user1_id == body.target_id) & (Match.user2_id == me.id),
            )
        )
    )
    if existing_r.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Match already exists")

    target_r = await db.execute(select(User).where(User.id == body.target_id))
    target = target_r.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    match = Match(
        user1_id=me.id,
        user2_id=body.target_id,
        is_force_chat=True,
        is_18_room=(me.is_18_mode_active and target.is_18_mode_active),
    )
    db.add(match)
    if not used_ticket:
        me.force_chats_used += 1
    await db.commit()
    await db.refresh(match)
    return {"match_id": str(match.id)}


@router.post("/buy_golden_contact")
async def buy_golden_contact(
    body: __import__("app.schemas.feed", fromlist=["ForceChatRequest"]).ForceChatRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Golden Key (F1): a Kupidon/oligarch buys a direct contact for Stars.
    Creates a match with Telegram already unlocked for both sides."""
    from fastapi import HTTPException
    from app.models.match import Match
    from app.models.user import TierEnum
    from app.services.economy import get_config_value
    from sqlalchemy import or_

    if me.tier != TierEnum.kupidon:
        raise HTTPException(status_code=403, detail="golden_key_requires_kupidon")

    cost = int(await get_config_value(db, "golden_key_stars", "1000"))
    if me.stars_balance < cost:
        raise HTTPException(status_code=402, detail="not_enough_stars")

    target_r = await db.execute(select(User).where(User.id == body.target_id))
    target = target_r.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == me.id:
        raise HTTPException(status_code=400, detail="cannot_target_self")

    existing_r = await db.execute(
        select(Match).where(
            or_(
                (Match.user1_id == me.id) & (Match.user2_id == target.id),
                (Match.user1_id == target.id) & (Match.user2_id == me.id),
            )
        )
    )
    match = existing_r.scalar_one_or_none()
    me.stars_balance -= cost
    if match:
        match.tg_unlocked_user1 = True
        match.tg_unlocked_user2 = True
    else:
        match = Match(
            user1_id=me.id, user2_id=target.id,
            is_oligarch_reveal=True,
            tg_unlocked_user1=True, tg_unlocked_user2=True,
        )
        db.add(match)
    await db.commit()
    await db.refresh(match)

    import asyncio
    from app.services import notifications as notif
    asyncio.create_task(notif.send_push(
        target.tg_id,
        "🗝️ Влиятельный VIP-пользователь выкупил твой контакт за Stars! Загляни в чаты.",
    ))

    link = f"https://t.me/{target.username}" if target.username else None
    return {"match_id": str(match.id), "username": target.username, "link": link}
