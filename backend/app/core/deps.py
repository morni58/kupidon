from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.security import decode_jwt
from app.db.database import async_session_maker

bearer = HTTPBearer()


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    user_id = decode_jwt(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account banned")

    # Keep last_active_at fresh on any authenticated request, throttled to once
    # every few minutes so we don't write on every call (L1).
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    last = user.last_active_at
    if last is not None and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if last is None or (now - last) > timedelta(minutes=5):
        user.last_active_at = now
        await db.commit()
    return user
