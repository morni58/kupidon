from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.media import MediaSlot, MediaTypeEnum
from app.services.moderation import nsfw_service

router = APIRouter(prefix="/api/media", tags=["media"])

MAX_SLOTS = 5
MAX_PHOTO_MB = 5
MAX_VIDEO_MB = 15


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

    # Read file (in prod: upload to S3)
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    limit_mb = MAX_VIDEO_MB if media_type == MediaTypeEnum.video else MAX_PHOTO_MB
    if size_mb > limit_mb:
        raise HTTPException(status_code=413, detail=f"File too large (max {limit_mb} MB)")

    # Stub S3 upload — in prod use boto3/aiobotocore
    media_url = f"https://media.cupidbot.app/{me.id}/{uuid.uuid4()}.{'mp4' if media_type == MediaTypeEnum.video else 'webp'}"

    # NSFW moderation
    nsfw_score = await nsfw_service.classify(media_url)
    threshold = 0.70 if me.is_18_mode_active else 0.85
    if nsfw_score >= threshold:
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
