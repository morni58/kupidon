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
    result = await db.execute(
        select(ProfileView)
        .where(ProfileView.target_id == me.id)
        .order_by(ProfileView.created_at.desc())
        .limit(50)
    )
    views = result.scalars().all()
    is_premium = me.tier.value in ("premium", "kupidon")

    response = []
    for v in views:
        if is_premium:
            viewer_r = await db.execute(select(User).where(User.id == v.viewer_id))
            viewer = viewer_r.scalar_one_or_none()
            response.append({
                "viewer_id": str(v.viewer_id),
                "name": viewer.name if viewer else "?",
                "is_verified": viewer.is_verified if viewer else False,
                "viewed_at": v.created_at.isoformat(),
                "visible": True,
            })
        else:
            response.append({
                "viewer_id": None,  # silhouette for free
                "viewed_at": v.created_at.isoformat(),
                "visible": False,
            })

    return {"count": len(views), "items": response, "is_premium": is_premium}
