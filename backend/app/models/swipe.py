import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class ActionTypeEnum(str, enum.Enum):
    left = "left"
    right = "right"
    superlike = "superlike"


class Swipe(Base):
    __tablename__ = "swipes"
    __table_args__ = (UniqueConstraint("actor_id", "target_id", name="idx_swipes_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    action_type: Mapped[ActionTypeEnum] = mapped_column(Enum(ActionTypeEnum), nullable=False)
    is_vip_like: Mapped[bool] = mapped_column(Boolean, default=False)
    vip_message: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
