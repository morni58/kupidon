"""Profile views — 'who viewed me'."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.vip import ProfileView

router = APIRouter(prefix="/api", tags=["views"])


@router.post("/views/{target_id}")
async def record_view(
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if target_id == me.id:
        return {"ok": True}
    existing = await db.execute(
        select(ProfileView).where(
            ProfileView.viewer_id == me.id,
            ProfileView.target_id == target_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(ProfileView(viewer_id=me.id, target_id=target_id))
        await db.commit()
    return {"ok": True}


@router.get("/views/me")
async def who_viewed_me(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from datetime import date as _date
    from app.models.media import MediaSlot
    from app.models.city import City
    from app.models.swipe import Swipe
    from app.core.media import to_public_url

    result = await db.execute(
        select(ProfileView)
        .where(ProfileView.target_id == me.id)
        .order_by(ProfileView.created_at.desc())
        .limit(50)
    )
    views = result.scalars().all()
    is_premium = me.tier.value in ("premium", "kupidon")

    # How many of the viewers already liked me (nice "X лайкнули" hint, free too).
    viewer_ids = [v.viewer_id for v in views]
    liked_set: set = set()
    if viewer_ids:
        liked_r = await db.execute(select(Swipe.actor_id).where(
            Swipe.actor_id.in_(viewer_ids), Swipe.target_id == me.id,
            Swipe.action_type.in_(["right", "superlike"]),
        ))
        liked_set = {row[0] for row in liked_r.all()}

    response = []
    for v in views:
        if not is_premium:
            response.append({"viewer_id": None, "viewed_at": v.created_at.isoformat(), "visible": False})
            continue
        viewer = (await db.execute(select(User).where(User.id == v.viewer_id))).scalar_one_or_none()
        if not viewer or viewer.is_banned or viewer.is_deleted:
            continue
        photo_r = await db.execute(select(MediaSlot.media_url).where(MediaSlot.user_id == viewer.id).order_by(MediaSlot.slot_index).limit(1))
        photo = to_public_url(photo_r.scalar_one_or_none())
        age = None
        if viewer.birth_date:
            t = _date.today()
            age = t.year - viewer.birth_date.year - ((t.month, t.day) < (viewer.birth_date.month, viewer.birth_date.day))
        city = None
        if viewer.city_id:
            city = (await db.execute(select(City.name).where(City.id == viewer.city_id))).scalar_one_or_none()
        response.append({
            "viewer_id": str(v.viewer_id), "name": viewer.name, "age": age, "city": city,
            "photo": photo, "is_verified": viewer.is_verified,
            "likes_me": v.viewer_id in liked_set,
            "viewed_at": v.created_at.isoformat(), "visible": True,
        })

    return {"count": len(views), "liked_count": len(liked_set), "items": response, "is_premium": is_premium}
