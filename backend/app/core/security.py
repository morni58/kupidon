import hashlib
import hmac
import logging
import os
import time
from urllib.parse import parse_qsl, urlencode
from typing import Optional
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings

logger = logging.getLogger("cupidbot.auth")

# initData freshness window. Telegram regenerates initData on each open, but
# desktop/web clients can keep a session open for a long time, so a tight 10-min
# window caused false 401s and "new account on PC" symptoms (U-AUTH). Configurable.
INIT_DATA_MAX_AGE = int(os.environ.get("INIT_DATA_MAX_AGE", str(24 * 3600)))


def verify_telegram_init_data(init_data: str) -> Optional[dict]:
    """Validate Telegram WebApp initData via HMAC-SHA256.

    Returns the parsed params on success, ``None`` on failure (logged for
    diagnosis). The user identity is always derived from the verified payload,
    so the same Telegram account maps to the same row on every device (U-AUTH).
    """
    if not init_data:
        logger.warning("initData empty")
        return None
    try:
        params = dict(parse_qsl(init_data, keep_blank_values=True))
        hash_received = params.pop("hash", None)
        if not hash_received:
            logger.warning("initData missing hash")
            return None

        # check_string: sorted key=value pairs joined by \n
        check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(params.items())
        )
        secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed, hash_received):
            logger.warning("initData hash mismatch")
            return None

        # Freshness check (configurable; 0 disables).
        if INIT_DATA_MAX_AGE > 0:
            auth_date = int(params.get("auth_date", 0))
            age = time.time() - auth_date
            if age > INIT_DATA_MAX_AGE:
                logger.warning("initData stale: age=%ss", int(age))
                return None

        return params
    except Exception as e:
        logger.warning("initData parse error: %s", e)
        return None


def create_jwt(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_jwt(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
