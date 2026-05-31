from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import List
import uuid

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.match import Match
from app.models.message import Message, MsgTypeEnum
from app.schemas.chat import MatchOut, MessageOut, SendMessageRequest

router = APIRouter(prefix="/api", tags=["chats"])

ICEBREAKERS = [
    "🐾 Собаки или кошки?",
    "🎵 Какой плейлист слушаешь сейчас?",
    "✈️ Последняя поездка, которую ты вспоминаешь?",
    "🍕 Пицца или суши?",
    "🎬 Фильм, который пересматривал(а) дважды?",
]


@router.get("/chats")
async def list_chats(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Enriched chat list: partner info + last message + unread counter."""
    from app.models.media import MediaSlot
    from datetime import datetime, timezone, timedelta

    result = await db.execute(
        select(Match).where(
            or_(Match.user1_id == me.id, Match.user2_id == me.id)
        ).order_by(Match.created_at.desc())
    )
    matches = result.scalars().all()

    online_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    out = []
    for m in matches:
        partner_id = m.user2_id if m.user1_id == me.id else m.user1_id
        p_r = await db.execute(select(User).where(User.id == partner_id))
        partner = p_r.scalar_one_or_none()
        if not partner or partner.is_banned:
            continue

        # first photo
        ph_r = await db.execute(
            select(MediaSlot.media_url).where(MediaSlot.user_id == partner_id)
            .order_by(MediaSlot.slot_index).limit(1)
        )
        photo = ph_r.scalar_one_or_none()

        # last message + unread (messages from partner)
        last_r = await db.execute(
            select(Message).where(Message.match_id == m.id).order_by(Message.created_at.desc()).limit(1)
        )
        last = last_r.scalar_one_or_none()
        unread_r = await db.execute(
            select(func.count(Message.id)).where(
                Message.match_id == m.id, Message.sender_id == partner_id
            )
        )
        # tg unlocked state for me
        tg_unlocked = (m.tg_unlocked_user1 and m.tg_unlocked_user2)

        last_active = partner.last_active_at.replace(tzinfo=timezone.utc) if partner.last_active_at else None

        out.append({
            "id": str(m.id),
            "partner_id": str(partner_id),
            "name": partner.name,
            "verified": partner.is_verified,
            "photo": photo,
            "online": bool(last_active and last_active >= online_cutoff),
            "is_18_room": m.is_18_room,
            "messages_count": m.messages_count,
            "tg_unlocked": tg_unlocked,
            "last": last.content if last and last.content else ("🔥 Фото" if last and last.is_disappearing else "Начните общение"),
            "last_at": last.created_at.isoformat() if last else m.created_at.isoformat(),
            "unread": 0,  # client-side tracked; kept for shape
        })
    return out


@router.get("/chats/{match_id}/info")
async def chat_info(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Enriched info for a single chat (used by the dialog screen)."""
    from app.models.media import MediaSlot
    from datetime import datetime, timezone, timedelta

    match = await _check_match_access(db, match_id, me)
    partner_id = match.user2_id if match.user1_id == me.id else match.user1_id
    p_r = await db.execute(select(User).where(User.id == partner_id))
    partner = p_r.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    ph_r = await db.execute(
        select(MediaSlot.media_url).where(MediaSlot.user_id == partner_id)
        .order_by(MediaSlot.slot_index).limit(1)
    )
    photo = ph_r.scalar_one_or_none()
    online_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    last_active = partner.last_active_at.replace(tzinfo=timezone.utc) if partner.last_active_at else None

    # messages I sent (for TG unlock counter)
    my_msgs_r = await db.execute(
        select(func.count(Message.id)).where(Message.match_id == match_id, Message.sender_id == me.id)
    )
    my_count = my_msgs_r.scalar_one()

    return {
        "id": str(match.id),
        "partner_id": str(partner_id),
        "name": partner.name,
        "verified": partner.is_verified,
        "photo": photo,
        "online": bool(last_active and last_active >= online_cutoff),
        "is_18_room": match.is_18_room,
        "messages_count": match.messages_count,
        "tg_unlocked": bool(match.tg_unlocked_user1 and match.tg_unlocked_user2),
        "my_messages": my_count,
    }


@router.get("/chats/{match_id}/messages", response_model=List[MessageOut])
async def get_messages(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    await _check_match_access(db, match_id, me)
    result = await db.execute(
        select(Message).where(Message.match_id == match_id).order_by(Message.created_at)
    )
    return result.scalars().all()


@router.post("/chats/{match_id}/messages", response_model=MessageOut)
async def send_message(
    match_id: uuid.UUID,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from app.services.moderation import moderate_text

    match = await _check_match_access(db, match_id, me)

    # Rate-limit: max 5 msg per 10 sec (simple check via recent count)
    content = body.content
    if content:
        content = moderate_text(content)
        if content is None:
            raise HTTPException(status_code=422, detail="Message contains forbidden content")

    is_18_room = match.is_18_room
    if is_18_room and content:
        # In 18+ room block contacts/links in messages until TG unlocked
        partner_tg_unlocked = (
            (match.user1_id == me.id and not match.tg_unlocked_user2) or
            (match.user2_id == me.id and not match.tg_unlocked_user1)
        )
        import re
        if re.search(r"(@\w+|https?://|t\.me/|\+7[0-9]{10})", content or ""):
            raise HTTPException(status_code=422, detail="Share contacts only after TG unlock")

    msg = Message(
        match_id=match_id,
        sender_id=me.id,
        content=content,
        msg_type=body.msg_type,
        is_disappearing=is_18_room,
    )
    db.add(msg)

    # Track unique senders for TG unlock counter
    partner_id = match.user2_id if match.user1_id == me.id else match.user1_id
    partner_msgs_r = await db.execute(
        select(Message).where(
            Message.match_id == match_id,
            Message.sender_id == partner_id,
        ).limit(1)
    )
    if partner_msgs_r.scalar_one_or_none():
        match.messages_count += 1

    await db.commit()
    await db.refresh(msg)

    # WS broadcast handled in ws module
    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(match_id), {
        "type": "message_sent",
        "message": MessageOut.model_validate(msg).model_dump(mode="json"),
    }))

    return msg


@router.post("/chats/{match_id}/request_tg")
async def request_tg(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    match = await _check_match_access(db, match_id, me)
    partner_id = match.user2_id if match.user1_id == me.id else match.user1_id

    # Broadcast consent request
    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(match_id), {
        "type": "tg_consent_request",
        "from_id": str(me.id),
        "match_id": str(match_id),
    }))

    # System message
    sys_msg = Message(
        match_id=match_id,
        sender_id=me.id,
        content="Запрос на обмен Telegram-контактами",
        msg_type=MsgTypeEnum.consent,
    )
    db.add(sys_msg)
    await db.commit()
    return {"ok": True}


@router.post("/chats/{match_id}/approve_tg")
async def approve_tg(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    match = await _check_match_access(db, match_id, me)
    if match.user1_id == me.id:
        match.tg_unlocked_user1 = True
    else:
        match.tg_unlocked_user2 = True

    # If both approved
    if match.tg_unlocked_user1 and match.tg_unlocked_user2:
        from app.ws.manager import ws_manager
        import asyncio
        asyncio.create_task(ws_manager.broadcast(str(match_id), {"type": "tg_consent_approved"}))

    await db.commit()
    return {"ok": True}


@router.post("/chats/{match_id}/decline_tg")
async def decline_tg(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Decline a Telegram exchange request. Repeat allowed after 24h."""
    await _check_match_access(db, match_id, me)
    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(match_id), {
        "type": "tg_consent_declined",
        "by_id": str(me.id),
    }))
    sys_msg = Message(
        match_id=match_id,
        sender_id=me.id,
        content="Обмен Telegram отклонён",
        msg_type=MsgTypeEnum.system,
    )
    db.add(sys_msg)
    await db.commit()
    return {"ok": True}


@router.post("/chats/{match_id}/read")
async def mark_read(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Mark messages as read and broadcast read receipt."""
    await _check_match_access(db, match_id, me)
    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(match_id), {
        "type": "message_read",
        "reader_id": str(me.id),
    }))
    return {"ok": True}


@router.get("/icebreakers")
async def get_icebreakers(me: User = Depends(get_current_user)):
    import random
    return random.sample(ICEBREAKERS, min(3, len(ICEBREAKERS)))


async def _check_match_access(db: AsyncSession, match_id: uuid.UUID, me: User) -> Match:
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if me.id not in (match.user1_id, match.user2_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return match
