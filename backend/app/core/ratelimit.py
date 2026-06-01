"""Simple Redis fixed-window rate limiter (S3).

Usage as a dependency that also yields the current user:

    me: User = Depends(rate_limiter("swipe", limit=40, window=10))
"""
from fastapi import Depends, HTTPException

from app.core.deps import get_current_user
from app.core.redis import get_redis


def rate_limiter(scope: str, limit: int, window: int):
    async def _dep(me=Depends(get_current_user)):
        try:
            redis = await get_redis()
            key = f"rl:{scope}:{me.id}"
            n = await redis.incr(key)
            if n == 1:
                await redis.expire(key, window)
            if n > limit:
                raise HTTPException(status_code=429, detail="rate_limited")
        except HTTPException:
            raise
        except Exception:
            # Never block a legit request if Redis hiccups.
            pass
        return me
    return _dep
