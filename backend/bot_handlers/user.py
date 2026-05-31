from aiogram import Router
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart
import os

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    webapp_url = os.environ.get("WEBAPP_URL", "https://cupidbot-app.netlify.app")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💕 Найти пару", web_app=WebAppInfo(url=webapp_url))
    ]])
    await message.answer(
        "❤️ *CupidBot* — знакомства в Telegram\n\n"
        "Свайпай анкеты, находи совпадения и общайся прямо здесь.\n\n"
        "👇 Нажми кнопку ниже чтобы начать!",
        reply_markup=kb,
    )
