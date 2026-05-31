from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import OnboardingCreate, UserPublic, UserUpdate

router = APIRouter(prefix="/api", tags=["profile"])


def recalc_profile_score(user: User) -> int:
    score = 0
    # Onboarding complete
    if user.birth_date and user.gender and user.search_gender:
        score += 20  # first photo counted separately
    if user.bio:
        score += 10
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

    me.profile_score = recalc_profile_score(me)
    await db.commit()
    await db.refresh(me)
    return me


@router.get("/profile/me", response_model=UserPublic)
async def get_my_profile(me: User = Depends(get_current_user)):
    return me


@router.patch("/profile/me", response_model=UserPublic)
async def update_profile(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.services.moderation import moderate_text

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "bio" and value:
            value = moderate_text(value)
            if value is None:
                raise HTTPException(status_code=422, detail="Bio contains forbidden content")
        if field == "is_anti_oligarch" and value and me.gender.value != "female":
            raise HTTPException(status_code=403, detail="Anti-oligarch shield is free for female only")
        if field == "is_18_mode_active" and value and not me.is_verified:
            raise HTTPException(status_code=403, detail="Verification required for 18+ mode")
        if field == "is_stealth_mode" and value and not me.is_oligarch_mode:
            raise HTTPException(status_code=403, detail="Oligarch mode required")
        setattr(me, field, value)

    me.profile_score = recalc_profile_score(me)
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

    # Recalc score
    if len(tag_ids) >= 3:
        me.profile_score = min(me.profile_score + 10, 100)

    await db.commit()
    return {"ok": True}
