"""CupidBot — aiogram 3.x entrypoint."""
import asyncio
import logging
import os
import sys

# Add backend to path for shared models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Also add current directory
sys.path.insert(0, os.path.dirname(__file__))

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.redis import RedisStorage

from handlers.user import router as user_router
from handlers.admin import router as admin_router
from handlers.payments import router as payments_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ["BOT_TOKEN"]
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


async def main():
    storage = RedisStorage.from_url(REDIS_URL)
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN),
    )
    dp = Dispatcher(storage=storage)
    dp.include_router(user_router)
    dp.include_router(admin_router)
    dp.include_router(payments_router)

    # Set bot commands
    from aiogram.types import BotCommand
    await bot.set_my_commands([
        BotCommand(command="start", description="Запустить CupidBot"),
        BotCommand(command="user", description="[Admin] Инфо о пользователе"),
        BotCommand(command="tags", description="[Admin] Добавить тег"),
        BotCommand(command="tags18", description="[Admin] Добавить 18+ тег"),
        BotCommand(command="economy", description="[Admin] Изменить параметр экономики"),
        BotCommand(command="reports", description="[Admin] Очередь репортов"),
        BotCommand(command="tagreqs", description="[Admin] Заявки на теги"),
        BotCommand(command="stats", description="[Admin] Статистика"),
        BotCommand(command="ban", description="[Admin] Забанить пользователя"),
    ])

    logger.info("CupidBot started")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())
