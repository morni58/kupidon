"""CupidBot — aiogram 3.x entrypoint (lives inside backend package to share models)."""
import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import BotCommand

from bot_handlers.user import router as user_router
from bot_handlers.admin import router as admin_router
from bot_handlers.staff import router as staff_router
from bot_handlers.payments import router as payments_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cupidbot")

BOT_TOKEN = os.environ["BOT_TOKEN"]
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


async def main():
    storage = RedisStorage.from_url(REDIS_URL)
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN))
    dp = Dispatcher(storage=storage)
    dp.include_router(user_router)
    dp.include_router(admin_router)
    dp.include_router(staff_router)
    dp.include_router(payments_router)

    # Public command menu (shown to everyone).
    await bot.set_my_commands([
        BotCommand(command="start", description="🚀 Запустить / меню"),
        BotCommand(command="browse", description="💞 Смотреть анкеты"),
        BotCommand(command="likes", description="💌 Кто меня лайкнул"),
        BotCommand(command="matches", description="💘 Мои мэтчи"),
        BotCommand(command="me", description="👤 Моя анкета"),
        BotCommand(command="stats", description="📊 Моя статистика"),
        BotCommand(command="blind", description="🎭 Свидание вслепую"),
        BotCommand(command="premium", description="⭐ Premium и буст"),
        BotCommand(command="export", description="📄 Профиль в PDF"),
        BotCommand(command="settings", description="⚙️ Режимы (18+, невидимость)"),
        BotCommand(command="help", description="❓ Помощь"),
    ])
    # Admin command menu (only in the admins' own chats).
    admin_ids = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]
    if admin_ids:
        from aiogram.types import BotCommandScopeChat
        admin_cmds = [
            BotCommand(command="staffhelp", description="🛠 Все команды персонала"),
            BotCommand(command="reports", description="🛡 Очередь жалоб"),
            BotCommand(command="verifyqueue", description="🛡 Заявки на галочку"),
            BotCommand(command="user", description="🛡 Инфо о пользователе"),
            BotCommand(command="find", description="🛡 Поиск пользователей"),
            BotCommand(command="recent", description="🛡 Последние регистрации"),
            BotCommand(command="ban", description="🛡 Бан / unban"),
            BotCommand(command="warn", description="🛡 Предупреждение"),
            BotCommand(command="mute", description="🛡 Мьют / unmute"),
            BotCommand(command="audit", description="📜 Журнал действий"),
            BotCommand(command="give", description="⭐ Выдать донат/премиум"),
            BotCommand(command="stars", description="⭐ Изменить Stars"),
            BotCommand(command="broadcast", description="⭐ Рассылка всем"),
            BotCommand(command="grant", description="⭐ Выдать роль"),
            BotCommand(command="revoke", description="⭐ Снять роль"),
            BotCommand(command="staff", description="⭐ Список персонала"),
            BotCommand(command="adstats", description="📊 Статистика бота"),
            BotCommand(command="economy", description="⭐ Экономика"),
        ]
        for aid in admin_ids:
            try:
                await bot.set_my_commands(admin_cmds, scope=BotCommandScopeChat(chat_id=aid))
            except Exception:
                pass

    logger.info("CupidBot started (polling)")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())
