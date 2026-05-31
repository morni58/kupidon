"""Bot notification helpers called from API layer."""
import asyncio
from typing import Optional

from app.core.config import settings


async def send_push(tg_id: int, text: str, msg_type: str = "info") -> None:
    """Send notification via aiogram bot. Fails silently if bot unreachable."""
    try:
        from aiogram import Bot
        bot = Bot(token=settings.BOT_TOKEN)
        await bot.send_message(chat_id=tg_id, text=text)
        await bot.session.close()
    except Exception:
        pass


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
