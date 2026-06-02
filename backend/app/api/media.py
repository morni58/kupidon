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
MAX_AUDIO_MB = 8

# Persistent media directory (Railway Volume mounted here in prod)
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")
PUBLIC_BASE = os.environ.get("PUBLIC_MEDIA_URL", "")  # e.g. https://api.../media


@router.post("/anthem")
async def upload_anthem(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Upload a profile anthem (short audio clip). Returns the public URL."""
    ct = (file.content_type or "").lower()
    if not (ct.startswith("audio") or ct in ("application/ogg", "video/mp4")):
        raise HTTPException(status_code=400, detail="Нужен аудиофайл")
    data = await file.read()
    if len(data) > MAX_AUDIO_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Файл больше {MAX_AUDIO_MB} МБ")

    ext = "mp3"
    if "ogg" in ct: ext = "ogg"
    elif "wav" in ct: ext = "wav"
    elif "mp4" in ct or "m4a" in ct or "aac" in ct: ext = "m4a"
    user_dir = os.path.join(MEDIA_ROOT, str(me.id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"anthem_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(user_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(data)

    # Remove a previous anthem file if any (keep storage tidy)
    if me.anthem_url:
        try:
            old = me.anthem_url.split("/media/")[-1]
            oldpath = os.path.join(MEDIA_ROOT, old)
            if os.path.isfile(oldpath) and "anthem_" in oldpath:
                os.remove(oldpath)
        except Exception:
            pass

    url = f"{PUBLIC_BASE.rstrip('/')}/{me.id}/{filename}" if PUBLIC_BASE else f"/media/{me.id}/{filename}"
    me.anthem_url = url
    await db.commit()
    return {"anthem_url": url}


@router.delete("/anthem")
async def delete_anthem(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.anthem_url:
        try:
            rel = me.anthem_url.split("/media/")[-1]
            p = os.path.join(MEDIA_ROOT, rel)
            if os.path.isfile(p) and "anthem_" in p:
                os.remove(p)
        except Exception:
            pass
    me.anthem_url = None
    me.anthem_title = None
    me.anthem_start = None
    await db.commit()
    return {"ok": True}


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
        # Video occupies 3 slots — make sure there are 3 free (C5).
        used_r = await db.execute(select(MediaSlot).where(MediaSlot.user_id == me.id))
        used = used_r.scalars().all()
        # Slots currently occupied by *other* indexes than the one we upload into.
        occupied_other = len([s for s in used if s.slot_index != slot_index])
        if occupied_other + 3 > MAX_SLOTS:
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

    # Full URL if PUBLIC_MEDIA_URL is configured, else relative (served by StaticFiles)
    if PUBLIC_BASE:
        media_url = f"{PUBLIC_BASE.rstrip('/')}/{me.id}/{filename}"
    else:
        media_url = f"/media/{me.id}/{filename}"

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

    await db.flush()
    from app.api.profile import recalc_profile_score
    me.profile_score = await recalc_profile_score(db, me)

    await db.commit()
    from app.core.media import to_public_url
    return {"slot_index": slot_index, "media_url": to_public_url(media_url), "nsfw_score": nsfw_score}


@router.get("/mine")
async def my_media(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Return the current user's media slots ordered by slot index."""
    result = await db.execute(
        select(MediaSlot).where(MediaSlot.user_id == me.id).order_by(MediaSlot.slot_index)
    )
    slots = result.scalars().all()
    from app.core.media import to_public_url
    return [
        {"slot_index": s.slot_index, "media_url": to_public_url(s.media_url), "media_type": s.media_type.value if s.media_type else None}
        for s in slots
    ]


@router.post("/reorder")
async def reorder_slots(
    order: list[int],
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Reorder photo slots. `order` is the current slot_indexes in the desired
    order; the first becomes the main photo (slot 1). Flexible photo management."""
    from sqlalchemy import update as sa_update
    result = await db.execute(select(MediaSlot).where(MediaSlot.user_id == me.id))
    slots = {s.slot_index: s for s in result.scalars().all()}

    # Validate the requested order references only existing slots.
    target = [i for i in order if i in slots]
    if not target:
        return {"ok": True}

    # Two-phase reassign to avoid violating UNIQUE(user_id, slot_index):
    # first move everyone to a negative temp index, then to the final index.
    for s in slots.values():
        s.slot_index = -(s.slot_index)
    await db.flush()
    new_index = 1
    for old_idx in target:
        slots[old_idx].slot_index = new_index
        new_index += 1
    # Any slots not mentioned keep going after, preserving relative order.
    for old_idx in sorted(k for k in slots if k not in target):
        slots[old_idx].slot_index = new_index
        new_index += 1
    await db.commit()
    return {"ok": True}


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
