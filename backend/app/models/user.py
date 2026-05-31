import uuid
from datetime import date, datetime, timezone
from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, Enum, Integer, SmallInteger,
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
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[GenderEnum] = mapped_column(Enum(GenderEnum), nullable=False)
    search_gender: Mapped[SearchGenderEnum] = mapped_column(Enum(SearchGenderEnum), nullable=False)
    city_id: Mapped[int | None] = mapped_column(Integer)
    lat: Mapped[float | None] = mapped_column()
    lng: Mapped[float | None] = mapped_column()
    bio: Mapped[str | None] = mapped_column(String(150))
    profile_score: Mapped[int] = mapped_column(SmallInteger, default=0)
    trust_score: Mapped[int] = mapped_column(SmallInteger, default=50)
    streak_days: Mapped[int] = mapped_column(SmallInteger, default=0)

    tier: Mapped[TierEnum] = mapped_column(Enum(TierEnum), default=TierEnum.free)
    swipes_left: Mapped[int] = mapped_column(Integer, default=50)
    force_chats_used: Mapped[int] = mapped_column(Integer, default=0)
    superlikes_left: Mapped[int] = mapped_column(Integer, default=0)
    vip_signals_used: Mapped[int] = mapped_column(Integer, default=0)
    stars_balance: Mapped[int] = mapped_column(Integer, default=0)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_18_mode_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_stealth_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    is_oligarch_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    is_anti_oligarch: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shadowbanned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    ban_reason: Mapped[str | None] = mapped_column(String(200))

    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    last_streak_date: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    media_slots: Mapped[list["MediaSlot"]] = relationship("MediaSlot", back_populates="user", cascade="all, delete-orphan")
    user_tags: Mapped[list["UserTag"]] = relationship("UserTag", back_populates="user", cascade="all, delete-orphan")
