from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    webapp_url = __import__("os").environ.get("WEBAPP_URL", "https://t.me/CupidBotApp")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="💕 Найти пару",
            web_app=__import__("aiogram.types", fromlist=["WebAppInfo"]).WebAppInfo(url=webapp_url),
        )
    ]])
    await message.answer(
        "❤️ *CupidBot* — знакомства в Telegram\n\n"
        "Свайпай анкеты, находи совпадения и общайся прямо здесь.\n\n"
        "👇 Нажми кнопку ниже чтобы начать!",
        parse_mode="Markdown",
        reply_markup=kb,
    )
