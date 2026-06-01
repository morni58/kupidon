import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, PrimaryKeyConstraint, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class AdminTag(Base):
    __tablename__ = "admin_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(7), default="#FF00FF")
    emoji: Mapped[str | None] = mapped_column(String(10))
    category: Mapped[str | None] = mapped_column(String(30))
    is_18_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user_tags: Mapped[list["UserTag"]] = relationship("UserTag", back_populates="tag")


class TagRequestStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class TagRequest(Base):
    """A user-submitted (paid) tag awaiting moderation. See U-TAGS-ADMIN."""
    __tablename__ = "tag_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(7), default="#FF00FF")
    emoji: Mapped[str | None] = mapped_column(String(10))
    category: Mapped[str | None] = mapped_column(String(30))
    is_18_only: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[TagRequestStatusEnum] = mapped_column(Enum(TagRequestStatusEnum), default=TagRequestStatusEnum.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserTag(Base):
    __tablename__ = "user_tags"
    __table_args__ = (PrimaryKeyConstraint("user_id", "tag_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("admin_tags.id", ondelete="CASCADE"), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="user_tags")
    tag: Mapped[AdminTag] = relationship("AdminTag", back_populates="user_tags")
