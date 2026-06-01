from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import uuid

from app.core.deps import get_db, get_current_user
from app.core.ratelimit import rate_limiter
from app.models.user import User
from app.models.safety import Report, Block, ReportReasonEnum

router = APIRouter(prefix="/api", tags=["safety"])


class ReportRequest(BaseModel):
    target_id: uuid.UUID
    reason: ReportReasonEnum


class BlockRequest(BaseModel):
    target_id: uuid.UUID


@router.post("/report")
async def report_user(
    body: ReportRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(rate_limiter("report", limit=20, window=3600)),
):
    if body.target_id == me.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Check duplicate
    existing = await db.execute(
        select(Report).where(
            Report.reporter_id == me.id,
            Report.target_id == body.target_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already reported")

    report = Report(reporter_id=me.id, target_id=body.target_id, reason=body.reason)
    db.add(report)

    # Auto-shadowban after 3 unique reports
    count_r = await db.execute(
        select(func.count(Report.id)).where(
            Report.target_id == body.target_id,
        )
    )
    count = count_r.scalar_one()
    if count >= 2:  # this will be the 3rd
        target_r = await db.execute(select(User).where(User.id == body.target_id))
        target = target_r.scalar_one_or_none()
        if target:
            target.is_shadowbanned = True
            target.needs_review = True

    await db.commit()
    return {"ok": True}


@router.post("/block")
async def block_user(
    body: BlockRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if body.target_id == me.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Bilateral block
    for blocker, blocked in [(me.id, body.target_id), (body.target_id, me.id)]:
        existing = await db.execute(
            select(Block).where(Block.blocker_id == blocker, Block.blocked_id == blocked)
        )
        if not existing.scalar_one_or_none():
            db.add(Block(blocker_id=blocker, blocked_id=blocked))

    await db.commit()
    return {"ok": True}
