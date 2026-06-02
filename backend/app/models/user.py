import uuid
from datetime import date, datetime, timezone
from sqlalchemy import (
    JSON, BigInteger, Boolean, Date, DateTime, Enum, Integer, SmallInteger,
    String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"


class SearchGenderEnum(str, enum.Enum):
    male = "male"
    female = "female"
    any = "any"


class TierEnum(str, enum.Enum):
    free = "free"
    premium = "premium"
    kupidon = "kupidon"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(50), nullable=False, default="User")
    # Profile fields are filled during onboarding, so they are nullable until then
    # (matches the Alembic migration). See C9 in IMPROVEMENTS.md.
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[GenderEnum | None] = mapped_column(Enum(GenderEnum))
    search_gender: Mapped[SearchGenderEnum | None] = mapped_column(Enum(SearchGenderEnum))
    city_id: Mapped[int | None] = mapped_column(Integer)
    lat: Mapped[float | None] = mapped_column()
    lng: Mapped[float | None] = mapped_column()
    bio: Mapped[str | None] = mapped_column(String(300))
    # Profile anthem (uploaded audio): file url, display title, trim start (sec)
    anthem_url: Mapped[str | None] = mapped_column(String(500))
    anthem_title: Mapped[str | None] = mapped_column(String(120))
    anthem_start: Mapped[int | None] = mapped_column(SmallInteger)
    # Structured profile prompts (red/green flags, ideal date, etc.) as JSON
    prompts: Mapped[dict | None] = mapped_column(JSON)
    profile_score: Mapped[int] = mapped_column(SmallInteger, default=0)
    trust_score: Mapped[int] = mapped_column(SmallInteger, default=50)
    streak_days: Mapped[int] = mapped_column(SmallInteger, default=0)
    # Anti-troll signals: how often the user reshuffled identity fields.
    city_changes: Mapped[int] = mapped_column(SmallInteger, default=0)
    gender_changes: Mapped[int] = mapped_column(SmallInteger, default=0)

    tier: Mapped[TierEnum] = mapped_column(Enum(TierEnum), default=TierEnum.free)
    tier_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    swipes_left: Mapped[int] = mapped_column(Integer, default=50)
    force_chats_used: Mapped[int] = mapped_column(Integer, default=0)
    superlikes_left: Mapped[int] = mapped_column(Integer, default=0)
    vip_signals_used: Mapped[int] = mapped_column(Integer, default=0)
    stars_balance: Mapped[int] = mapped_column(Integer, default=0)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verify_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verify_selfie_url: Mapped[str | None] = mapped_column(String(500))
    is_18_mode_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_stealth_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    is_oligarch_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    is_anti_oligarch: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shadowbanned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    ban_reason: Mapped[str | None] = mapped_column(String(200))

    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    last_streak_date: Mapped[date | None] = mapped_column(Date)

    # Staff role: "user" | "moderator" | "admin". Env ADMIN_IDS are implicit
    # owners (outrank everyone, can grant/revoke admin). See bot_handlers/perms.py.
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    media_slots: Mapped[list["MediaSlot"]] = relationship("MediaSlot", back_populates="user", cascade="all, delete-orphan")
    user_tags: Mapped[list["UserTag"]] = relationship("UserTag", back_populates="user", cascade="all, delete-orphan")
