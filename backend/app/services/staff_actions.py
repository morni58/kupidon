"""Centralised moderation/admin actions + audit logging.

Used by BOTH the bot (bot_handlers) and the web admin API so every action is
applied identically and recorded in staff_actions. Functions mutate the ORM
objects and add an audit row; the CALLER is responsible for committing.
"""
import os
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, TierEnum
from app.models.safety import StaffAction, Report

OWNER_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]

# Warn escalation thresholds.
WARN_MUTE_AT = 2        # auto-mute 24h
WARN_SHADOW_AT = 3      # auto-shadowban + needs_review
# Report escalation thresholds (distinct reporters).
REPORT_SHADOW_AT = 3
REPORT_BAN_AT = 5


async def log_action(db: AsyncSession, actor, action: str, target=None, detail: str | None = None):
    db.add(StaffAction(
        actor_id=getattr(actor, "id", None),
        actor_tg=getattr(actor, "tg_id", None),
        actor_name=getattr(actor, "name", None),
        action=action,
        target_id=getattr(target, "id", None),
        target_tg=getattr(target, "tg_id", None),
        target_name=getattr(target, "name", None),
        detail=(detail or "")[:300] or None,
    ))


async def _notify(tg_id: int, text: str):
    try:
        from app.services import notifications as notif
        await notif.send_push(tg_id, text)
    except Exception:
        pass


async def admin_tg_ids(db: AsyncSession) -> list[int]:
    """All staff who should receive escalation alerts (owners + admins+mods)."""
    rows = (await db.execute(select(User.tg_id).where(User.role.in_(["admin", "moderator"])))).scalars().all()
    return list({*OWNER_IDS, *rows})


async def notify_admins(db: AsyncSession, text: str):
    for tg in await admin_tg_ids(db):
        await _notify(tg, text)


# ─────────────── individual actions ───────────────
async def act_ban(db, actor, target: User, reason: str = "Нарушение правил"):
    target.is_banned = True
    target.ban_reason = reason
    await log_action(db, actor, "ban", target, reason)
    await _notify(target.tg_id, f"🚫 Твой аккаунт в CupidBot заблокирован. Причина: {reason}")
    return f"🚫 Забанен {target.name}"


async def act_unban(db, actor, target: User):
    target.is_banned = False
    target.is_shadowbanned = False
    target.ban_reason = None
    target.needs_review = False
    await log_action(db, actor, "unban", target)
    await _notify(target.tg_id, "♻️ Твой аккаунт в CupidBot разблокирован.")
    return f"♻️ Разбанен {target.name}"


async def act_shadow(db, actor, target: User, on: bool | None = None):
    target.is_shadowbanned = (not target.is_shadowbanned) if on is None else on
    await log_action(db, actor, "shadow", target, f"on={target.is_shadowbanned}")
    return f"👻 Shadow={'on' if target.is_shadowbanned else 'off'}: {target.name}"


async def act_verify(db, actor, target: User, on: bool = True):
    target.is_verified = on
    target.verify_requested_at = None
    if on:
        try:
            from app.api.profile import recalc_profile_score
            target.profile_score = await recalc_profile_score(db, target)
        except Exception:
            pass
        await _notify(target.tg_id, "🔵 Тебе выдали синюю галочку! Поздравляем 🎉")
    await log_action(db, actor, "verify" if on else "unverify", target)
    return f"✅ Verified={'on' if on else 'off'}: {target.name}"


async def act_warn(db, actor, target: User, reason: str = ""):
    target.warns = (target.warns or 0) + 1
    note = f"warn #{target.warns}" + (f": {reason}" if reason else "")
    await log_action(db, actor, "warn", target, note)
    msg = f"⚠️ Предупреждение {target.name} (всего: {target.warns})"
    await _notify(target.tg_id, f"⚠️ Тебе вынесли предупреждение в CupidBot." + (f"\nПричина: {reason}" if reason else ""))
    # Auto-escalation.
    if target.warns >= WARN_SHADOW_AT and not target.is_shadowbanned:
        target.is_shadowbanned = True
        target.needs_review = True
        await log_action(db, None, "auto_shadow", target, f"warns={target.warns}")
        msg += " → авто-шадоубан 👻"
        await notify_admins(db, f"🚨 Авто-шадоубан: {target.name} (@{target.username or '—'}) — {target.warns} варнов")
    elif target.warns >= WARN_MUTE_AT and (not target.muted_until or target.muted_until < datetime.now(timezone.utc)):
        target.muted_until = datetime.now(timezone.utc) + timedelta(hours=24)
        await log_action(db, None, "auto_mute", target, "24h")
        msg += " → авто-мьют 24ч 🔇"
    return msg


async def act_mute(db, actor, target: User, hours: int):
    target.muted_until = datetime.now(timezone.utc) + timedelta(hours=hours)
    await log_action(db, actor, "mute", target, f"{hours}h")
    await _notify(target.tg_id, f"🔇 Тебе ограничили переписку в CupidBot на {hours} ч.")
    return f"🔇 Мьют {target.name} на {hours} ч."


async def act_unmute(db, actor, target: User):
    target.muted_until = None
    await log_action(db, actor, "unmute", target)
    return f"🔊 Мьют снят: {target.name}"


async def act_give(db, actor, target: User, product: str, days: int | None = None):
    from app.services.payments_apply import apply_payment_effect
    await apply_payment_effect(target, product, 0)
    if days and product in ("premium_month", "kupidon_month"):
        now = datetime.now(timezone.utc)
        base = target.tier_until
        if base and base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        start = base if (base and base > now) else now
        target.tier_until = start + timedelta(days=days)
    await log_action(db, actor, "give", target, product + (f" {days}d" if days else ""))
    await _notify(target.tg_id, f"🎁 Тебе выдали «{product}» в CupidBot! 💘")
    return f"🎁 Выдал «{product}» → {target.name}"


async def act_stars(db, actor, target: User, amount: int):
    target.stars_balance = max(0, (target.stars_balance or 0) + amount)
    await log_action(db, actor, "stars", target, str(amount))
    if amount > 0:
        await _notify(target.tg_id, f"⭐ Тебе начислили {amount} Stars в CupidBot!")
    return f"⭐ {target.name}: {'+' if amount >= 0 else ''}{amount} → {target.stars_balance}"


async def act_set_role(db, actor, target: User, role: str):
    target.role = role
    await log_action(db, actor, "grant_role" if role != "user" else "revoke_role", target, role)
    return f"🎖️ {target.name} → роль «{role}»"


# ─────────────── report escalation ───────────────
async def escalate_reports(db: AsyncSession, target: User):
    """Called after a new report. Auto-shadow/ban on distinct-reporter thresholds."""
    distinct = (await db.execute(
        select(func.count(func.distinct(Report.reporter_id))).where(Report.target_id == target.id)
    )).scalar_one()
    if distinct >= REPORT_BAN_AT and not target.is_banned:
        target.is_banned = True
        target.ban_reason = f"Авто-бан: {distinct} жалоб"
        target.needs_review = True
        await log_action(db, None, "auto_ban", target, f"reports={distinct}")
        await notify_admins(db, f"🚨 АВТО-БАН: {target.name} (@{target.username or '—'}) — {distinct} жалоб")
    elif distinct >= REPORT_SHADOW_AT and not target.is_shadowbanned:
        target.is_shadowbanned = True
        target.needs_review = True
        await log_action(db, None, "auto_shadow", target, f"reports={distinct}")
        await notify_admins(db, f"🚨 Авто-шадоубан: {target.name} (@{target.username or '—'}) — {distinct} жалоб")
    return distinct
