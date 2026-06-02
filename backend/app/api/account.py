"""Account self-service: data export + soft delete (privacy / GDPR-ish)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete as sa_delete

from app.core.deps import get_db, get_current_user
from app.core.media import to_public_url
from app.models.user import User
from app.models.media import MediaSlot
from app.models.tag import UserTag, AdminTag
from app.models.match import Match
from app.models.message import Message

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/export")
async def export_data(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    """Return everything we store about the user, in one JSON payload."""
    media = [to_public_url(u) for u in (await db.execute(
        select(MediaSlot.media_url).where(MediaSlot.user_id == me.id).order_by(MediaSlot.slot_index)
    )).scalars().all() if u]

    tag_rows = (await db.execute(
        select(AdminTag.name).join(UserTag, AdminTag.id == UserTag.tag_id).where(UserTag.user_id == me.id)
    )).scalars().all()

    matches = (await db.execute(
        select(func.count(Match.id)).where(or_(Match.user1_id == me.id, Match.user2_id == me.id))
    )).scalar_one()
    messages = (await db.execute(
        select(func.count(Message.id)).where(Message.sender_id == me.id)
    )).scalar_one()

    return {
        "profile": {
            "id": str(me.id), "tg_id": me.tg_id, "username": me.username, "name": me.name,
            "birth_date": me.birth_date.isoformat() if me.birth_date else None,
            "gender": me.gender.value if me.gender else None,
            "search_gender": me.search_gender.value if me.search_gender else None,
            "bio": me.bio, "tier": me.tier.value, "stars_balance": me.stars_balance,
            "is_verified": me.is_verified, "created_at": me.created_at.isoformat() if me.created_at else None,
        },
        "media": media,
        "interests": list(tag_rows),
        "stats": {"matches": matches, "messages_sent": messages},
    }


@router.get("/stats")
async def account_stats(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    """Personal dashboard (owner-only): activity numbers + anti-troll signals."""
    from app.services.stats import compute_user_stats
    return await compute_user_stats(db, me, private=True)


@router.delete("")
async def delete_account(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    """Soft-delete: hide everywhere, scrub personal content. tg_id is kept so the
    unique constraint holds; the row is excluded from auth and the feed."""
    me.is_deleted = True
    me.bio = None
    me.name = "Удалённый профиль"
    me.is_stealth_mode = True
    me.lat = me.lng = None
    # Remove photos/videos rows (storage cleanup is handled by the media layer/S3).
    await db.execute(sa_delete(MediaSlot).where(MediaSlot.user_id == me.id))
    await db.execute(sa_delete(UserTag).where(UserTag.user_id == me.id))
    await db.commit()
    return {"ok": True, "deleted": True}
