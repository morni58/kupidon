"""Staff power-tools: role management, donations, broadcast, search.

Layered on top of bot_handlers/perms.py. Owners manage admins; admins manage
moderators, give donations/premium, broadcast; moderators get safety tools
(in admin.py). Every command is rank-checked.
"""
import asyncio
import uuid

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from sqlalchemy import select, or_, func

from app.db.database import async_session_maker
from app.models.user import User, TierEnum
from bot_handlers.perms import (
    require, level_of, resolve_user, role_level_of_user,
    MOD, ADMIN, OWNER, ROLE_RU, ROLE_LEVEL,
)

router = Router()

GIVE_ALIASES = {
    "premium": "premium_month", "премиум": "premium_month",
    "kupidon": "kupidon_month", "купидон": "kupidon_month", "вип": "kupidon_month",
    "boost": "boost", "буст": "boost",
    "superlike": "superlike", "суперлайк": "superlike",
    "forcechat": "force_chat", "врыв": "force_chat",
    "vip": "vip_signal", "vipsignal": "vip_signal",
}


async def _notify(tg_id: int, text: str):
    try:
        from app.services import notifications as notif
        await notif.send_push(tg_id, text)
    except Exception:
        pass


async def _actor(db, tg_id: int):
    """Load the staff member's User row (for audit attribution)."""
    return (await db.execute(select(User).where(User.tg_id == tg_id))).scalar_one_or_none()


# ─────────────────────── role management ───────────────────────
@router.message(Command("staffhelp"))
async def cmd_staffhelp(message: Message):
    if not await require(message, MOD):
        return
    lvl = await level_of(message.from_user.id)
    mod = (
        "🛡️ *Модерация* (модератор+)\n"
        "/reports — очередь жалоб\n"
        "/verifyqueue — заявки на галочку\n"
        "/user <id|@> — карточка пользователя\n"
        "/find <текст> — поиск · /recent — новые\n"
        "/ban <id|@> [причина] · /unban <id|@>\n"
        "/warn <id|@> · /mute <id|@> <ч> · /unmute <id|@>\n"
        "/audit — журнал действий · /adstats — статистика\n"
    )
    adm = (
        "\n⭐ *Админ*\n"
        "/give <id|@> <премиум|купидон|буст|суперлайк|врыв> [дней]\n"
        "/stars <id|@> <±N> — изменить баланс Stars\n"
        "/setlimit <id|@> <swipes|superlikes> <N>\n"
        "/tags · /tags18 · /tagreqs · /economy <key> <val>\n"
        "/broadcast <текст> — рассылка всем\n"
        "/grant <id|@> <moderator|admin> · /revoke <id|@>\n"
        "/staff — список персонала\n"
    )
    txt = mod + (adm if lvl >= ADMIN else "")
    await message.answer(txt)


@router.message(Command("staff"))
async def cmd_staff(message: Message):
    if not await require(message, ADMIN):
        return
    async with async_session_maker() as db:
        rows = (await db.execute(
            select(User).where(User.role.in_(["moderator", "admin"])).order_by(User.role.desc())
        )).scalars().all()
    from bot_handlers.perms import OWNER_IDS
    lines = ["👮 *Персонал:*\n"]
    if OWNER_IDS:
        lines.append("👑 *Владельцы:* " + ", ".join(f"`{i}`" for i in OWNER_IDS) + "\n")
    if not rows:
        lines.append("_Назначенных админов/модераторов пока нет._")
    for u in rows:
        lines.append(f"{ROLE_RU.get(u.role, u.role)} — {u.name} (@{u.username or '—'}) `{u.tg_id}`")
    await message.answer("\n".join(lines))


@router.message(Command("role"))
async def cmd_role(message: Message):
    if not await require(message, MOD):
        return
    parts = message.text.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Usage: /role <id|@username>"); return
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        eff = await role_level_of_user(u)
        from bot_handlers.perms import LEVEL_NAME
        await message.answer(f"{u.name} (@{u.username or '—'}): *{ROLE_RU.get(LEVEL_NAME[eff], 'user')}*")


@router.message(Command("grant"))
async def cmd_grant(message: Message):
    if not await require(message, ADMIN):
        return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 3:
        await message.answer("Usage: /grant <id|@username> <moderator|admin>"); return
    target_role = parts[2].strip().lower()
    if target_role in ("мод", "модератор"):
        target_role = "moderator"
    if target_role in ("админ",):
        target_role = "admin"
    if target_role not in ("moderator", "admin"):
        await message.answer("Роль: moderator или admin"); return

    actor_lvl = await level_of(message.from_user.id)
    grant_lvl = ROLE_LEVEL[target_role]
    # Only owners can grant admin; you can never grant a role >= your own level.
    if grant_lvl >= actor_lvl:
        await message.answer("⛔️ Нельзя выдать роль уровня выше или равного своему."); return
    if target_role == "admin" and actor_lvl < OWNER:
        await message.answer("⛔️ Назначать админов может только владелец."); return

    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Пользователь не найден (он должен был зайти в бота)."); return
        from bot_handlers.perms import OWNER_IDS
        if u.tg_id in OWNER_IDS:
            await message.answer("Это владелец — роль менять не нужно."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        await sa.act_set_role(db, actor, u, target_role)
        await db.commit()
        tg, name = u.tg_id, u.name
    await message.answer(f"✅ {name} теперь {ROLE_RU[target_role]}")
    await _notify(tg, f"🎖️ Тебе выдали роль: {ROLE_RU[target_role]} в CupidBot.")


@router.message(Command("revoke"))
async def cmd_revoke(message: Message):
    if not await require(message, ADMIN):
        return
    parts = message.text.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Usage: /revoke <id|@username>"); return
    actor_lvl = await level_of(message.from_user.id)
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        if await role_level_of_user(u) >= actor_lvl:
            await message.answer("⛔️ Нельзя снять роль с равного/старшего."); return
        if (u.role or "user") == "user":
            await message.answer("У него и так нет роли."); return
        old = u.role
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        await sa.act_set_role(db, actor, u, "user")
        await db.commit()
        tg, name = u.tg_id, u.name
    await message.answer(f"🗑️ Снял роль {ROLE_RU.get(old, old)} с {name}")
    await _notify(tg, "Твоя роль в CupidBot снята.")


# ─────────────────────── donations / economy ───────────────────────
@router.message(Command("give"))
async def cmd_give(message: Message):
    if not await require(message, ADMIN):
        return
    parts = message.text.split()
    if len(parts) < 3:
        await message.answer("Usage: /give <id|@> <премиум|купидон|буст|суперлайк|врыв> [дней]"); return
    product = GIVE_ALIASES.get(parts[2].lower())
    if not product:
        await message.answer("Продукт: премиум, купидон, буст, суперлайк, врыв"); return
    days = None
    if len(parts) > 3:
        try: days = int(parts[3])
        except ValueError: pass
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Пользователь не найден."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        await sa.act_give(db, actor, u, product, days)
        await db.commit()
        name = u.name
    await message.answer(f"🎁 Выдал «{parts[2]}»{f' на {days} дн.' if days else ''} → {name}")


@router.message(Command("stars"))
async def cmd_stars(message: Message):
    if not await require(message, ADMIN):
        return
    parts = message.text.split()
    if len(parts) < 3:
        await message.answer("Usage: /stars <id|@> <±N>"); return
    try:
        amount = int(parts[2])
    except ValueError:
        await message.answer("Сумма должна быть числом (можно со знаком -)."); return
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        msg = await sa.act_stars(db, actor, u, amount)
        await db.commit()
    await message.answer(msg)


@router.message(Command("setlimit"))
async def cmd_setlimit(message: Message):
    if not await require(message, ADMIN):
        return
    parts = message.text.split()
    if len(parts) < 4:
        await message.answer("Usage: /setlimit <id|@> <swipes|superlikes> <N>"); return
    field, raw = parts[2].lower(), parts[3]
    try:
        n = int(raw)
    except ValueError:
        await message.answer("N должно быть числом."); return
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        if field in ("swipes", "свайпы"):
            u.swipes_left = n
        elif field in ("superlikes", "суперлайки"):
            u.superlikes_left = n
        else:
            await message.answer("Поле: swipes или superlikes"); return
        await db.commit()
        name = u.name
    await message.answer(f"✅ {name}: {field} = {n}")


@router.message(Command("unban"))
async def cmd_unban(message: Message):
    if not await require(message, MOD):
        return
    parts = message.text.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Usage: /unban <id|@username>"); return
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        msg = await sa.act_unban(db, actor, u)
        await db.commit()
    await message.answer(msg)


@router.message(Command("warn"))
async def cmd_warn(message: Message):
    if not await require(message, MOD):
        return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 2:
        await message.answer("Usage: /warn <id|@> [причина]"); return
    reason = parts[2] if len(parts) > 2 else ""
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        if await role_level_of_user(u) >= await level_of(message.from_user.id):
            await message.answer("⛔️ Нельзя варнить равного/старшего."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        msg = await sa.act_warn(db, actor, u, reason)
        await db.commit()
    await message.answer(msg)


@router.message(Command("mute"))
async def cmd_mute(message: Message):
    if not await require(message, MOD):
        return
    parts = message.text.split()
    if len(parts) < 3:
        await message.answer("Usage: /mute <id|@> <часов>"); return
    try:
        hours = int(parts[2])
    except ValueError:
        await message.answer("Часы числом."); return
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        if await role_level_of_user(u) >= await level_of(message.from_user.id):
            await message.answer("⛔️ Нельзя мьютить равного/старшего."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        msg = await sa.act_mute(db, actor, u, hours)
        await db.commit()
    await message.answer(msg)


@router.message(Command("unmute"))
async def cmd_unmute(message: Message):
    if not await require(message, MOD):
        return
    parts = message.text.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Usage: /unmute <id|@>"); return
    async with async_session_maker() as db:
        u = await resolve_user(db, parts[1])
        if not u:
            await message.answer("Не найден."); return
        from app.services import staff_actions as sa
        actor = await _actor(db, message.from_user.id)
        msg = await sa.act_unmute(db, actor, u)
        await db.commit()
    await message.answer(msg)


@router.message(Command("audit"))
async def cmd_audit(message: Message):
    if not await require(message, MOD):
        return
    from app.models.safety import StaffAction
    async with async_session_maker() as db:
        rows = (await db.execute(
            select(StaffAction).order_by(StaffAction.created_at.desc()).limit(20)
        )).scalars().all()
    if not rows:
        await message.answer("Лог действий пуст."); return
    lines = ["📜 *Журнал действий:*\n"]
    for a in rows:
        actor = a.actor_name or ("система" if not a.actor_tg else str(a.actor_tg))
        when = a.created_at.strftime("%d.%m %H:%M") if a.created_at else ""
        lines.append(f"`{when}` *{a.action}* · {actor} → {a.target_name or '—'}" + (f" ({a.detail})" if a.detail else ""))
    await message.answer("\n".join(lines))


# ─────────────────────── search ───────────────────────
@router.message(Command("find"))
async def cmd_find(message: Message):
    if not await require(message, MOD):
        return
    parts = message.text.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Usage: /find <имя или @username>"); return
    q = f"%{parts[1].strip().lstrip('@')}%"
    async with async_session_maker() as db:
        rows = (await db.execute(
            select(User).where(or_(User.name.ilike(q), User.username.ilike(q))).limit(15)
        )).scalars().all()
    if not rows:
        await message.answer("Никого не нашёл."); return
    lines = ["🔎 *Результаты:*\n"]
    for u in rows:
        flags = "".join([
            "✅" if u.is_verified else "", "🚫" if u.is_banned else "", "👻" if u.is_shadowbanned else "",
            {"premium": "💎", "kupidon": "👑"}.get(u.tier.value if u.tier else "", ""),
        ])
        lines.append(f"• {u.name} (@{u.username or '—'}) `{u.tg_id}` {flags}")
    lines.append("\nКарточка: /user <tg_id>")
    await message.answer("\n".join(lines))


@router.message(Command("recent"))
async def cmd_recent(message: Message):
    if not await require(message, MOD):
        return
    async with async_session_maker() as db:
        rows = (await db.execute(
            select(User).where(User.birth_date.isnot(None)).order_by(User.created_at.desc()).limit(12)
        )).scalars().all()
    lines = ["🆕 *Последние регистрации:*\n"]
    for u in rows:
        when = u.created_at.strftime("%d.%m %H:%M") if u.created_at else ""
        lines.append(f"• {u.name} (@{u.username or '—'}) `{u.tg_id}` · {when}")
    await message.answer("\n".join(lines))


# ─────────────────────── broadcast ───────────────────────
@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message):
    if not await require(message, ADMIN):
        return
    text = message.text.split(maxsplit=1)
    if len(text) < 2 or not text[1].strip():
        await message.answer("Usage: /broadcast <текст рассылки>"); return
    body = text[1].strip()
    # Stash the body in Redis; the confirm button only carries a short token.
    token = uuid.uuid4().hex[:10]
    try:
        from app.core.redis import get_redis
        redis = await get_redis()
        await redis.set(f"bcast:{message.from_user.id}:{token}", body, ex=600)
    except Exception:
        await message.answer("Не удалось подготовить рассылку (Redis)."); return
    async with async_session_maker() as db:
        total = (await db.execute(select(func.count(User.id)).where(
            User.is_deleted == False, User.is_banned == False))).scalar_one()
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=f"📣 Отправить {total} людям", callback_data=f"bcast:go:{token}"),
        InlineKeyboardButton(text="Отмена", callback_data="bcast:cancel"),
    ]])
    await message.answer(f"Предпросмотр рассылки:\n\n{body}\n\n— отправить *{total}* пользователям?",
                         reply_markup=kb)


@router.callback_query(F.data == "bcast:cancel")
async def bcast_cancel(call: CallbackQuery):
    await call.answer("Отменено")
    try: await call.message.edit_reply_markup(reply_markup=None)
    except Exception: pass


@router.callback_query(F.data.startswith("bcast:go:"))
async def bcast_go(call: CallbackQuery):
    if not await require(call, ADMIN):
        return
    token = call.data.split(":", 2)[2]
    try:
        from app.core.redis import get_redis
        redis = await get_redis()
        body = await redis.get(f"bcast:{call.from_user.id}:{token}")
    except Exception:
        body = None
    if not body:
        await call.answer("Рассылка устарела, повтори /broadcast", show_alert=True); return
    if isinstance(body, bytes):
        body = body.decode()
    await call.answer("Запускаю рассылку…")
    try: await call.message.edit_reply_markup(reply_markup=None)
    except Exception: pass

    async with async_session_maker() as db:
        ids = (await db.execute(select(User.tg_id).where(
            User.is_deleted == False, User.is_banned == False))).scalars().all()

    bot = call.bot
    sent = failed = 0
    for tg in ids:
        try:
            await bot.send_message(tg, body)
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.05)  # ~20 msg/s, stay under Telegram limits
    await bot.send_message(call.message.chat.id, f"✅ Рассылка завершена. Доставлено: {sent}, не доставлено: {failed}")
