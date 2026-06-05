"""Web admin/moderation API (mini-app panel). Role-gated, audited.

Levels: 0 user · 1 moderator · 2 admin · 3 owner. Owners come from ADMIN_IDS env.
Every mutating call goes through app/services/staff_actions (which writes the
audit log) and enforces rank protection (no acting on equal/higher staff).
"""
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.user import User, TierEnum
from app.models.safety import Report, ReportStatusEnum, StaffAction

router = APIRouter(prefix="/api/admin", tags=["admin"])

OWNER_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]
ROLE_LEVEL = {"user": 0, "moderator": 1, "admin": 2, "owner": 3, "god": 4}
LEVEL_NAME = {0: "user", 1: "moderator", 2: "admin", 3: "owner", 4: "god"}
MOD, ADMIN, OWNER = 1, 2, 3
REASON_RU = {"fake": "Фейк", "spam": "Спам", "abuse": "Оскорбления", "nsfw": "NSFW", "underage": "Несовершеннолетний", "fraud": "Мошенничество"}


def level_of_user(u: User) -> int:
    if u.tg_id in OWNER_IDS:
        return OWNER
    return ROLE_LEVEL.get(u.role or "user", 0)


def require_level(min_level: int):
    async def dep(me: User = Depends(get_current_user)) -> User:
        if level_of_user(me) < min_level:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return me
    return dep


def _card(u: User) -> dict:
    return {
        "id": str(u.id), "tg_id": u.tg_id, "name": u.name, "username": u.username,
        "tier": u.tier.value if u.tier else "free", "stars": u.stars_balance,
        "role": u.role or "user", "level": level_of_user(u),
        "is_verified": u.is_verified, "is_18": u.is_18_mode_active,
        "is_shadowbanned": u.is_shadowbanned, "is_banned": u.is_banned,
        "ban_reason": u.ban_reason, "warns": u.warns or 0,
        "muted_until": u.muted_until.isoformat() if u.muted_until else None,
        "profile_score": u.profile_score, "trust_score": u.trust_score,
        "city_changes": u.city_changes or 0, "gender_changes": u.gender_changes or 0,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "needs_review": u.needs_review,
    }


@router.get("/whoami")
async def whoami(me: User = Depends(get_current_user)):
    lvl = level_of_user(me)
    return {"level": lvl, "role": LEVEL_NAME[lvl], "name": me.name, "is_staff": lvl >= MOD}


@router.get("/stats")
async def admin_stats(db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    from datetime import timedelta
    from app.models.swipe import Swipe
    day = datetime.now(timezone.utc) - timedelta(hours=24)
    total = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False))).scalar_one()
    dau = (await db.execute(select(func.count(User.id)).where(User.last_active_at >= day))).scalar_one()
    premium = (await db.execute(select(func.count(User.id)).where(User.tier == TierEnum.premium))).scalar_one()
    kupidon = (await db.execute(select(func.count(User.id)).where(User.tier == TierEnum.kupidon))).scalar_one()
    swipes = (await db.execute(select(func.count(Swipe.id)).where(Swipe.created_at >= day))).scalar_one()
    open_reports = (await db.execute(select(func.count(Report.id)).where(Report.status == ReportStatusEnum.open))).scalar_one()
    pending_verify = (await db.execute(select(func.count(User.id)).where(User.verify_requested_at.isnot(None), User.is_verified == False))).scalar_one()
    banned = (await db.execute(select(func.count(User.id)).where(User.is_banned == True))).scalar_one()
    return {"total": total, "dau": dau, "premium": premium, "kupidon": kupidon,
            "swipes_24h": swipes, "open_reports": open_reports, "pending_verify": pending_verify, "banned": banned}


@router.get("/reports")
async def admin_reports(db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    from app.models.message import Message
    rows = (await db.execute(
        select(Report).where(Report.status == ReportStatusEnum.open).order_by(Report.created_at.desc()).limit(40)
    )).scalars().all()
    out = []
    for r in rows:
        tgt = (await db.execute(select(User).where(User.id == r.target_id))).scalar_one_or_none()
        rep = (await db.execute(select(User).where(User.id == r.reporter_id))).scalar_one_or_none()
        n = (await db.execute(select(func.count(func.distinct(Report.reporter_id))).where(Report.target_id == r.target_id))).scalar_one()
        msgs = []
        if r.match_id:
            mrows = (await db.execute(select(Message).where(Message.match_id == r.match_id).order_by(Message.created_at.desc()).limit(6))).scalars().all()
            for m in reversed(mrows):
                who = "target" if m.sender_id == r.target_id else ("reporter" if m.sender_id == r.reporter_id else "?")
                msgs.append({"who": who, "text": (m.content or ("[медиа]" if m.media_url else "[—]"))[:140]})
        out.append({
            "id": str(r.id), "reason": REASON_RU.get(r.reason.value, r.reason.value), "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "distinct_reports": n,
            "target": _card(tgt) if tgt else None,
            "reporter": ({"name": rep.name, "username": rep.username, "tg_id": rep.tg_id} if rep else None),
            "messages": msgs,
        })
    return out


@router.post("/reports/{report_id}/dismiss")
async def dismiss_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    r = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")
    r.status = ReportStatusEnum.dismissed
    from app.services.staff_actions import log_action
    await log_action(db, me, "dismiss_report", None, str(report_id)[:8])
    await db.commit()
    return {"ok": True}


@router.get("/verify")
async def verify_queue(db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    rows = (await db.execute(
        select(User).where(User.verify_requested_at.isnot(None), User.is_verified == False, User.is_banned == False)
        .order_by(User.verify_requested_at.desc()).limit(30)
    )).scalars().all()
    from app.core.media import to_public_url
    out = []
    for u in rows:
        c = _card(u)
        c["selfie"] = to_public_url(u.verify_selfie_url) if u.verify_selfie_url else None
        c["requested_at"] = u.verify_requested_at.isoformat() if u.verify_requested_at else None
        out.append(c)
    return out


@router.get("/users")
async def search_users(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    term = q.strip().lstrip("@")
    conds = [User.name.ilike(f"%{term}%"), User.username.ilike(f"%{term}%")]
    try:
        conds.append(User.tg_id == int(term))
    except ValueError:
        pass
    rows = (await db.execute(select(User).where(or_(*conds)).limit(25))).scalars().all()
    return [_card(u) for u in rows]


@router.get("/users/{user_id}")
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Not found")
    return _card(u)


@router.get("/audit")
async def audit_log(db: AsyncSession = Depends(get_db), me: User = Depends(require_level(MOD))):
    rows = (await db.execute(select(StaffAction).order_by(StaffAction.created_at.desc()).limit(60))).scalars().all()
    return [{
        "id": str(a.id), "actor": a.actor_name or ("система" if not a.actor_tg else str(a.actor_tg)),
        "action": a.action, "target": a.target_name, "target_tg": a.target_tg,
        "detail": a.detail, "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in rows]


@router.get("/staff")
async def list_staff(db: AsyncSession = Depends(get_db), me: User = Depends(require_level(ADMIN))):
    rows = (await db.execute(select(User).where(User.role.in_(["moderator", "admin"])).order_by(User.role.desc()))).scalars().all()
    return {"owners": OWNER_IDS, "staff": [_card(u) for u in rows]}


class ActionBody(BaseModel):
    action: str
    reason: str | None = None
    hours: int | None = None
    amount: int | None = None
    product: str | None = None
    days: int | None = None
    role: str | None = None


# Which level each action needs.
ACTION_LEVEL = {
    "ban": MOD, "unban": MOD, "shadow": MOD, "verify": MOD, "unverify": MOD,
    "warn": MOD, "mute": MOD, "unmute": MOD,
    "give": ADMIN, "stars": ADMIN, "role": OWNER,  # role grants gated to owner for admin; checked finer below
}


@router.post("/users/{user_id}/action")
async def user_action(user_id: uuid.UUID, body: ActionBody, db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    my_level = level_of_user(me)
    if my_level < MOD:
        raise HTTPException(403, "Недостаточно прав")
    action = body.action
    need = ACTION_LEVEL.get(action)
    if need is None:
        raise HTTPException(400, "Неизвестное действие")

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Not found")
    target_level = level_of_user(target)

    # Role grant has special rules: admin can grant moderator, only owner can grant admin,
    # only an existing god (level 4) or hardcoded owner can grant the "god" role.
    if action == "role":
        new_role = (body.role or "user").lower()
        if new_role not in ("user", "moderator", "admin", "god"):
            raise HTTPException(400, "Bad role")
        grant_lvl = ROLE_LEVEL.get(new_role, 0)
        if new_role == "god":
            # Only god-level users (or hardcoded owners acting as god) can grant the god role.
            if my_level < 4:
                raise HTTPException(403, "Только Бог назначает Богов")
        else:
            if grant_lvl >= my_level:
                raise HTTPException(403, "Нельзя выдать роль ≥ своей")
            if new_role == "admin" and my_level < OWNER:
                raise HTTPException(403, "Админов назначает только владелец")
        if target_level >= my_level and target.id != me.id:
            raise HTTPException(403, "Нельзя менять роль равного/старшего")
    else:
        if my_level < need:
            raise HTTPException(403, "Недостаточно прав")
        # Rank protection for any action touching another staffer.
        if target_level >= my_level and target.id != me.id:
            raise HTTPException(403, "Нельзя применить к равному/старшему по роли")

    from app.services import staff_actions as sa
    if action == "ban":
        msg = await sa.act_ban(db, me, target, body.reason or "Нарушение правил")
    elif action == "unban":
        msg = await sa.act_unban(db, me, target)
    elif action == "shadow":
        msg = await sa.act_shadow(db, me, target)
    elif action == "verify":
        msg = await sa.act_verify(db, me, target, True)
    elif action == "unverify":
        msg = await sa.act_verify(db, me, target, False)
    elif action == "warn":
        msg = await sa.act_warn(db, me, target, body.reason or "")
    elif action == "mute":
        msg = await sa.act_mute(db, me, target, body.hours or 24)
    elif action == "unmute":
        msg = await sa.act_unmute(db, me, target)
    elif action == "give":
        if not body.product:
            raise HTTPException(400, "product required")
        msg = await sa.act_give(db, me, target, body.product, body.days)
    elif action == "stars":
        msg = await sa.act_stars(db, me, target, int(body.amount or 0))
    elif action == "role":
        msg = await sa.act_set_role(db, me, target, (body.role or "user").lower())
    else:
        raise HTTPException(400, "Неизвестное действие")

    await db.commit()
    refreshed = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    return {"ok": True, "message": msg, "user": _card(refreshed) if refreshed else None}
