"""Role-based staff permissions for the bot.

Hierarchy (numeric level):
  0 user · 1 moderator · 2 admin · 3 owner

- Owners are the Telegram IDs in the ADMIN_IDS env var. They always have full
  power and are the only ones who can grant/revoke the *admin* role.
- Admins (granted, stored in users.role) have full power EXCEPT touching other
  admins/owners; they can grant/revoke the *moderator* role.
- Moderators handle safety: reports, verification queue, view users, ban /
  shadowban. They cannot give donations, change economy, broadcast, or manage roles.
"""
import os
import uuid

from sqlalchemy import select
from app.db.database import async_session_maker
from app.models.user import User

OWNER_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]

USER, MOD, ADMIN, OWNER = 0, 1, 2, 3
ROLE_LEVEL = {"user": USER, "moderator": MOD, "admin": ADMIN, "owner": OWNER}
LEVEL_NAME = {USER: "user", MOD: "moderator", ADMIN: "admin", OWNER: "owner"}
ROLE_RU = {"user": "Пользователь", "moderator": "🛡️ Модератор", "admin": "⭐ Админ", "owner": "👑 Владелец"}


async def level_of(tg_id: int) -> int:
    """Resolve a Telegram user's staff level (opens its own DB session)."""
    if tg_id in OWNER_IDS:
        return OWNER
    async with async_session_maker() as db:
        role = (await db.execute(select(User.role).where(User.tg_id == tg_id))).scalar_one_or_none()
    return ROLE_LEVEL.get(role or "user", USER)


async def is_mod(tg_id: int) -> bool:
    return await level_of(tg_id) >= MOD


async def is_admin_tg(tg_id: int) -> bool:
    return await level_of(tg_id) >= ADMIN


async def is_owner(tg_id: int) -> bool:
    return await level_of(tg_id) >= OWNER


async def require(event, min_level: int) -> bool:
    """Guard: returns True if the actor meets ``min_level``, else replies/answers
    a denial and returns False. Works for both Message and CallbackQuery."""
    tg_id = event.from_user.id
    if await level_of(tg_id) >= min_level:
        return True
    deny = "⛔️ Недостаточно прав."
    try:
        # CallbackQuery
        await event.answer(deny, show_alert=True)
    except Exception:
        try:
            await event.answer(deny)
        except Exception:
            pass
    return False


async def resolve_user(db, identifier: str):
    """Find a User by tg_id, @username, or UUID."""
    ident = identifier.strip().lstrip("@")
    # UUID?
    try:
        return (await db.execute(select(User).where(User.id == uuid.UUID(ident)))).scalar_one_or_none()
    except (ValueError, AttributeError):
        pass
    # tg_id?
    try:
        return (await db.execute(select(User).where(User.tg_id == int(ident)))).scalar_one_or_none()
    except ValueError:
        pass
    # username
    return (await db.execute(select(User).where(User.username == ident))).scalar_one_or_none()


async def role_level_of_user(u: User) -> int:
    """Effective level of a target User row (owners by env outrank stored role)."""
    if u.tg_id in OWNER_IDS:
        return OWNER
    return ROLE_LEVEL.get(u.role or "user", USER)
