import hashlib
import hmac
import time
from urllib.parse import parse_qsl, urlencode
from typing import Optional
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings


def verify_telegram_init_data(init_data: str) -> Optional[dict]:
    """Validate Telegram WebApp initData via HMAC-SHA256."""
    try:
        params = dict(parse_qsl(init_data, keep_blank_values=True))
        hash_received = params.pop("hash", None)
        if not hash_received:
            return None

        # check_string: sorted key=value pairs joined by \n
        check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(params.items())
        )
        secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed, hash_received):
            return None

        # Check freshness (10 min)
        auth_date = int(params.get("auth_date", 0))
        if time.time() - auth_date > 600:
            return None

        return params
    except Exception:
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
