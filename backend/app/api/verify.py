from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import os, uuid
import aiofiles

from app.core.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/api/verify", tags=["verify"])

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")
PUBLIC_BASE = os.environ.get("PUBLIC_MEDIA_URL", "")


@router.post("/selfie")
async def submit_verification(
    file: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Submit a verification APPLICATION (not auto-granted).

    The user records a short selfie/photo doing a gesture; it's stored and an
    admin reviews it manually, then grants the blue check to chosen profiles.
    """
    if me.is_verified:
        return {"already_verified": True}

    selfie_url = None
    if file is not None:
        data = await file.read()
        if len(data) > 12 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Файл слишком большой")
        ct = (file.content_type or "").lower()
        ext = "mp4" if "video" in ct else "jpg"
        d = os.path.join(MEDIA_ROOT, str(me.id))
        os.makedirs(d, exist_ok=True)
        fn = f"verify_{uuid.uuid4().hex[:8]}.{ext}"
        async with aiofiles.open(os.path.join(d, fn), "wb") as f:
            await f.write(data)
        selfie_url = f"{PUBLIC_BASE.rstrip('/')}/{me.id}/{fn}" if PUBLIC_BASE else f"/media/{me.id}/{fn}"

    me.verify_requested_at = datetime.now(timezone.utc)
    if selfie_url:
        me.verify_selfie_url = selfie_url
    await db.commit()

    # Ping admins so they can review the queue.
    try:
        from app.services import notifications as notif
        for admin_id in settings.admin_ids_list:
            await notif.send_push(admin_id, f"🔵 Заявка на верификацию: {me.name} (@{me.username or '—'}). /verifyqueue")
    except Exception:
        pass

    return {"pending": True}
