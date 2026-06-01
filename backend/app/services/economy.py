"""Economy service — reads limits from Config table."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.payment import Config

DEFAULTS = {
    "free_swipes_daily": "50",
    "premium_swipes": "200",
    "kupidon_swipes": "500",
    "free_18_swipes": "5",
    "premium_force_chats": "3",
    "kupidon_force_chats": "15",
    "premium_superlikes": "5",
    "kupidon_superlikes": "5",
    "vip_daily_cap": "20",
    "force_chat_stars": "50",
    "boost_stars": "100",
    "superlike_stars": "150",
    "vip_signal_stars": "500",
    "golden_key_stars": "1000",
    "force_chat_extra_stars": "100",
    "tg_unlock_free_msgs": "15",
    "tg_unlock_premium_msgs": "5",
}


async def get_config_value(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(Config).where(Config.key == key))
    row = result.scalar_one_or_none()
    if row:
        return row.value
    return DEFAULTS.get(key, default)


async def set_config_value(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(Config).where(Config.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(Config(key=key, value=value))
    await db.commit()


async def seed_default_config(db: AsyncSession) -> None:
    for key, value in DEFAULTS.items():
        result = await db.execute(select(Config).where(Config.key == key))
        if not result.scalar_one_or_none():
            db.add(Config(key=key, value=value))
    await db.commit()
