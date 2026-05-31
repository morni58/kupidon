from sqlalchemy import Integer, String, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    region: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(2), default="RU")
    lat: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    lng: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
