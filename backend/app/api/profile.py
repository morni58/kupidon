from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import OnboardingCreate, UserPublic, UserUpdate

router = APIRouter(prefix="/api", tags=["profile"])


async def recalc_profile_score(db: AsyncSession, user: User) -> int:
    """Single source of truth for profile score (0..100)."""
    from app.models.media import MediaSlot, MediaTypeEnum
    from app.models.tag import UserTag

    score = 0
    # Media
    media_r = await db.execute(select(MediaSlot).where(MediaSlot.user_id == user.id))
    media = media_r.scalars().all()
    photos = [m for m in media if m.media_type == MediaTypeEnum.photo]
    has_video = any(m.media_type == MediaTypeEnum.video for m in media)
    if photos:
        score += 20  # first photo
        score += min(len(photos) - 1, 3) * 10  # up to 3 extra photos
    if has_video:
        score += 15
    # Bio
    if user.bio:
        score += 10
    # Tags >= 3
    tags_r = await db.execute(select(UserTag).where(UserTag.user_id == user.id))
    if len(tags_r.scalars().all()) >= 3:
        score += 10
    # Verified
    if user.is_verified:
        score += 15
    return min(score, 100)


@router.post("/onboarding", response_model=UserPublic)
async def onboarding(
    body: OnboardingCreate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.birth_date:
        raise HTTPException(status_code=400, detail="Already onboarded")

    from app.core.agehelp import calc_age
    from app.services.economy import get_config_value
    min_age = int(await get_config_value(db, "min_reg_age", "16"))
    if (calc_age(body.birth_date) or 0) < min_age:
        raise HTTPException(status_code=422, detail=f"Must be {min_age}+")

    me.name = body.name
    me.birth_date = body.birth_date
    me.gender = body.gender
    me.search_gender = body.search_gender
    me.bio = body.bio

    # Validate bio
    from app.services.moderation import moderate_text
    if body.bio:
        clean = moderate_text(body.bio)
        if clean is None:
            raise HTTPException(status_code=422, detail="Bio contains forbidden content")
        me.bio = clean

    me.profile_score = await recalc_profile_score(db, me)
    await db.commit()
    await db.refresh(me)
    return me


@router.get("/profile/me", response_model=UserPublic)
async def get_my_profile(me: User = Depends(get_current_user)):
    return me


@router.get("/profile/full")
async def get_my_profile_full(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Enriched profile: base fields + media urls + tag ids + city name."""
    from app.models.media import MediaSlot
    from app.models.tag import UserTag
    from app.models.city import City

    from app.core.media import to_public_url
    media_r = await db.execute(
        select(MediaSlot.media_url).where(MediaSlot.user_id == me.id).order_by(MediaSlot.slot_index)
    )
    media = [to_public_url(u) for u in media_r.scalars().all() if u]

    tags_r = await db.execute(select(UserTag.tag_id).where(UserTag.user_id == me.id))
    tag_ids = [t[0] for t in tags_r.all()]

    city_name = None
    if me.city_id:
        c_r = await db.execute(select(City.name).where(City.id == me.city_id))
        city_name = c_r.scalar_one_or_none()

    return {
        "id": str(me.id), "name": me.name, "birth_date": me.birth_date.isoformat() if me.birth_date else None,
        "gender": me.gender.value if me.gender else None,
        "search_gender": me.search_gender.value if me.search_gender else None,
        "bio": me.bio, "profile_score": me.profile_score, "trust_score": me.trust_score,
        "tier": me.tier.value, "tier_until": me.tier_until.isoformat() if me.tier_until else None,
        "swipes_left": me.swipes_left, "superlikes_left": me.superlikes_left,
        "force_chats_used": me.force_chats_used, "vip_signals_used": me.vip_signals_used,
        "is_verified": me.is_verified, "is_18_mode_active": me.is_18_mode_active,
        "is_oligarch_mode": me.is_oligarch_mode, "is_anti_oligarch": me.is_anti_oligarch,
        "is_stealth_mode": me.is_stealth_mode, "streak_days": me.streak_days,
        "city_name": city_name, "media": media, "tag_ids": tag_ids,
        "anthem_url": me.anthem_url, "anthem_title": me.anthem_title, "anthem_start": me.anthem_start,
        "prompts": me.prompts or {},
    }


# NOTE: this dynamic route is declared AFTER /profile/me and /profile/full so it
# never swallows those static paths (FastAPI matches in declaration order).
@router.get("/profile/{user_id}")
async def get_public_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Read-only public profile of another user (opened from a feed card/chat)."""
    import uuid as _uuid
    from app.models.media import MediaSlot
    from app.models.tag import UserTag
    from app.models.city import City
    from app.models.safety import Block
    from sqlalchemy import or_, and_

    if user_id in ("me", "full"):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        uid = _uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    if uid == me.id:
        raise HTTPException(status_code=400, detail="self")

    r = await db.execute(select(User).where(User.id == uid))
    u = r.scalar_one_or_none()
    if not u or u.is_banned or u.is_deleted:
        raise HTTPException(status_code=404, detail="Профиль недоступен")

    blk = await db.execute(select(Block).where(or_(
        and_(Block.blocker_id == me.id, Block.blocked_id == uid),
        and_(Block.blocker_id == uid, Block.blocked_id == me.id),
    )))
    if blk.first():
        raise HTTPException(status_code=403, detail="Недоступно")

    from app.core.media import to_public_url
    media_r = await db.execute(select(MediaSlot.media_url).where(MediaSlot.user_id == uid).order_by(MediaSlot.slot_index))
    media = [to_public_url(x) for x in media_r.scalars().all() if x]
    tags_r = await db.execute(select(UserTag.tag_id).where(UserTag.user_id == uid))
    tag_ids = [t[0] for t in tags_r.all()]
    city_name = None
    if u.city_id:
        c_r = await db.execute(select(City.name).where(City.id == u.city_id))
        city_name = c_r.scalar_one_or_none()

    from app.models.swipe import Swipe
    liked_r = await db.execute(select(Swipe.id).where(
        Swipe.actor_id == uid, Swipe.target_id == me.id, Swipe.action_type.in_(["right", "superlike"])
    ))
    likes_me = liked_r.first() is not None

    from datetime import date
    age = None
    if u.birth_date:
        t = date.today()
        age = t.year - u.birth_date.year - ((t.month, t.day) < (u.birth_date.month, u.birth_date.day))

    return {
        "id": str(u.id), "name": u.name, "age": age, "gender": u.gender.value if u.gender else None,
        "city_name": city_name, "bio": u.bio, "is_verified": u.is_verified, "tier": u.tier.value,
        "media": media, "tag_ids": tag_ids, "prompts": u.prompts or {},
        "anthem_url": u.anthem_url, "anthem_title": u.anthem_title, "anthem_start": u.anthem_start,
        "likes_me": likes_me,
    }


STATS_UNLOCK_STARS = 49  # one-off Stars price to scout one person's stats


@router.get("/profile/{user_id}/stats")
async def get_user_stats(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Another person's stats dashboard — gated.

    Access is granted to Kupidon subscribers (perk) or anyone who bought a
    one-off "scout" unlock with Stars. Otherwise we return a paywall payload
    (HTTP 200, ``locked: True``) so the UI can show the unlock screen.
    """
    import uuid as _uuid
    from app.models.user import TierEnum
    from app.models.safety import Block
    from sqlalchemy import or_, and_

    try:
        uid = _uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")

    r = await db.execute(select(User).where(User.id == uid))
    u = r.scalar_one_or_none()
    if not u or u.is_banned or u.is_deleted:
        raise HTTPException(status_code=404, detail="Профиль недоступен")

    # Owner viewing self → always allowed, full private dashboard.
    if uid == me.id:
        from app.services.stats import compute_user_stats
        return {"locked": False, "is_self": True, "stats": await compute_user_stats(db, me, private=True)}

    # Respect blocks both ways.
    blk = await db.execute(select(Block).where(or_(
        and_(Block.blocker_id == me.id, Block.blocked_id == uid),
        and_(Block.blocker_id == uid, Block.blocked_id == me.id),
    )))
    if blk.first():
        raise HTTPException(status_code=403, detail="Недоступно")

    # Access checks.
    is_kupidon = me.tier == TierEnum.kupidon
    unlocked = is_kupidon
    if not unlocked:
        try:
            from app.core.redis import get_redis
            redis = await get_redis()
            unlocked = bool(await redis.get(f"statsunlock:{me.id}:{uid}"))
        except Exception:
            unlocked = False

    if not unlocked:
        return {
            "locked": True,
            "is_self": False,
            "price_stars": STATS_UNLOCK_STARS,
            "product": f"stats_unlock:{uid}",
            "tier_perk": "kupidon",
            "name": u.name,
        }

    from app.services.stats import compute_user_stats
    return {
        "locked": False,
        "is_self": False,
        "via_subscription": is_kupidon,
        "name": u.name,
        "stats": await compute_user_stats(db, u, private=False),
    }


@router.patch("/profile/me", response_model=UserPublic)
async def update_profile(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.services.moderation import moderate_text

    from app.core.agehelp import calc_age
    from app.services.economy import get_config_value

    data = body.model_dump(exclude_none=True)
    # Resulting gender / birth_date after this update (for dependent guards).
    new_gender = data.get("gender", me.gender)
    new_birth = data.get("birth_date", me.birth_date)

    # Anti-troll: count identity reshuffles (gender / city changes).
    if "gender" in data and me.gender is not None and data["gender"] != getattr(me.gender, "value", me.gender):
        me.gender_changes = (me.gender_changes or 0) + 1
    if "city_id" in data and me.city_id and data["city_id"] != me.city_id:
        me.city_changes = (me.city_changes or 0) + 1

    if "birth_date" in data:
        min_age = int(await get_config_value(db, "min_reg_age", "16"))
        if (calc_age(data["birth_date"]) or 0) < min_age:
            raise HTTPException(status_code=422, detail=f"Must be {min_age}+")

    for field, value in data.items():
        if field == "bio" and value:
            value = moderate_text(value)
            if value is None:
                raise HTTPException(status_code=422, detail="Bio contains forbidden content")
        if field == "is_anti_oligarch" and value:
            g = getattr(new_gender, "value", new_gender)
            if g != "female":
                raise HTTPException(status_code=403, detail="Anti-oligarch shield is free for female only")
        if field == "is_18_mode_active" and value:
            if not me.is_verified:
                raise HTTPException(status_code=403, detail="Verification required for 18+ mode")
            adult_min = int(await get_config_value(db, "adult_mode_min_age", "18"))
            if (calc_age(new_birth) or 0) < adult_min:
                raise HTTPException(status_code=403, detail=f"18+ mode requires age {adult_min}+")
        if field == "is_stealth_mode" and value and not me.is_oligarch_mode:
            raise HTTPException(status_code=403, detail="Oligarch mode required")
        setattr(me, field, value)

    me.profile_score = await recalc_profile_score(db, me)
    await db.commit()
    await db.refresh(me)
    return me


@router.get("/tags")
async def get_tags(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.models.tag import AdminTag
    q = select(AdminTag).where(AdminTag.is_active == True)
    if not me.is_18_mode_active:
        q = q.where(AdminTag.is_18_only == False)
    result = await db.execute(q)
    return result.scalars().all()


class TagRequestCreate(BaseModel):
    name: str
    color_hex: str = "#FF00FF"
    emoji: Optional[str] = None
    category: Optional[str] = None
    is_18_only: bool = False


@router.post("/tags/request")
async def request_tag(
    body: TagRequestCreate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Paid user-submitted tag, sent to moderation (U-TAGS-ADMIN).

    Must be a general-interest topic; charged in Stars from the internal balance.
    Refunded automatically if a moderator rejects it.
    """
    from app.models.tag import TagRequest, AdminTag, TagRequestStatusEnum
    from app.services.economy import get_config_value
    from app.services.moderation import moderate_text

    name = (body.name or "").strip()
    if not (2 <= len(name) <= 30):
        raise HTTPException(status_code=422, detail="Tag name must be 2-30 chars")
    if moderate_text(name) is None:
        raise HTTPException(status_code=422, detail="Tag name contains forbidden content")

    # Reject duplicates (existing tag or pending request) — Unicode-safe, DB-agnostic.
    norm = name.casefold()
    existing_names = {n.casefold() for n in (await db.execute(select(AdminTag.name))).scalars().all()}
    if norm in existing_names:
        raise HTTPException(status_code=409, detail="Tag already exists")
    pending_names = {
        n.casefold() for n in (await db.execute(
            select(TagRequest.name).where(TagRequest.status == TagRequestStatusEnum.pending)
        )).scalars().all()
    }
    if norm in pending_names:
        raise HTTPException(status_code=409, detail="Tag already requested")

    cost = int(await get_config_value(db, "tag_request_stars", "200"))
    if me.stars_balance < cost:
        raise HTTPException(status_code=402, detail="not_enough_stars")
    me.stars_balance -= cost

    req = TagRequest(
        user_id=me.id, name=name, color_hex=body.color_hex or "#FF00FF",
        emoji=body.emoji, category=body.category, is_18_only=body.is_18_only,
    )
    db.add(req)
    await db.commit()
    return {"ok": True, "status": "pending", "charged": cost}


@router.get("/tags/requests/mine")
async def my_tag_requests(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.models.tag import TagRequest
    rows = (await db.execute(
        select(TagRequest).where(TagRequest.user_id == me.id).order_by(TagRequest.created_at.desc())
    )).scalars().all()
    return [
        {"id": str(r.id), "name": r.name, "emoji": r.emoji, "category": r.category,
         "status": r.status.value, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@router.post("/profile/tags")
async def set_tags(
    tag_ids: list[int],
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.models.tag import UserTag, AdminTag
    if len(tag_ids) > 5:
        raise HTTPException(status_code=400, detail="Max 5 tags")

    # Delete old
    from sqlalchemy import delete
    await db.execute(delete(UserTag).where(UserTag.user_id == me.id))

    # Validate and insert
    for tid in tag_ids:
        tag_r = await db.execute(select(AdminTag).where(AdminTag.id == tid))
        tag = tag_r.scalar_one_or_none()
        if not tag:
            raise HTTPException(status_code=404, detail=f"Tag {tid} not found")
        if tag.is_18_only and not me.is_18_mode_active:
            raise HTTPException(status_code=403, detail="18+ tag requires 18+ mode")
        db.add(UserTag(user_id=me.id, tag_id=tid))

    await db.flush()
    me.profile_score = await recalc_profile_score(db, me)
    await db.commit()
    return {"ok": True}
