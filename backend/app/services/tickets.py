"""One-shot paid entitlements stored in Redis (Force Chat / VIP signal tickets).

Free users can pay Stars for a single Force Chat ("врыв"); oligarchs can buy
extra VIP signals beyond the daily cap. A payment grants a ticket; the relevant
endpoint consumes it. See C2/C8 in IMPROVEMENTS.md.
"""
from app.core.redis import get_redis

_KEY = "ticket:{kind}:{user_id}"
# Tickets live for 30 days so an unused paid entitlement is not lost immediately.
_TTL_SECONDS = 30 * 24 * 3600


async def grant_ticket(kind: str, user_id, count: int = 1) -> int:
    redis = await get_redis()
    key = _KEY.format(kind=kind, user_id=user_id)
    val = await redis.incrby(key, count)
    await redis.expire(key, _TTL_SECONDS)
    return int(val)


async def ticket_count(kind: str, user_id) -> int:
    redis = await get_redis()
    val = await redis.get(_KEY.format(kind=kind, user_id=user_id))
    return int(val) if val else 0


async def consume_ticket(kind: str, user_id) -> bool:
    """Atomically consume one ticket. Returns True if one was available."""
    redis = await get_redis()
    key = _KEY.format(kind=kind, user_id=user_id)
    val = await redis.get(key)
    if not val or int(val) <= 0:
        return False
    await redis.decr(key)
    return True


# Convenience wrappers ------------------------------------------------------

async def grant_force_chat_ticket(user_id) -> int:
    return await grant_ticket("force_chat", user_id)


async def force_chat_tickets(user_id) -> int:
    return await ticket_count("force_chat", user_id)


async def consume_force_chat_ticket(user_id) -> bool:
    return await consume_ticket("force_chat", user_id)
