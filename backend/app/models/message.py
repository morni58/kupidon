import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class MsgTypeEnum(str, enum.Enum):
    text = "text"
    media = "media"
    system = "system"
    consent = "consent"
    icebreaker = "icebreaker"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(String(500))
    is_disappearing: Mapped[bool] = mapped_column(Boolean, default=False)
    is_burned: Mapped[bool] = mapped_column(Boolean, default=False)
    msg_type: Mapped[MsgTypeEnum] = mapped_column(Enum(MsgTypeEnum), default=MsgTypeEnum.text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    match: Mapped["Match"] = relationship("Match", back_populates="messages")
