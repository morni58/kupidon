"""Media URL helpers.

The frontend is served from a different origin (Netlify) than the API
(Railway), so relative media paths like ``/media/<id>/<file>`` do not resolve.
``to_public_url`` turns any stored path into an absolute URL the browser can
load from any origin. See U-MEDIA in IMPROVEMENTS.md.

Configure one of:
- ``PUBLIC_MEDIA_URL`` — full base that points at the ``/media`` mount,
  e.g. ``https://cupidbot-api.up.railway.app/media``
- ``PUBLIC_API_URL`` — API origin, e.g. ``https://cupidbot-api.up.railway.app``
"""
import os
import uuid
from typing import Optional

PUBLIC_MEDIA_URL = os.environ.get("PUBLIC_MEDIA_URL", "").rstrip("/")
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "").rstrip("/")
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")


async def save_upload(data: bytes, owner_id, ext: str) -> str:
    """Persist raw bytes under the owner's media dir and return the relative URL.

    Single place for writing media so profile uploads and chat uploads behave
    identically (swap for S3 here in one spot later)."""
    import aiofiles
    owner_dir = os.path.join(MEDIA_ROOT, str(owner_id))
    os.makedirs(owner_dir, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(owner_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(data)
    return f"/media/{owner_id}/{filename}"


def to_public_url(url: Optional[str]) -> Optional[str]:
    """Return an absolute URL for a stored media path.

    - ``None``/empty -> returned unchanged
    - already absolute (http/https) -> returned unchanged
    - ``/media/...`` relative -> prefixed with the configured public base
    """
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if PUBLIC_MEDIA_URL:
        # url is like "/media/<id>/<file>"; PUBLIC_MEDIA_URL already ends at /media
        tail = url[len("/media"):] if url.startswith("/media") else url
        return f"{PUBLIC_MEDIA_URL}{tail}"
    if PUBLIC_API_URL:
        return f"{PUBLIC_API_URL}{url if url.startswith('/') else '/' + url}"
    # No public base configured — return the relative path; the frontend will
    # prefix it with VITE_API_URL as a fallback.
    return url
