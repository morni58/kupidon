from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
        "tier": me.tier.value, "swipes_left": me.swipes_left, "superlikes_left": me.superlikes_left,
        "force_chats_used": me.force_chats_used, "vip_signals_used": me.vip_signals_used,
        "is_verified": me.is_verified, "is_18_mode_active": me.is_18_mode_active,
        "is_oligarch_mode": me.is_oligarch_mode, "is_anti_oligarch": me.is_anti_oligarch,
        "is_stealth_mode": me.is_stealth_mode, "streak_days": me.streak_days,
        "city_name": city_name, "media": media, "tag_ids": tag_ids,
    }


@router.patch("/profile/me", response_model=UserPublic)
async def update_profile(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.services.moderation import moderate_text

    data = body.model_dump(exclude_none=True)
    # Resulting gender after this update (for gender-dependent guards).
    new_gender = data.get("gender", me.gender)

    for field, value in data.items():
        if field == "bio" and value:
            value = moderate_text(value)
            if value is None:
                raise HTTPException(status_code=422, detail="Bio contains forbidden content")
        if field == "is_anti_oligarch" and value:
            g = getattr(new_gender, "value", new_gender)
            if g != "female":
                raise HTTPException(status_code=403, detail="Anti-oligarch shield is free for female only")
        if field == "is_18_mode_active" and value and not me.is_verified:
            raise HTTPException(status_code=403, detail="Verification required for 18+ mode")
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
