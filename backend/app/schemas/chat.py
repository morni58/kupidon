from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.message import MsgTypeEnum


class MessageOut(BaseModel):
    id: uuid.UUID
    match_id: uuid.UUID
    sender_id: uuid.UUID
    content: Optional[str]
    media_url: Optional[str]
    is_disappearing: bool
    is_burned: bool
    msg_type: MsgTypeEnum
    created_at: datetime

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    content: Optional[str] = None
    msg_type: MsgTypeEnum = MsgTypeEnum.text


class MatchOut(BaseModel):
    id: uuid.UUID
    user1_id: uuid.UUID
    user2_id: uuid.UUID
    is_force_chat: bool
    is_18_room: bool
    tg_unlocked_user1: bool
    tg_unlocked_user2: bool
    messages_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
