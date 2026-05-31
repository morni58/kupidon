from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import os
import aiofiles

from app.core.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.media import MediaSlot, MediaTypeEnum
from app.services.moderation import nsfw_service

router = APIRouter(prefix="/api/media", tags=["media"])

MAX_SLOTS = 5
MAX_PHOTO_MB = 5
MAX_VIDEO_MB = 15

# Persistent media directory (Railway Volume mounted here in prod)
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")
PUBLIC_BASE = os.environ.get("PUBLIC_MEDIA_URL", "")  # e.g. https://api.../media


@router.post("/upload/{slot_index}")
async def upload_media(
    slot_index: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if slot_index < 1 or slot_index > MAX_SLOTS:
        raise HTTPException(status_code=400, detail="Slot index must be 1-5")

    content_type = file.content_type or ""
    if content_type.startswith("video"):
        media_type = MediaTypeEnum.video
        # Video takes 3 slots — check free slots
        used_r = await db.execute(select(MediaSlot).where(MediaSlot.user_id == me.id))
        used = used_r.scalars().all()
        if len(used) + 2 > MAX_SLOTS:
            raise HTTPException(status_code=400, detail="Free up 3 slots for video")
    else:
        media_type = MediaTypeEnum.photo

    # Read file
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    limit_mb = MAX_VIDEO_MB if media_type == MediaTypeEnum.video else MAX_PHOTO_MB
    if size_mb > limit_mb:
        raise HTTPException(status_code=413, detail=f"File too large (max {limit_mb} MB)")

    # Persist to disk (Railway Volume / local). Swap for S3/Supabase in prod easily.
    ext = "mp4" if media_type == MediaTypeEnum.video else "webp"
    user_dir = os.path.join(MEDIA_ROOT, str(me.id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(user_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(data)

    base = PUBLIC_BASE or (settings.WEBAPP_URL.replace("netlify.app", "up.railway.app") if settings.WEBAPP_URL else "")
    media_url = f"/media/{me.id}/{filename}"  # served by FastAPI StaticFiles

    # NSFW moderation (stub returns safe score; wire a real model in services/moderation.py)
    nsfw_score = await nsfw_service.classify(filepath)
    threshold = 0.70 if me.is_18_mode_active else 0.85
    if nsfw_score >= threshold:
        os.remove(filepath)
        raise HTTPException(status_code=422, detail="Media flagged as NSFW")

    # Upsert slot
    existing_r = await db.execute(
        select(MediaSlot).where(MediaSlot.user_id == me.id, MediaSlot.slot_index == slot_index)
    )
    slot = existing_r.scalar_one_or_none()
    if slot:
        slot.media_url = media_url
        slot.media_type = media_type
        slot.nsfw_score = nsfw_score
    else:
        slot = MediaSlot(
            user_id=me.id,
            media_url=media_url,
            media_type=media_type,
            nsfw_score=nsfw_score,
            slot_index=slot_index,
        )
        db.add(slot)

    # Profile score: first photo = +20, each additional = +10
    if slot_index == 1:
        me.profile_score = min(me.profile_score + 20, 100)
    elif media_type == MediaTypeEnum.photo:
        me.profile_score = min(me.profile_score + 10, 100)
    elif media_type == MediaTypeEnum.video:
        me.profile_score = min(me.profile_score + 15, 100)

    await db.commit()
    return {"slot_index": slot_index, "media_url": media_url, "nsfw_score": nsfw_score}


@router.delete("/slot/{slot_index}")
async def delete_slot(
    slot_index: int,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from sqlalchemy import delete
    await db.execute(
        delete(MediaSlot).where(MediaSlot.user_id == me.id, MediaSlot.slot_index == slot_index)
    )
    await db.commit()
    return {"ok": True}


@router.post("/burn/{message_id}")
async def burn_message_media(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """18+ disappearing media: mark as burned after first view, remove from storage."""
    from fastapi import HTTPException
    from app.models.message import Message
    from app.models.match import Match
    from sqlalchemy import or_
    import uuid as _uuid

    msg_r = await db.execute(select(Message).where(Message.id == _uuid.UUID(message_id)))
    msg = msg_r.scalar_one_or_none()
    if not msg or not msg.is_disappearing:
        raise HTTPException(status_code=404, detail="No disappearing media")

    # Verify the burner is the recipient (member of the match, not the sender)
    match_r = await db.execute(select(Match).where(Match.id == msg.match_id))
    match = match_r.scalar_one_or_none()
    if not match or me.id not in (match.user1_id, match.user2_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if msg.sender_id == me.id:
        raise HTTPException(status_code=400, detail="Cannot burn your own media")

    msg.is_burned = True
    # In prod: delete from S3 here using msg.media_url
    msg.media_url = None
    await db.commit()

    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(msg.match_id), {
        "type": "media_burned",
        "message_id": message_id,
    }))
    return {"ok": True, "burned": True}
