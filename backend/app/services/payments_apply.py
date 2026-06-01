"""Single source of truth for applying a paid product's effect (L4).

Used by BOTH the bot's ``successful_payment`` handler and the API webhook so a
product is never applied twice with diverging logic. The caller is responsible
for marking the Payment row as paid (idempotency guard) before calling this.
"""
from datetime import datetime, timezone, timedelta

from app.models.user import User, TierEnum
from app.services.tickets import grant_ticket, grant_boost


def _extend(user: User, days: int = 30) -> None:
    """Extend subscription from the later of now / current expiry (stacking)."""
    now = datetime.now(timezone.utc)
    base = user.tier_until
    if base is not None and base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    start = base if (base and base > now) else now
    user.tier_until = start + timedelta(days=days)


async def apply_payment_effect(user: User, product: str, stars: int) -> None:
    if product == "force_chat":
        # Grant one Force Chat ticket; consumed by the /force_chat endpoint (C2).
        await grant_ticket("force_chat", user.id)
    elif product == "boost":
        # Real top-of-feed boost for 2 hours via a TTL flag (L3).
        await grant_boost(user.id, 2 * 3600)
    elif product == "superlike":
        user.superlikes_left += 1
    elif product == "vip_signal":
        # Extra VIP signal beyond the daily cap; consumed in handle_swipe (C8).
        await grant_ticket("vip_signal", user.id)
    elif product == "premium_month":
        user.tier = TierEnum.premium
        user.swipes_left = max(user.swipes_left, 200)
        user.superlikes_left = max(user.superlikes_left, 5)
        user.force_chats_used = 0
        _extend(user, 30)
    elif product == "kupidon_month":
        user.tier = TierEnum.kupidon
        user.swipes_left = max(user.swipes_left, 500)
        user.superlikes_left = max(user.superlikes_left, 5)
        user.force_chats_used = 0
        user.is_oligarch_mode = True
        _extend(user, 30)
