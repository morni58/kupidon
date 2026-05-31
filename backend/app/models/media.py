import uuid
from sqlalchemy import Enum, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base


class MediaTypeEnum(str, enum.Enum):
    photo = "photo"
    video = "video"


class MediaSlot(Base):
    __tablename__ = "media_slots"
    __table_args__ = (UniqueConstraint("user_id", "slot_index", name="uq_media_slot"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    media_url: Mapped[str | None] = mapped_column(String(500))
    media_type: Mapped[MediaTypeEnum] = mapped_column(Enum(MediaTypeEnum))
    nsfw_score: Mapped[float | None] = mapped_column(Numeric(3, 2))
    slot_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="media_slots")
