"""Idempotent startup bootstrap: ensure new tables/columns exist and seed the
tag catalog. Lets us ship schema additions without a manual Alembic step on
deploy (create_all only creates *missing* tables; an IF NOT EXISTS ALTER adds
new columns on Postgres). See U-TAGS / U-TAGS-ADMIN in IMPROVEMENTS.md.
"""
import logging
from sqlalchemy import select, text

from app.db.base import Base
from app.db.database import engine, async_session_maker
from app.models.tag import AdminTag

logger = logging.getLogger("cupidbot.bootstrap")

# Curated catalog grouped by category. Subcultures are first-class so none get
# "forgotten" (explicit product requirement). (name, color, emoji, category, is_18_only)
TAG_CATALOG = [
    # Музыка
    ("Рок", "#EF4444", "🎸", "Музыка", False),
    ("Метал", "#0F0F13", "🤘", "Музыка", False),
    ("Хип-хоп", "#F59E0B", "🎤", "Музыка", False),
    ("Электроника", "#22D3EE", "🎧", "Музыка", False),
    ("Рейв", "#A855F7", "🔊", "Музыка", False),
    ("Инди", "#10B981", "🎶", "Музыка", False),
    ("K-pop", "#FF66CC", "💜", "Музыка", False),
    ("Классика", "#8B5CF6", "🎻", "Музыка", False),
    ("Джаз", "#B45309", "🎷", "Музыка", False),
    # Субкультуры
    ("Аниме", "#FF00FF", "🎌", "Субкультуры", False),
    ("Готы", "#0F0F13", "🦇", "Субкультуры", False),
    ("Панк", "#EF4444", "🧷", "Субкультуры", False),
    ("Эмо", "#EC4899", "🖤", "Субкультуры", False),
    ("Хиппи", "#84FAB0", "☮️", "Субкультуры", False),
    ("Байкеры", "#6B7280", "🏍️", "Субкультуры", False),
    ("Косплей", "#A855F7", "🎭", "Субкультуры", False),
    ("Скейтеры", "#10B981", "🛹", "Субкультуры", False),
    ("Гики", "#06B6D4", "🤓", "Субкультуры", False),
    # Спорт
    ("Спортзал", "#EF4444", "🏋️", "Спорт", False),
    ("Бег", "#10B981", "🏃", "Спорт", False),
    ("Йога", "#A855F7", "🧘", "Спорт", False),
    ("Велоспорт", "#F59E0B", "🚴", "Спорт", False),
    ("Сноуборд", "#22D3EE", "🏂", "Спорт", False),
    ("Единоборства", "#0F0F13", "🥊", "Спорт", False),
    ("Футбол", "#10B981", "⚽", "Спорт", False),
    # Творчество
    ("Рисование", "#F97316", "🎨", "Творчество", False),
    ("Фотография", "#3B82F6", "📷", "Творчество", False),
    ("Музыкант", "#A855F7", "🎹", "Творчество", False),
    ("Танцы", "#EC4899", "💃", "Творчество", False),
    ("Письмо", "#8B5CF6", "✍️", "Творчество", False),
    ("Тату", "#0F0F13", "💉", "Творчество", False),
    # Игры и технологии
    ("Видеоигры", "#6366F1", "🎮", "Игры и IT", False),
    ("Настолки", "#F59E0B", "🎲", "Игры и IT", False),
    ("Киберспорт", "#22D3EE", "🕹️", "Игры и IT", False),
    ("Программирование", "#14B8A6", "💻", "Игры и IT", False),
    ("ИИ и технологии", "#06B6D4", "🤖", "Игры и IT", False),
    # Кино и книги
    ("Кино", "#3B82F6", "🎬", "Кино и книги", False),
    ("Сериалы", "#8B5CF6", "📺", "Кино и книги", False),
    ("Книги", "#B45309", "📚", "Кино и книги", False),
    ("Аниме-сериалы", "#FF00FF", "🍥", "Кино и книги", False),
    # Еда
    ("Готовка", "#F97316", "🍳", "Еда", False),
    ("Кофе", "#B45309", "☕", "Еда", False),
    ("Вино", "#7C3AED", "🍷", "Еда", False),
    ("Веган", "#10B981", "🥗", "Еда", False),
    ("Суши", "#EF4444", "🍣", "Еда", False),
    # Стиль жизни
    ("Путешествия", "#3B82F6", "✈️", "Стиль жизни", False),
    ("Походы", "#10B981", "⛺", "Стиль жизни", False),
    ("Машины", "#6B7280", "🚗", "Стиль жизни", False),
    ("Мода", "#EC4899", "👗", "Стиль жизни", False),
    ("Кошатник", "#FF66CC", "🐱", "Животные", False),
    ("Собачник", "#F97316", "🐶", "Животные", False),
    # 18+
    ("Без обязательств", "#FF3333", "🎲", "18+", True),
    ("Один вечер", "#CC0000", "🌙", "18+", True),
    ("Открытые отношения", "#FF6666", "💫", "18+", True),
    ("Анонимно", "#990000", "🎭", "18+", True),
]


async def ensure_schema() -> None:
    """Create any missing tables and add new columns idempotently."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # New columns on existing tables — create_all won't add them.
            if engine.dialect.name == "postgresql":
                await conn.execute(text("ALTER TABLE admin_tags ADD COLUMN IF NOT EXISTS category VARCHAR(30)"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_until TIMESTAMPTZ"))
                # Staff roles + moderation fields.
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS warns SMALLINT NOT NULL DEFAULT 0"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS search_age_min SMALLINT"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS search_age_max SMALLINT"))
    except Exception as e:
        logger.warning("ensure_schema: %s", e)


async def seed_tags() -> None:
    """Insert catalog tags that don't exist yet (by name). Never deletes."""
    try:
        async with async_session_maker() as db:
            existing = {n.lower() for n in (await db.execute(select(AdminTag.name))).scalars().all()}
            added = 0
            for name, color, emoji, category, is_18 in TAG_CATALOG:
                if name.lower() in existing:
                    # Backfill category for tags seeded before categories existed.
                    continue
                db.add(AdminTag(name=name, color_hex=color, emoji=emoji,
                                category=category, is_18_only=is_18, is_active=True))
                added += 1
            if added:
                await db.commit()
                logger.info("seeded %s new tags", added)
            # Backfill categories for matching catalog names that lack one.
            rows = (await db.execute(select(AdminTag))).scalars().all()
            cat_by_name = {n.lower(): c for n, _, _, c, _ in TAG_CATALOG}
            changed = False
            for t in rows:
                if not t.category and t.name.lower() in cat_by_name:
                    t.category = cat_by_name[t.name.lower()]
                    changed = True
            if changed:
                await db.commit()
    except Exception as e:
        logger.warning("seed_tags: %s", e)
