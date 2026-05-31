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
    birth_date: date
    gender: GenderEnum
    bio: Optional[str]
    profile_score: int
    is_verified: bool
    tier: TierEnum
    city_id: Optional[int]
    lat: Optional[float]
    lng: Optional[float]
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
