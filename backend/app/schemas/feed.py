from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import uuid

from app.models.user import GenderEnum, TierEnum


class TagOut(BaseModel):
    id: int
    name: str
    color_hex: str
    emoji: Optional[str]
    is_18_only: bool

    model_config = {"from_attributes": True}


class FeedCard(BaseModel):
    id: uuid.UUID
    name: str
    birth_date: Optional[date] = None
    gender: Optional[GenderEnum] = None
    bio: Optional[str] = None
    profile_score: int = 0
    is_verified: bool = False
    tier: TierEnum = TierEnum.free
    city_id: Optional[int] = None
    city_name: Optional[str] = None
    dist: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tags: List[TagOut] = []
    media: List[str] = []
    common_tags_count: int = 0

    model_config = {"from_attributes": True}


class SwipeRequest(BaseModel):
    target_id: uuid.UUID
    action_type: str  # left | right | superlike
    vip_message: Optional[str] = None


class SwipeResponse(BaseModel):
    is_match: bool
    match_id: Optional[uuid.UUID] = None


class ForceChatRequest(BaseModel):
    target_id: uuid.UUID
