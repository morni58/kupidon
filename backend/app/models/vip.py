import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class VIPNotification(Base):
    __tablename__ = "vip_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    swipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    is_revealed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProfileView(Base):
    __tablename__ = "profile_views"
    __table_args__ = (UniqueConstraint("viewer_id", "target_id", name="uq_profile_view"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    viewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
