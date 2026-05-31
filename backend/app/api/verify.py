from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.services.moderation import face_service

router = APIRouter(prefix="/api/verify", tags=["verify"])


@router.post("/selfie")
async def verify_selfie(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """
    Liveness verification stub.
    In production: receive video frames, call face_service.verify_liveness().
    """
    if me.is_verified:
        return {"already_verified": True}

    # Stub: always passes
    passed = await face_service.verify_liveness([])
    if passed:
        me.is_verified = True
        from app.api.profile import recalc_profile_score
        me.profile_score = await recalc_profile_score(db, me)
        await db.commit()
        return {"verified": True}

    raise HTTPException(status_code=422, detail="Liveness check failed")
