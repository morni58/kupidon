import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user1_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user2_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    is_force_chat: Mapped[bool] = mapped_column(Boolean, default=False)
    is_18_room: Mapped[bool] = mapped_column(Boolean, default=False)
    is_oligarch_reveal: Mapped[bool] = mapped_column(Boolean, default=False)
    tg_unlocked_user1: Mapped[bool] = mapped_column(Boolean, default=False)
    tg_unlocked_user2: Mapped[bool] = mapped_column(Boolean, default=False)
    messages_count: Mapped[int] = mapped_column(Integer, default=0)
    # Blind Date: identity hidden until BOTH reveal (killer feature).
    is_blind: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    blind_reveal_user1: Mapped[bool] = mapped_column(Boolean, default=False)
    blind_reveal_user2: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["Message"]] = relationship("Message", back_populates="match", cascade="all, delete-orphan")
