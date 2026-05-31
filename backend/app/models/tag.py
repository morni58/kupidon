import uuid
from sqlalchemy import Boolean, Integer, PrimaryKeyConstraint, Sequence, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class AdminTag(Base):
    __tablename__ = "admin_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(7), default="#FF00FF")
    emoji: Mapped[str | None] = mapped_column(String(10))
    is_18_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user_tags: Mapped[list["UserTag"]] = relationship("UserTag", back_populates="tag")


class UserTag(Base):
    __tablename__ = "user_tags"
    __table_args__ = (PrimaryKeyConstraint("user_id", "tag_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tag_id: Mapped[int] = mapped_column(Integer, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="user_tags")
    tag: Mapped[AdminTag] = relationship("AdminTag", back_populates="user_tags")
