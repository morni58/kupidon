"""God Mode admin handlers — only for ADMIN_IDS."""
import os
import uuid
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command

from app.db.database import async_session_maker

router = Router()
ADMIN_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


@router.message(Command("user"))
async def cmd_user(message: Message):
    if not is_admin(message.from_user.id):
        return
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Usage: /user <id_or_@username>")
        return
    identifier = args[1].strip().lstrip("@")

    from sqlalchemy import select
    from app.models.user import User
    async with async_session_maker() as db:
        try:
            q = select(User).where(User.tg_id == int(identifier))
        except ValueError:
            q = select(User).where(User.username == identifier)
        user = (await db.execute(q)).scalar_one_or_none()

    if not user:
        await message.answer("User not found.")
        return

    text = (
        f"👤 *{user.name}* (@{user.username or 'none'})\n"
        f"ID: `{user.id}`  TG: `{user.tg_id}`\n"
        f"Tier: *{user.tier.value}*  Stars: {user.stars_balance}\n"
        f"Verified: {'✅' if user.is_verified else '❌'}  18+: {'🔞' if user.is_18_mode_active else '—'}\n"
        f"Shadow: {'👻' if user.is_shadowbanned else '—'}  Banned: {'🚫' if user.is_banned else '—'}\n"
        f"Score: {user.profile_score}  Trust: {user.trust_score}  Streak: {user.streak_days}"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💎 Kupidon", callback_data=f"admin:kupidon:{user.id}"),
         InlineKeyboardButton(text="🌟 +100 Stars", callback_data=f"admin:stars:{user.id}")],
        [InlineKeyboardButton(text="✅ Verified", callback_data=f"admin:verify:{user.id}"),
         InlineKeyboardButton(text="🔞 18+", callback_data=f"admin:18plus:{user.id}")],
        [InlineKeyboardButton(text="👻 Shadow", callback_data=f"admin:shadow:{user.id}"),
         InlineKeyboardButton(text="👑 Oligarch", callback_data=f"admin:oligarch:{user.id}")],
        [InlineKeyboardButton(text="🚫 Ban", callback_data=f"admin:ban:{user.id}")],
    ])
    await message.answer(text, reply_markup=kb)


@router.callback_query(F.data.startswith("admin:"))
async def admin_action(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer("Access denied")
        return
    _, action, user_id = call.data.split(":", 2)

    from sqlalchemy import select
    from app.models.user import User, TierEnum
    async with async_session_maker() as db:
        user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
        if not user:
            await call.answer("User not found")
            return
        msg = ""
        if action == "kupidon":
            user.tier = TierEnum.kupidon; user.swipes_left = 500; user.superlikes_left = 5; user.is_oligarch_mode = True
            msg = f"✅ {user.name} → Kupidon"
        elif action == "stars":
            user.stars_balance += 100; msg = f"🌟 +100 Stars → {user.name}"
        elif action == "verify":
            user.is_verified = not user.is_verified; msg = f"Verified={'on' if user.is_verified else 'off'}: {user.name}"
        elif action == "18plus":
            user.is_18_mode_active = not user.is_18_mode_active; msg = f"18+={'on' if user.is_18_mode_active else 'off'}"
        elif action == "shadow":
            user.is_shadowbanned = not user.is_shadowbanned; msg = f"Shadow={'on' if user.is_shadowbanned else 'off'}"
        elif action == "oligarch":
            user.is_oligarch_mode = not user.is_oligarch_mode; msg = f"Oligarch={'on' if user.is_oligarch_mode else 'off'}"
        elif action == "ban":
            user.is_banned = not user.is_banned; msg = f"Banned={'on' if user.is_banned else 'off'}: {user.name}"
        await db.commit()
    await call.answer(msg)
    await call.message.reply(msg)


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
    from app.models.tag import AdminTag
    async with async_session_maker() as db:
        db.add(AdminTag(name=name, color_hex=color, emoji=emoji, is_18_only=False))
        await db.commit()
    await message.answer(f"✅ Tag: {emoji or ''} {name}")


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
    from app.models.tag import AdminTag
    async with async_session_maker() as db:
        db.add(AdminTag(name=name, color_hex=color, emoji=emoji, is_18_only=True))
        await db.commit()
    await message.answer(f"✅ 18+ Tag: {emoji or ''} {name}")


@router.message(Command("economy"))
async def cmd_economy(message: Message):
    if not is_admin(message.from_user.id):
        return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 3:
        await message.answer("Usage: /economy key value")
        return
    from app.services.economy import set_config_value
    async with async_session_maker() as db:
        await set_config_value(db, parts[1], parts[2])
    await message.answer(f"✅ {parts[1]} = {parts[2]}")


@router.message(Command("reports"))
async def cmd_reports(message: Message):
    if not is_admin(message.from_user.id):
        return
    from sqlalchemy import select
    from app.models.safety import Report, ReportStatusEnum
    async with async_session_maker() as db:
        reports = (await db.execute(
            select(Report).where(Report.status == ReportStatusEnum.open)
            .order_by(Report.created_at.desc()).limit(10)
        )).scalars().all()
    if not reports:
        await message.answer("No open reports.")
        return
    for r in reports:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🚫 Ban", callback_data=f"admin:ban:{r.target_id}"),
            InlineKeyboardButton(text="✅ Dismiss", callback_data=f"report:dismiss:{r.id}"),
        ]])
        await message.answer(f"Report {r.id}\nTarget: {r.target_id}\nReason: {r.reason.value}", reply_markup=kb)


@router.callback_query(F.data.startswith("report:dismiss:"))
async def dismiss_report(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    report_id = call.data.split(":", 2)[2]
    from sqlalchemy import select
    from app.models.safety import Report, ReportStatusEnum
    async with async_session_maker() as db:
        r = (await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))).scalar_one_or_none()
        if r:
            r.status = ReportStatusEnum.dismissed
            await db.commit()
    await call.answer("Dismissed")


@router.message(Command("stats"))
async def cmd_stats(message: Message):
    if not is_admin(message.from_user.id):
        return
    from sqlalchemy import select, func
    from datetime import datetime, timezone, timedelta
    from app.models.user import User, TierEnum
    from app.models.swipe import Swipe
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    async with async_session_maker() as db:
        dau = (await db.execute(select(func.count(User.id)).where(User.last_active_at >= day_ago))).scalar_one()
        total = (await db.execute(select(func.count(User.id)))).scalar_one()
        premium = (await db.execute(select(func.count(User.id)).where(User.tier == TierEnum.premium))).scalar_one()
        kupidon = (await db.execute(select(func.count(User.id)).where(User.tier == TierEnum.kupidon))).scalar_one()
        swipes = (await db.execute(select(func.count(Swipe.id)).where(Swipe.created_at >= day_ago))).scalar_one()
    conv = round((premium + kupidon) / max(total, 1) * 100, 1)
    await message.answer(
        f"📊 *CupidBot Stats*\n\nDAU: *{dau}* | Total: *{total}*\n"
        f"Premium: *{premium}* | Kupidon: *{kupidon}*\nSwipes 24h: *{swipes}*\nFree→Paid: *{conv}%*"
    )


@router.message(Command("ban"))
async def cmd_ban(message: Message):
    if not is_admin(message.from_user.id):
        return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 2:
        await message.answer("Usage: /ban <tg_id> [reason]")
        return
    tg_id = int(parts[1]); reason = parts[2] if len(parts) > 2 else "Admin ban"
    from sqlalchemy import select
    from app.models.user import User
    async with async_session_maker() as db:
        user = (await db.execute(select(User).where(User.tg_id == tg_id))).scalar_one_or_none()
        if not user:
            await message.answer("User not found.")
            return
        user.is_banned = True; user.ban_reason = reason
        await db.commit()
    await message.answer(f"🚫 Banned {user.name} ({tg_id}): {reason}")
