import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, PrimaryKeyConstraint, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class ReportReasonEnum(str, enum.Enum):
    fake = "fake"
    spam = "spam"
    abuse = "abuse"
    nsfw = "nsfw"
    underage = "underage"
    fraud = "fraud"


class ReportStatusEnum(str, enum.Enum):
    open = "open"
    reviewed = "reviewed"
    dismissed = "dismissed"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    reason: Mapped[ReportReasonEnum] = mapped_column(Enum(ReportReasonEnum), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    match_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[ReportStatusEnum] = mapped_column(Enum(ReportStatusEnum), default=ReportStatusEnum.open)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (PrimaryKeyConstraint("blocker_id", "blocked_id"),)

    blocker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    blocked_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
