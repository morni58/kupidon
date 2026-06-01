"""Single source of truth for applying a paid product's effect (L4).

Used by BOTH the bot's ``successful_payment`` handler and the API webhook so a
product is never applied twice with diverging logic. The caller is responsible
for marking the Payment row as paid (idempotency guard) before calling this.
"""
from app.models.user import User, TierEnum
from app.services.tickets import grant_ticket


async def apply_payment_effect(user: User, product: str, stars: int) -> None:
    if product == "force_chat":
        # Grant one Force Chat ticket; consumed by the /force_chat endpoint (C2).
        await grant_ticket("force_chat", user.id)
    elif product == "boost":
        # TODO (L3): real top-of-feed boost via boost_until column.
        # For now grant a small visibility perk without touching internal balance.
        user.superlikes_left += 3
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
    elif product == "kupidon_month":
        user.tier = TierEnum.kupidon
        user.swipes_left = max(user.swipes_left, 500)
        user.superlikes_left = max(user.superlikes_left, 5)
        user.force_chats_used = 0
        user.is_oligarch_mode = True
