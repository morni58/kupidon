"""God Mode admin handlers — only for ADMIN_IDS."""
import os
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

router = Router()

ADMIN_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ──── /user ────
@router.message(Command("user"))
async def cmd_user(message: Message):
    if not is_admin(message.from_user.id):
        return

    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Usage: /user <id_or_@username>")
        return

    identifier = args[1].strip().lstrip("@")
    db = await _get_db()
    from sqlalchemy import select
    from app.models.user import User
    try:
        uid = int(identifier)
        q = select(User).where(User.tg_id == uid)
    except ValueError:
        q = select(User).where(User.username == identifier)

    result = await db.execute(q)
    user = result.scalar_one_or_none()
    await db.close()

    if not user:
        await message.answer("User not found.")
        return

    text = (
        f"👤 *{user.name}* (@{user.username or 'none'})\n"
        f"ID: `{user.id}`  TG: `{user.tg_id}`\n"
        f"Tier: *{user.tier.value}*  Stars: {user.stars_balance}\n"
        f"Verified: {'✅' if user.is_verified else '❌'}  "
        f"18+: {'🔞' if user.is_18_mode_active else '—'}\n"
        f"Shadow: {'👻' if user.is_shadowbanned else '—'}  "
        f"Banned: {'🚫' if user.is_banned else '—'}\n"
        f"Score: {user.profile_score}  Trust: {user.trust_score}\n"
        f"Streak: {user.streak_days} days"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="💎 Kupidon", callback_data=f"admin:kupidon:{user.id}"),
            InlineKeyboardButton(text="🌟 +Stars", callback_data=f"admin:stars:{user.id}"),
        ],
        [
            InlineKeyboardButton(text="✅ Verified toggle", callback_data=f"admin:verify:{user.id}"),
            InlineKeyboardButton(text="🔞 18+ toggle", callback_data=f"admin:18plus:{user.id}"),
        ],
        [
            InlineKeyboardButton(text="👻 Shadow Ban", callback_data=f"admin:shadow:{user.id}"),
            InlineKeyboardButton(text="👑 Oligarch toggle", callback_data=f"admin:oligarch:{user.id}"),
        ],
        [
            InlineKeyboardButton(text="🚫 Ban", callback_data=f"admin:ban:{user.id}"),
        ],
    ])
    await message.answer(text, parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data.startswith("admin:"))
async def admin_action(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer("Access denied")
        return

    _, action, user_id = call.data.split(":", 2)
    db = await _get_db()
    from sqlalchemy import select
    from app.models.user import User, TierEnum
    import uuid

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        await call.answer("User not found")
        return

    msg = ""
    if action == "kupidon":
        user.tier = TierEnum.kupidon
        user.swipes_left = 500
        user.superlikes_left = 5
        user.is_oligarch_mode = True
        msg = f"✅ {user.name} upgraded to Kupidon"
    elif action == "stars":
        user.stars_balance += 100
        msg = f"🌟 +100 Stars → {user.name}"
    elif action == "verify":
        user.is_verified = not user.is_verified
        msg = f"{'✅ Verified' if user.is_verified else '❌ Unverified'}: {user.name}"
    elif action == "18plus":
        user.is_18_mode_active = not user.is_18_mode_active
        msg = f"18+ mode {'ON' if user.is_18_mode_active else 'OFF'} for {user.name}"
    elif action == "shadow":
        user.is_shadowbanned = not user.is_shadowbanned
        msg = f"👻 Shadow ban {'ON' if user.is_shadowbanned else 'OFF'}: {user.name}"
    elif action == "oligarch":
        user.is_oligarch_mode = not user.is_oligarch_mode
        msg = f"👑 Oligarch mode {'ON' if user.is_oligarch_mode else 'OFF'}: {user.name}"
    elif action == "ban":
        user.is_banned = not user.is_banned
        msg = f"{'🚫 Banned' if user.is_banned else '✅ Unbanned'}: {user.name}"

    await db.commit()
    await db.close()
    await call.answer(msg)
    await call.message.reply(msg)


# ──── /tags ────
@router.message(Command("tags"))
async def cmd_tags(message: Message):
    if not is_admin(message.from_user.id):
        return
    parts = message.text.split("|")
    if len(parts) < 2:
        await message.answer("Usage: /tags Name | #HEX | emoji")
        return
    name = parts[0].replace("/tags", "").strip()
    color = parts[1].strip() if len(parts) > 1 else "#FF00FF"
    emoji = parts[2].strip() if len(parts) > 2 else None

    db = await _get_db()
    from app.models.tag import AdminTag
    tag = AdminTag(name=name, color_hex=color, emoji=emoji, is_18_only=False)
    db.add(tag)
    await db.commit()
    await db.close()
    await message.answer(f"✅ Tag created: {emoji or ''} {name}")


# ──── /tags18 ────
@router.message(Command("tags18"))
async def cmd_tags18(message: Message):
    if not is_admin(message.from_user.id):
        return
    parts = message.text.split("|")
    if len(parts) < 2:
        await message.answer("Usage: /tags18 Name | #HEX | emoji")
        return
    name = parts[0].replace("/tags18", "").strip()
    color = parts[1].strip() if len(parts) > 1 else "#FF3333"
    emoji = parts[2].strip() if len(parts) > 2 else None

    db = await _get_db()
    from app.models.tag import AdminTag
    tag = AdminTag(name=name, color_hex=color, emoji=emoji, is_18_only=True)
    db.add(tag)
    await db.commit()
    await db.close()
    await message.answer(f"✅ 18+ tag created: {emoji or ''} {name}")


# ──── /economy ────
@router.message(Command("economy"))
async def cmd_economy(message: Message):
    if not is_admin(message.from_user.id):
        return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 3:
        await message.answer("Usage: /economy key value")
        return
    key, value = parts[1], parts[2]
    db = await _get_db()
    from app.services.economy import set_config_value
    await set_config_value(db, key, value)
    await db.close()
    await message.answer(f"✅ Config updated: {key} = {value}")


# ──── /reports ────
@router.message(Command("reports"))
async def cmd_reports(message: Message):
    if not is_admin(message.from_user.id):
        return
    db = await _get_db()
    from sqlalchemy import select
    from app.models.safety import Report, ReportStatusEnum
    from app.models.user import User

    result = await db.execute(
        select(Report)
        .where(Report.status == ReportStatusEnum.open)
        .order_by(Report.created_at.desc())
        .limit(10)
    )
    reports = result.scalars().all()
    await db.close()

    if not reports:
        await message.answer("No open reports.")
        return

    for r in reports:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🚫 Ban", callback_data=f"admin:ban:{r.target_id}"),
            InlineKeyboardButton(text="✅ Dismiss", callback_data=f"report:dismiss:{r.id}"),
        ]])
        await message.answer(
            f"Report {r.id}\nTarget: {r.target_id}\nReason: {r.reason.value}",
            reply_markup=kb
        )


@router.callback_query(F.data.startswith("report:dismiss:"))
async def dismiss_report(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    report_id = call.data.split(":", 2)[2]
    db = await _get_db()
    from sqlalchemy import select
    from app.models.safety import Report, ReportStatusEnum
    import uuid
    result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
    r = result.scalar_one_or_none()
    if r:
        r.status = ReportStatusEnum.dismissed
        await db.commit()
    await db.close()
    await call.answer("Dismissed")


# ──── /tagreqs ────
@router.message(Command("tagreqs"))
async def cmd_tagreqs(message: Message):
    if not is_admin(message.from_user.id):
        return
    db = await _get_db()
    from sqlalchemy import select
    from app.models.tag import TagRequest, TagRequestStatusEnum
    result = await db.execute(
        select(TagRequest).where(TagRequest.status == TagRequestStatusEnum.pending)
        .order_by(TagRequest.created_at).limit(10)
    )
    reqs = result.scalars().all()
    await db.close()
    if not reqs:
        await message.answer("Нет заявок на теги.")
        return
    for r in reqs:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Одобрить", callback_data=f"tagreq:approve:{r.id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"tagreq:reject:{r.id}"),
        ]])
        cat = f" · {r.category}" if r.category else ""
        flag = " 🔞" if r.is_18_only else ""
        await message.answer(f"🏷️ {r.emoji or ''} *{r.name}*{cat}{flag}\nЦвет: {r.color_hex}",
                             parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data.startswith("tagreq:"))
async def tagreq_action(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer("Access denied")
        return
    _, action, req_id = call.data.split(":", 2)
    import uuid
    db = await _get_db()
    from sqlalchemy import select
    from app.models.tag import TagRequest, AdminTag, TagRequestStatusEnum
    from app.models.user import User
    from app.services.economy import get_config_value

    r = (await db.execute(select(TagRequest).where(TagRequest.id == uuid.UUID(req_id)))).scalar_one_or_none()
    if not r or r.status != TagRequestStatusEnum.pending:
        await db.close()
        await call.answer("Заявка не найдена/обработана")
        return
    if action == "approve":
        db.add(AdminTag(name=r.name, color_hex=r.color_hex, emoji=r.emoji,
                        category=r.category, is_18_only=r.is_18_only, is_active=True))
        r.status = TagRequestStatusEnum.approved
        msg = f"✅ Тег «{r.name}» добавлен"
    else:
        r.status = TagRequestStatusEnum.rejected
        cost = int(await get_config_value(db, "tag_request_stars", "200"))
        user = (await db.execute(select(User).where(User.id == r.user_id))).scalar_one_or_none()
        if user:
            user.stars_balance += cost
        msg = f"❌ Тег «{r.name}» отклонён, {cost}⭐ возвращены"
    await db.commit()
    await db.close()
    await call.answer(msg)
    await call.message.reply(msg)


# ──── /stats ────
@router.message(Command("stats"))
async def cmd_stats(message: Message):
    if not is_admin(message.from_user.id):
        return
    db = await _get_db()
    from sqlalchemy import select, func
    from app.models.user import User, TierEnum
    from app.models.swipe import Swipe
    from datetime import datetime, timezone, timedelta

    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)

    dau = (await db.execute(
        select(func.count(User.id)).where(User.last_active_at >= day_ago)
    )).scalar_one()
    total = (await db.execute(select(func.count(User.id)))).scalar_one()
    premium = (await db.execute(
        select(func.count(User.id)).where(User.tier == TierEnum.premium)
    )).scalar_one()
    kupidon = (await db.execute(
        select(func.count(User.id)).where(User.tier == TierEnum.kupidon)
    )).scalar_one()
    swipes_24h = (await db.execute(
        select(func.count(Swipe.id)).where(Swipe.created_at >= day_ago)
    )).scalar_one()
    await db.close()

    await message.answer(
        f"📊 *CupidBot Stats*\n\n"
        f"DAU: *{dau}*  |  Total: *{total}*\n"
        f"Premium: *{premium}*  |  Kupidon: *{kupidon}*\n"
        f"Swipes 24h: *{swipes_24h}*\n"
        f"Free→Paid: *{round((premium+kupidon)/max(total,1)*100,1)}%*",
        parse_mode="Markdown"
    )


# ──── /ban ────
@router.message(Command("ban"))
async def cmd_ban(message: Message):
    if not is_admin(message.from_user.id):
        return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 2:
        await message.answer("Usage: /ban <tg_id> [reason]")
        return
    tg_id = int(parts[1])
    reason = parts[2] if len(parts) > 2 else "Admin ban"

    db = await _get_db()
    from sqlalchemy import select
    from app.models.user import User
    result = await db.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()
    if not user:
        await db.close()
        await message.answer("User not found.")
        return
    user.is_banned = True
    user.ban_reason = reason
    await db.commit()
    await db.close()
    await message.answer(f"🚫 Banned: {user.name} ({tg_id})\nReason: {reason}")


# ──── DB helper ────
async def _get_db():
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.db.database import async_session_maker
    return async_session_maker()
