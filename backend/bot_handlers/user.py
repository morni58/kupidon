"""CupidBot — full in-chat interface (a second client next to the Mini App).

Browse profiles & swipe, see your likes/matches, your profile & stats, buy
premium with Stars, play Blind Date, export your PDF — all from chat commands
and a persistent reply-keyboard menu. Shares the same DB/services as the API.
"""
import os
import uuid

from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton, WebAppInfo, LabeledPrice,
)
from aiogram.filters import CommandStart, Command
from sqlalchemy import select, or_, and_, func

from app.db.database import async_session_maker
from app.core.media import to_public_url
from app.core.agehelp import calc_age
from app.models.user import User, TierEnum
from app.models.media import MediaSlot
from app.models.tag import AdminTag, UserTag
from app.models.swipe import Swipe
from app.models.match import Match
from app.models.safety import Block

router = Router()

WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://cupidbot-app.netlify.app")

PLAN_BADGE = {"free": "", "premium": "💎 Premium", "kupidon": "👑 Kupidon"}

# Stars products available from chat (mirrors the Mini App pricing).
PRODUCTS = {
    "premium_month": ("💎 Premium на месяц", "200 свайпов/день, Rewind, врывы", 199),
    "kupidon_month": ("👑 Kupidon VIP на месяц", "500 свайпов, Олигарх-режим, 15 врывов", 599),
    "boost": ("🚀 Буст 2 часа", "Поднять анкету в топ", 100),
    "superlike": ("⭐ Суперлайк", "Всплыть первым", 150),
}


# ───────────────────────── helpers ─────────────────────────
async def get_me(db, tg_id: int):
    r = await db.execute(select(User).where(User.tg_id == tg_id))
    return r.scalar_one_or_none()


def main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="💞 Анкеты"), KeyboardButton(text="💌 Лайки")],
            [KeyboardButton(text="💘 Мэтчи"), KeyboardButton(text="👤 Профиль")],
            [KeyboardButton(text="📊 Статистика"), KeyboardButton(text="🎭 Вслепую")],
            [KeyboardButton(text="⭐ Премиум"), KeyboardButton(text="❓ Помощь")],
        ],
        resize_keyboard=True, is_persistent=True, input_field_placeholder="Выбери действие…",
    )


def open_app_kb(text="💕 Открыть приложение") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=text, web_app=WebAppInfo(url=WEBAPP_URL))]])


def menu_kb() -> InlineKeyboardMarkup:
    """The big clickable in-chat menu — every action one tap away."""
    def b(t, d):
        return InlineKeyboardButton(text=t, callback_data=d)
    return InlineKeyboardMarkup(inline_keyboard=[
        [b("💞 Анкеты", "menu:browse"), b("💌 Лайки", "menu:likes")],
        [b("💘 Мэтчи", "menu:matches"), b("👤 Профиль", "menu:me")],
        [b("📊 Статистика", "menu:stats"), b("🎭 Вслепую", "menu:blind")],
        [b("⭐ Премиум", "menu:premium"), b("❓ Помощь", "menu:help")],
        [InlineKeyboardButton(text="💕 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))],
    ])


class _MsgShim:
    """Lets callback buttons reuse the command handlers as if a user typed them
    (from_user = the tapping user, not the bot)."""
    __slots__ = ("from_user", "chat", "bot", "text")

    def __init__(self, call, text=""):
        self.from_user = call.from_user
        self.chat = call.message.chat
        self.bot = call.bot
        self.text = text

    async def answer(self, *args, **kwargs):
        return await self.bot.send_message(self.chat.id, *args, **kwargs)


@router.callback_query(F.data.startswith("menu:"))
async def on_menu(call: CallbackQuery):
    action = call.data.split(":")[1]
    await call.answer()
    handlers = {
        "browse": cmd_browse, "likes": cmd_likes, "matches": cmd_matches, "me": cmd_me,
        "stats": cmd_stats, "blind": cmd_blind, "premium": cmd_premium, "help": cmd_help,
    }
    fn = handlers.get(action)
    if fn:
        await fn(_MsgShim(call))


async def candidate_view(db, cand: User):
    """Return (caption_text, photo_url|None) for a profile card."""
    age = calc_age(cand.birth_date)
    tags_r = await db.execute(
        select(AdminTag).join(UserTag, AdminTag.id == UserTag.tag_id).where(UserTag.user_id == cand.id)
    )
    tags = tags_r.scalars().all()
    media_r = await db.execute(
        select(MediaSlot.media_url).where(MediaSlot.user_id == cand.id).order_by(MediaSlot.slot_index)
    )
    media = [to_public_url(m) for m in media_r.scalars().all() if m]
    photo = next((m for m in media if m and not m.lower().endswith((".mp4", ".webm", ".mov"))), None)

    city = None
    if cand.city_id:
        from app.models.city import City
        city = (await db.execute(select(City.name).where(City.id == cand.city_id))).scalar_one_or_none()

    head = f"{cand.name}, {age}" if age else cand.name
    if cand.is_verified:
        head += " ✅"
    badge = PLAN_BADGE.get(cand.tier.value if cand.tier else "free", "")
    if badge:
        head += f"  ·  {badge}"

    lines = [head]
    meta = []
    if city:
        meta.append(f"📍 {city}")
    meta.append(f"⭐ {cand.profile_score or 0}/100")
    lines.append("   ".join(meta))
    if tags:
        lines.append(" ".join(f"{t.emoji or '🏷'} {t.name}" for t in tags[:6]))
    if cand.bio:
        lines.append("")
        lines.append(cand.bio[:350])
    prompts = cand.prompts or {}
    PROMPT_LBL = {"green_flags": "🟢", "red_flags": "🔴", "ideal_date": "💞", "looking_for": "🔎", "weakness": "🍦"}
    extra = [f"{ic} {prompts[k]}" for k, ic in PROMPT_LBL.items() if (prompts.get(k) or "").strip()]
    if extra:
        lines.append("")
        lines.extend(extra[:3])
    return "\n".join(lines), photo


def card_kb(target_id, source: str) -> InlineKeyboardMarkup:
    s = "k" if source == "likes" else "e"
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="👎", callback_data=f"fd:l:{target_id}:{s}"),
            InlineKeyboardButton(text="⭐", callback_data=f"fd:s:{target_id}:{s}"),
            InlineKeyboardButton(text="❤️", callback_data=f"fd:r:{target_id}:{s}"),
        ],
        [
            InlineKeyboardButton(text="🚩 Жалоба", callback_data=f"fd:rep:{target_id}:{s}"),
            InlineKeyboardButton(text="⏹ Стоп", callback_data="fd:x"),
        ],
    ])


async def next_candidate(db, me: User, source: str):
    if source == "likes":
        swiped_sq = select(Swipe.target_id).where(Swipe.actor_id == me.id)
        blocked = select(Block.blocked_id).where(Block.blocker_id == me.id)
        blocking = select(Block.blocker_id).where(Block.blocked_id == me.id)
        q = (
            select(User).join(Swipe, Swipe.actor_id == User.id)
            .where(Swipe.target_id == me.id, Swipe.action_type.in_(["right", "superlike"]))
            .where(User.is_banned == False, User.is_deleted == False)
            .where(User.id.not_in(swiped_sq)).where(User.id.not_in(blocked)).where(User.id.not_in(blocking))
            .order_by(Swipe.created_at.desc()).limit(1)
        )
        return (await db.execute(q)).scalars().first()
    from app.services.matching import get_feed
    cands = await get_feed(db, me, limit=1)
    return cands[0] if cands else None


async def send_card(bot, chat_id: int, me: User, source: str, db):
    cand = await next_candidate(db, me, source)
    if not cand:
        txt = ("💌 Пока новых лайков нет — но они придут!" if source == "likes"
               else "🍃 Анкеты на сегодня закончились. Загляни позже или расширь поиск в приложении.")
        await bot.send_message(chat_id, txt, reply_markup=open_app_kb("Открыть приложение"))
        return
    caption, photo = await candidate_view(db, cand)
    kb = card_kb(cand.id, source)
    if photo:
        try:
            await bot.send_photo(chat_id, photo, caption=caption, reply_markup=kb, parse_mode=None)
            return
        except Exception:
            pass
    await bot.send_message(chat_id, caption, reply_markup=kb, parse_mode=None)


# ───────────────────────── commands ─────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
    hello = (
        "❤️ *Добро пожаловать в CupidBot!*\n\n"
        "Знакомства, которые работают *прямо здесь, в чате*:\n"
        "• 💞 смотри анкеты и свайпай кнопками\n"
        "• 💌 лайкай в ответ — будет мэтч\n"
        "• 🎭 «Свидание вслепую» каждый вечер\n\n"
        "Жми любую кнопку ниже 👇 — всё просто."
    )
    # Menu lives both as a tappable inline grid AND the persistent keyboard below.
    await message.answer(hello, reply_markup=menu_kb())
    await message.answer("Меню всегда под рукой 👇", reply_markup=main_menu())
    if not me or not me.birth_date:
        await message.answer("⚠️ Сначала создай анкету — это займёт минуту.", reply_markup=open_app_kb("Создать анкету"))


@router.message(Command("help"))
@router.message(F.text == "❓ Помощь")
async def cmd_help(message: Message):
    await message.answer(
        "📖 *Что я умею*\n\n"
        "💞 /browse — смотреть анкеты и свайпать прямо в чате\n"
        "💌 /likes — кто лайкнул тебя (лайкни в ответ = мэтч)\n"
        "💘 /matches — твои совпадения\n"
        "👤 /me — твоя анкета\n"
        "📊 /stats — твоя статистика\n"
        "🎭 /blind — свидание вслепую\n"
        "⭐ /premium — Premium/Kupidon и буст за Stars\n"
        "📄 /export — выгрузить профиль в PDF (придёт сюда файлом)\n"
        "⚙️ /settings — режимы (18+, невидимость, щит)\n"
        "🍀 /lucky — случайная анкета одним тапом\n\n"
        "👇 Или просто тапай кнопки — ничего печатать не нужно.",
        reply_markup=menu_kb(),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message):
    await message.answer("📋 *Меню CupidBot* — выбирай 👇", reply_markup=menu_kb())


@router.message(Command("browse"))
@router.message(Command("feed"))
@router.message(F.text == "💞 Анкеты")
async def cmd_browse(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me or not me.birth_date:
            await message.answer("⚠️ Сначала создай анкету в приложении.", reply_markup=open_app_kb("Создать анкету"))
            return
        await message.answer("💞 Поехали! Свайпай кнопками под анкетой:")
        await send_card(message.bot, message.chat.id, me, "feed", db)


@router.message(Command("lucky"))
@router.message(F.text == "🍀 Удача")
async def cmd_lucky(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me or not me.birth_date:
            await message.answer("⚠️ Сначала создай анкету в приложении.", reply_markup=open_app_kb("Создать анкету"))
            return
        await send_card(message.bot, message.chat.id, me, "feed", db)


@router.message(Command("likes"))
@router.message(F.text == "💌 Лайки")
async def cmd_likes(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me:
            await message.answer("Открой приложение, чтобы создать анкету.", reply_markup=open_app_kb())
            return
        cnt = (await db.execute(
            select(func.count(func.distinct(Swipe.actor_id))).where(
                Swipe.target_id == me.id, Swipe.action_type.in_(["right", "superlike"]),
                Swipe.actor_id.not_in(select(Swipe.target_id).where(Swipe.actor_id == me.id)),
            )
        )).scalar_one()
        if not cnt:
            await message.answer("💌 Пока тебя никто не лайкнул из новых — но скоро это изменится 😉", reply_markup=main_menu())
            return
        await message.answer(f"💌 Тебя лайкнули: *{cnt}*\nЛайкни в ответ — будет мэтч!")
        await send_card(message.bot, message.chat.id, me, "likes", db)


@router.message(Command("matches"))
@router.message(F.text == "💘 Мэтчи")
async def cmd_matches(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me:
            await message.answer("Открой приложение, чтобы создать анкету.", reply_markup=open_app_kb())
            return
        rows = (await db.execute(
            select(Match).where(or_(Match.user1_id == me.id, Match.user2_id == me.id))
            .order_by(Match.created_at.desc()).limit(20)
        )).scalars().all()
        if not rows:
            await message.answer("💘 Мэтчей пока нет. Полайкай анкеты — /browse", reply_markup=main_menu())
            return
        lines = ["💘 *Твои мэтчи:*\n"]
        for m in rows:
            pid = m.user2_id if m.user1_id == me.id else m.user1_id
            p = (await db.execute(select(User).where(User.id == pid))).scalar_one_or_none()
            if not p or p.is_deleted:
                continue
            age = calc_age(p.birth_date)
            tag = "🎭 Вслепую" if m.is_blind else ""
            lines.append(f"• {p.name}{', ' + str(age) if age else ''} {tag}")
        lines.append("\nОбщаться — в приложении (там чат, фото, голос).")
        await message.answer("\n".join(lines), reply_markup=open_app_kb("💬 Открыть чаты"))


@router.message(Command("me"))
@router.message(Command("profile"))
@router.message(F.text == "👤 Профиль")
async def cmd_me(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me or not me.birth_date:
            await message.answer("⚠️ Анкеты ещё нет — создай в приложении.", reply_markup=open_app_kb("Создать анкету"))
            return
        caption, photo = await candidate_view(db, me)
        caption = "👤 *Так выглядит твоя анкета:*\n\n" + caption
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="✏️ Редактировать", web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton(text="📄 Выгрузить в PDF", callback_data="exp:pdf")],
        ])
        if photo:
            try:
                await message.bot.send_photo(message.chat.id, photo, caption=caption, reply_markup=kb, parse_mode=None)
                return
            except Exception:
                pass
        await message.answer(caption, reply_markup=kb, parse_mode=None)


@router.message(Command("stats"))
@router.message(F.text == "📊 Статистика")
async def cmd_stats(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me:
            await message.answer("Открой приложение, чтобы создать анкету.", reply_markup=open_app_kb())
            return
        from app.services.stats import compute_user_stats
        s = await compute_user_stats(db, me, private=True)
    await message.answer(
        "📊 *Твоя статистика*\n\n"
        f"💘 Мэтчей: *{s['matches']}*\n"
        f"❤️ Лайков получено: *{s['likes_received']}*\n"
        f"💗 Лайков отправлено: *{s['likes_given']}*\n"
        f"🎯 Мэтч-рейт: *{s['match_rate']}%*\n"
        f"👀 Просмотров профиля: *{s['views_received']}*\n"
        f"🔥 Серия: *{s['streak_days']}* дн.\n"
        f"📅 С нами: *{s['days_with_us']}* дн.\n"
        f"⭐ Рейтинг анкеты: *{s['profile_score']}/100*\n",
        reply_markup=main_menu(),
    )


@router.message(Command("premium"))
@router.message(F.text == "⭐ Премиум")
async def cmd_premium(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"{PRODUCTS['premium_month'][0]} — {PRODUCTS['premium_month'][2]}⭐", callback_data="buy:premium_month")],
        [InlineKeyboardButton(text=f"{PRODUCTS['kupidon_month'][0]} — {PRODUCTS['kupidon_month'][2]}⭐", callback_data="buy:kupidon_month")],
        [InlineKeyboardButton(text=f"{PRODUCTS['boost'][0]} — {PRODUCTS['boost'][2]}⭐", callback_data="buy:boost"),
         InlineKeyboardButton(text=f"{PRODUCTS['superlike'][0]} — {PRODUCTS['superlike'][2]}⭐", callback_data="buy:superlike")],
    ])
    await message.answer(
        "⭐ *Прокачай знакомства*\n\n"
        "💎 *Premium* — 200 свайпов/день, откат свайпа, врывы, видно кто смотрел.\n"
        "👑 *Kupidon* — 500 свайпов, режим Олигарх, TG сразу, 15 врывов.\n\n"
        "Оплата — звёздами Telegram ⭐",
        reply_markup=kb,
    )


@router.message(Command("blind"))
@router.message(F.text == "🎭 Вслепую")
async def cmd_blind(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎲 Найти незнакомца", callback_data="bl:join")],
        [InlineKeyboardButton(text="Открыть в приложении", web_app=WebAppInfo(url=WEBAPP_URL))],
    ])
    await message.answer(
        "🎭 *Свидание вслепую*\n\n"
        "Один незнакомец в день по совместимости. Фото и имя скрыты — только вайб: "
        "музыка, интересы, пара честных строк. Понравитесь — раскроетесь.",
        reply_markup=kb,
    )


@router.message(Command("export"))
async def cmd_export(message: Message):
    await _do_export(message.bot, message.chat.id, message.from_user.id)


@router.message(Command("settings"))
@router.message(F.text == "⚙️ Настройки")
async def cmd_settings(message: Message):
    async with async_session_maker() as db:
        me = await get_me(db, message.from_user.id)
        if not me:
            await message.answer("Открой приложение, чтобы создать анкету.", reply_markup=open_app_kb())
            return
        await message.answer("⚙️ *Режимы*", reply_markup=settings_kb(me))


def settings_kb(me: User) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(
        text=("🔞 Комната 18+: ВКЛ" if me.is_18_mode_active else "🔞 Комната 18+: выкл"),
        callback_data="set:18")]]
    if me.is_oligarch_mode:
        rows.append([InlineKeyboardButton(
            text=("🕵️ Невидимость: ВКЛ" if me.is_stealth_mode else "🕵️ Невидимость: выкл"),
            callback_data="set:stealth")])
    if me.gender and me.gender.value == "female":
        rows.append([InlineKeyboardButton(
            text=("🛡️ Анти-Олигарх щит: ВКЛ" if me.is_anti_oligarch else "🛡️ Анти-Олигарх щит: выкл"),
            callback_data="set:shield")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ───────────────────────── callbacks ─────────────────────────
@router.callback_query(F.data.startswith("fd:"))
async def on_feed_action(call: CallbackQuery):
    parts = call.data.split(":")
    action = parts[1]
    if action == "x":
        await call.answer("Остановил 👍")
        try: await call.message.edit_reply_markup(reply_markup=None)
        except Exception: pass
        return
    target_id = parts[2]
    source = "likes" if (len(parts) > 3 and parts[3] == "k") else "feed"

    if action == "rep":
        await call.answer("Спасибо, отправили на модерацию 🚩", show_alert=False)
        try:
            async with async_session_maker() as db:
                me = await get_me(db, call.from_user.id)
                from app.models.safety import Report
                db.add(Report(reporter_id=me.id, target_id=uuid.UUID(target_id), reason="abuse", note="via bot"))
                await db.commit()
        except Exception:
            pass
        try: await call.message.delete()
        except Exception: pass
        async with async_session_maker() as db:
            me = await get_me(db, call.from_user.id)
            await send_card(call.bot, call.message.chat.id, me, source, db)
        return

    amap = {"l": "left", "r": "right", "s": "superlike"}
    act = amap.get(action)
    if not act:
        await call.answer(); return

    async with async_session_maker() as db:
        me = await get_me(db, call.from_user.id)
        if not me:
            await call.answer("Создай анкету в приложении", show_alert=True); return
        from app.services.matching import handle_swipe
        try:
            result = await handle_swipe(db, me, uuid.UUID(target_id), act)
        except Exception:
            result = {"error": "fail"}

        if "error" in result:
            err = result["error"]
            if err == "swipe_limit":
                await call.answer("Свайпы на сегодня кончились. /premium даёт больше ⭐", show_alert=True)
            elif err == "superlike_limit":
                await call.answer("Суперлайки кончились — купи в /premium ⭐", show_alert=True)
            else:
                await call.answer("Не получилось, попробуй ещё", show_alert=False)
            return

        # success notifications to the other side
        target = (await db.execute(select(User).where(User.id == uuid.UUID(target_id)))).scalar_one_or_none()
        from app.services import notifications as notif
        matched = result.get("is_match")
        if target and not me.is_shadowbanned:
            if matched:
                import asyncio
                asyncio.create_task(notif.notify_match(target.tg_id, me.name))
            elif act == "superlike":
                import asyncio
                asyncio.create_task(notif.notify_superlike(target.tg_id))
            elif act == "right":
                import asyncio
                asyncio.create_task(notif.notify_like(target.tg_id))

        try: await call.message.delete()
        except Exception: pass

        if matched:
            await call.answer("💘 Это мэтч!")
            await call.bot.send_message(
                call.message.chat.id,
                f"💘 *Мэтч с {target.name if target else 'кем-то'}!* Можете начать общение.",
                reply_markup=open_app_kb("💬 Перейти в чат"),
            )
        else:
            await call.answer({"left": "👎", "right": "❤️", "superlike": "⭐"}.get(act, "✓"))
        await send_card(call.bot, call.message.chat.id, me, source, db)


@router.callback_query(F.data.startswith("set:"))
async def on_setting(call: CallbackQuery):
    field = call.data.split(":")[1]
    async with async_session_maker() as db:
        me = await get_me(db, call.from_user.id)
        if not me:
            await call.answer("Создай анкету", show_alert=True); return
        if field == "18":
            if not me.is_18_mode_active:
                if calc_age(me.birth_date) and calc_age(me.birth_date) < 18:
                    await call.answer("Режим 18+ доступен с 18 лет", show_alert=True); return
                if not me.is_verified:
                    await call.answer("Сначала пройди верификацию в приложении", show_alert=True); return
            me.is_18_mode_active = not me.is_18_mode_active
        elif field == "stealth":
            me.is_stealth_mode = not me.is_stealth_mode
        elif field == "shield":
            me.is_anti_oligarch = not me.is_anti_oligarch
        await db.commit()
        await call.answer("Готово ✅")
        try: await call.message.edit_reply_markup(reply_markup=settings_kb(me))
        except Exception: pass


@router.callback_query(F.data.startswith("buy:"))
async def on_buy(call: CallbackQuery):
    product = call.data.split(":")[1]
    if product not in PRODUCTS:
        await call.answer(); return
    title, desc, stars = PRODUCTS[product]
    async with async_session_maker() as db:
        me = await get_me(db, call.from_user.id)
        if not me:
            await call.answer("Создай анкету", show_alert=True); return
        from app.models.payment import Payment, PaymentStatusEnum
        payload = f"{me.id}:{product}:{uuid.uuid4()}"
        db.add(Payment(user_id=me.id, invoice_payload=payload, stars=stars, product=product, status=PaymentStatusEnum.pending))
        await db.commit()
    await call.answer()
    await call.bot.send_invoice(
        chat_id=call.message.chat.id, title=title, description=desc, payload=payload,
        provider_token="", currency="XTR", prices=[LabeledPrice(label=title, amount=stars)],
    )


@router.callback_query(F.data.startswith("bl:"))
async def on_blind(call: CallbackQuery):
    action = call.data.split(":")[1]
    if action != "join":
        await call.answer(); return
    await call.answer()
    async with async_session_maker() as db:
        me = await get_me(db, call.from_user.id)
        if not me or not me.birth_date:
            await call.bot.send_message(call.message.chat.id, "⚠️ Сначала создай анкету в приложении.", reply_markup=open_app_kb("Создать анкету"))
            return
        from fastapi import HTTPException
        from app.api.blind import blind_join
        try:
            res = await blind_join(db=db, me=me)   # reuse the exact pairing logic
        except HTTPException as e:
            await call.bot.send_message(call.message.chat.id, f"🎭 {e.detail}")
            return
        except Exception:
            await call.bot.send_message(call.message.chat.id, "Не удалось сейчас, попробуй позже.")
            return
    if res.get("status") == "matched":
        await call.bot.send_message(
            call.message.chat.id,
            "🎭 *Пара найдена!* Незнакомец ждёт. Открой приложение — там карточка вслепую, гимн и кнопка «Раскрыться».",
            reply_markup=open_app_kb("Открыть Свидание вслепую"))
    else:
        await call.bot.send_message(
            call.message.chat.id,
            "🔮 Ищем тебе пару… Как только найдём — пришлём уведомление. Можно закрыть чат.",
            reply_markup=open_app_kb("Открыть приложение"))


@router.callback_query(F.data == "exp:pdf")
async def on_export_cb(call: CallbackQuery):
    await call.answer("Собираю PDF…")
    await _do_export(call.bot, call.message.chat.id, call.from_user.id)


async def _do_export(bot, chat_id: int, tg_id: int):
    async with async_session_maker() as db:
        me = await get_me(db, tg_id)
        if not me or not me.birth_date:
            await bot.send_message(chat_id, "⚠️ Сначала создай анкету в приложении.", reply_markup=open_app_kb("Создать анкету"))
            return
        try:
            from app.models.city import City
            from app.services.pdf_export import build_profile_pdf, _disk_path
            from app.services.stats import compute_user_stats
            city = (await db.execute(select(City.name).where(City.id == me.city_id))).scalar_one_or_none() if me.city_id else None
            media = (await db.execute(select(MediaSlot.media_url).where(MediaSlot.user_id == me.id).order_by(MediaSlot.slot_index))).scalars().all()
            photo_paths = [p for p in (_disk_path(u) for u in media if u) if p]
            tag_names = (await db.execute(select(AdminTag.name).join(UserTag, AdminTag.id == UserTag.tag_id).where(UserTag.user_id == me.id))).scalars().all()
            stats = await compute_user_stats(db, me, private=True)
            profile = {
                "name": me.name, "birth_date": me.birth_date, "city_name": city,
                "tier": me.tier.value if me.tier else "free", "is_verified": me.is_verified,
                "bio": me.bio, "prompts": me.prompts or {},
                "anthem_url": me.anthem_url, "anthem_title": me.anthem_title,
            }
            pdf = build_profile_pdf(profile=profile, stats=stats, tag_names=list(tag_names), photo_paths=photo_paths)
        except Exception:
            await bot.send_message(chat_id, "Не удалось собрать PDF, попробуй позже.")
            return
    from aiogram.types import BufferedInputFile
    await bot.send_document(chat_id, BufferedInputFile(pdf, filename="CupidBot_profile.pdf"), caption="📄 Твой профиль в CupidBot 💘")
