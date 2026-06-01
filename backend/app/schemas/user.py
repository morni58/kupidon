from pydantic import BaseModel, field_validator
from datetime import date, datetime
from typing import Optional
import re
import uuid

from app.models.user import GenderEnum, SearchGenderEnum, TierEnum


class OnboardingCreate(BaseModel):
    name: str
    birth_date: date
    gender: GenderEnum
    search_gender: SearchGenderEnum
    bio: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Zа-яА-ЯёЁ\s\-]{2,30}$", v):
            raise ValueError("Name must be 2-30 letters, spaces, or hyphens")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_age(cls, v: date) -> date:
        from datetime import date as d
        today = d.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        # Hard floor only; the exact minimum is enforced per-config in the endpoint.
        if age < 14:
            raise ValueError("Too young")
        return v

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if len(v) > 150:
                raise ValueError("Bio max 150 chars")
        return v


class UserPublic(BaseModel):
    id: uuid.UUID
    name: str
    birth_date: Optional[date] = None
    gender: Optional[GenderEnum] = None
    search_gender: Optional[SearchGenderEnum] = None
    bio: Optional[str] = None
    profile_score: int
    is_verified: bool
    is_18_mode_active: bool
    tier: TierEnum
    swipes_left: int
    superlikes_left: int
    force_chats_used: int
    vip_signals_used: int
    is_oligarch_mode: bool
    is_anti_oligarch: bool
    is_stealth_mode: bool
    streak_days: int
    created_at: datetime
    last_active_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[GenderEnum] = None
    bio: Optional[str] = None
    search_gender: Optional[SearchGenderEnum] = None
    city_id: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_18_mode_active: Optional[bool] = None
    is_anti_oligarch: Optional[bool] = None
    is_stealth_mode: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not re.match(r"^[a-zA-Zа-яА-ЯёЁ\s\-]{2,30}$", v):
            raise ValueError("Name must be 2-30 letters, spaces, or hyphens")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_age(cls, v: Optional[date]) -> Optional[date]:
        if v is None:
            return v
        from datetime import date as d
        today = d.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        # Hard floor only; the exact minimum is enforced per-config in the endpoint.
        if age < 14:
            raise ValueError("Too young")
        return v


class GeoResolveRequest(BaseModel):
    lat: float
    lng: float
