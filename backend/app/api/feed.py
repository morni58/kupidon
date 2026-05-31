from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json

from app.core.deps import get_db, get_current_user
from app.core.redis import get_redis
from app.models.user import User
from app.models.tag import AdminTag, UserTag
from app.services.matching import get_feed, handle_swipe
from app.schemas.feed import FeedCard, SwipeRequest, SwipeResponse, TagOut
from sqlalchemy import select

router = APIRouter(prefix="/api", tags=["feed"])

FEED_CACHE_TTL = 300  # 5 min


@router.get("/feed", response_model=List[FeedCard])
async def feed(
    verified_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    redis = await get_redis()
    cache_key = f"feed:{me.id}:{verified_only}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    candidates = await get_feed(db, me, verified_only=verified_only)

    cards = []
    for c in candidates:
        # Load tags
        tag_r = await db.execute(
            select(AdminTag).join(UserTag, AdminTag.id == UserTag.tag_id).where(UserTag.user_id == c.id)
        )
        tags = tag_r.scalars().all()

        # Load media
        media_r = await db.execute(
            select(__import__("app.models.media", fromlist=["MediaSlot"]).MediaSlot)
            .where(__import__("app.models.media", fromlist=["MediaSlot"]).MediaSlot.user_id == c.id)
            .order_by(__import__("app.models.media", fromlist=["MediaSlot"]).MediaSlot.slot_index)
        )
        media_slots = media_r.scalars().all()

        # Common tags
        my_tags_r = await db.execute(select(UserTag.tag_id).where(UserTag.user_id == me.id))
        my_tag_ids = {r[0] for r in my_tags_r.all()}
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
            lat=c.lat,
            lng=c.lng,
            tags=[TagOut.model_validate(t) for t in tags],
            media=[m.media_url for m in media_slots if m.media_url],
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
    await redis.delete(f"feed:{me.id}:False")
    await redis.delete(f"feed:{me.id}:True")

    # Send notifications
    if result["is_match"]:
        target_r = await db.execute(select(User).where(User.id == body.target_id))
        target = target_r.scalar_one_or_none()
        if target:
            from app.services.notifications import notify_match
            import asyncio
            asyncio.create_task(notify_match(target.tg_id, me.name))

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
    await redis.delete(f"feed:{me.id}:False")
    await redis.delete(f"feed:{me.id}:True")

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
        photo = ph_r.scalar_one_or_none()
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
    from app.services.economy import get_config_value
    from sqlalchemy import or_

    if me.tier == "free":
        raise HTTPException(status_code=402, detail="force_chat_requires_premium")

    max_fc = int(await get_config_value(db, f"{me.tier}_force_chats", "3"))
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
    me.force_chats_used += 1
    await db.commit()
    await db.refresh(match)
    return {"match_id": str(match.id)}
