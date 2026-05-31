import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class PaymentStatusEnum(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    refunded = "refunded"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    invoice_payload: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    product: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[PaymentStatusEnum] = mapped_column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Config(Base):
    __tablename__ = "config"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200), nullable=False)
