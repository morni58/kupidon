"""Bot notification helpers called from the API layer.

Uses a single shared Bot instance instead of creating a new HTTP session per
push (P4). No-ops in tests / when no real token is configured.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("cupidbot.notify")

_bot = None


def _enabled() -> bool:
    token = settings.BOT_TOKEN or ""
    if settings.ENVIRONMENT == "test":
        return False
    # A real bot token looks like "<digits>:<35 chars>".
    return ":" in token and len(token) > 20


async def _get_bot():
    global _bot
    if _bot is None:
        from aiogram import Bot
        _bot = Bot(token=settings.BOT_TOKEN)
    return _bot


async def send_push(tg_id: int, text: str, msg_type: str = "info") -> None:
    """Send a notification via the shared bot. Fails silently on any error."""
    if not _enabled() or not tg_id:
        return
    try:
        bot = await _get_bot()
        await bot.send_message(chat_id=tg_id, text=text)
    except Exception as e:
        logger.warning("push failed for %s: %s", tg_id, e)


async def notify_match(tg_id: int, partner_name: str) -> None:
    await send_push(tg_id, f"💕 Совпадение с {partner_name}! Напиши первым 👉 CupidBot")


async def notify_vip_like(tg_id: int, message: Optional[str] = None) -> None:
    text = "👑 VIP проявил интерес! Открой Симпатии, чтобы узнать кто."
    if message:
        text += f'\n💬 «{message}»'
    await send_push(tg_id, text)


async def notify_superlike(tg_id: int) -> None:
    await send_push(tg_id, "⭐ Тебя суперлайкнули! Проверь Симпатии.")


async def notify_new_message(tg_id: int, sender_name: str) -> None:
    await send_push(tg_id, f"💬 {sender_name} написал(а) тебе в CupidBot")


async def notify_profile_views(tg_id: int, count: int) -> None:
    await send_push(tg_id, f"👀 Сегодня твою анкету посмотрели {count} раз. Загляни в Симпатии!")
