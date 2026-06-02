from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import List
import uuid

from app.core.deps import get_db, get_current_user
from app.core.ratelimit import rate_limiter
from app.core.media import save_upload, to_public_url
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

        # Unread = partner messages newer than my last "read" marker (UX11).
        from app.core.redis import get_redis
        redis = await get_redis()
        last_read_raw = await redis.get(f"lastread:{m.id}:{me.id}")
        unread_q = select(func.count(Message.id)).where(
            Message.match_id == m.id, Message.sender_id == partner_id
        )
        if last_read_raw:
            from datetime import datetime as _dt
            try:
                unread_q = unread_q.where(Message.created_at > _dt.fromisoformat(last_read_raw))
            except ValueError:
                pass
        unread = (await db.execute(unread_q)).scalar_one()

        # tg unlocked state for me
        tg_unlocked = (m.tg_unlocked_user1 and m.tg_unlocked_user2)

        last_active = partner.last_active_at.replace(tzinfo=timezone.utc) if partner.last_active_at else None

        from app.core.media import to_public_url
        blind = bool(getattr(m, "is_blind", False))
        out.append({
            "id": str(m.id),
            "partner_id": str(partner_id),
            "name": ("Незнакомец 🎭" if blind else partner.name),
            "verified": (False if blind else partner.is_verified),
            "photo": (None if blind else to_public_url(photo)),
            "online": bool(last_active and last_active >= online_cutoff),
            "is_blind": blind,
            "is_18_room": m.is_18_room,
            "messages_count": m.messages_count,
            "tg_unlocked": tg_unlocked,
            "last": last.content if last and last.content else ("🔥 Фото" if last and last.is_disappearing else "Начните общение"),
            "last_at": last.created_at.isoformat() if last else m.created_at.isoformat(),
            "unread": int(unread),
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

    # SHARED message counter (both people's messages) — safer gate to even
    # offer the contact exchange (U-TG / safety request).
    total_r = await db.execute(
        select(func.count(Message.id)).where(
            Message.match_id == match_id,
            Message.msg_type.in_([MsgTypeEnum.text, MsgTypeEnum.media]),
        )
    )
    total_msgs = total_r.scalar_one()

    from app.models.user import TierEnum
    from app.services.economy import get_config_value
    if me.tier == TierEnum.kupidon:
        threshold = 0
    elif me.tier == TierEnum.premium:
        threshold = int(await get_config_value(db, "tg_unlock_premium_msgs", "5"))
    else:
        threshold = int(await get_config_value(db, "tg_unlock_free_msgs", "15"))

    # Username is revealed ONLY when BOTH sides explicitly agree (mutual consent).
    # The shared message counter merely enables the "request exchange" button.
    i_am_user1 = (match.user1_id == me.id)
    my_consent = match.tg_unlocked_user1 if i_am_user1 else match.tg_unlocked_user2
    partner_consent = match.tg_unlocked_user2 if i_am_user1 else match.tg_unlocked_user1
    mutual = bool(match.tg_unlocked_user1 and match.tg_unlocked_user2)
    can_request = total_msgs >= threshold

    from app.core.media import to_public_url
    blind = bool(getattr(match, "is_blind", False))
    return {
        "id": str(match.id),
        "partner_id": str(partner_id),
        "name": ("Незнакомец 🎭" if blind else partner.name),
        "verified": (False if blind else partner.is_verified),
        "photo": (None if blind else to_public_url(photo)),
        "online": bool(last_active and last_active >= online_cutoff),
        "is_blind": blind,
        "is_18_room": match.is_18_room,
        "messages_count": match.messages_count,
        "tg_unlocked": mutual,          # reveal only on mutual consent
        "tg_threshold": threshold,
        "total_messages": total_msgs,   # shared counter
        "can_request": can_request,
        "my_consent": bool(my_consent),
        "partner_consent": bool(partner_consent),
        # Real handle only after mutual consent (privacy & safety).
        "partner_username": (partner.username if mutual and partner.username else None),
        "partner_tg_id": (str(partner.tg_id) if mutual else None),
    }


@router.get("/chats/{match_id}/messages", response_model=List[MessageOut])
async def get_messages(
    match_id: uuid.UUID,
    limit: int = 100,
    before: str | None = None,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    await _check_match_access(db, match_id, me)
    limit = max(1, min(limit, 200))
    q = select(Message).where(Message.match_id == match_id)
    if before:
        from datetime import datetime as _dt
        try:
            q = q.where(Message.created_at < _dt.fromisoformat(before))
        except ValueError:
            pass
    # Take the newest `limit`, then return ascending for display.
    q = q.order_by(Message.created_at.desc()).limit(limit)
    rows = list((await db.execute(q)).scalars().all())
    rows.reverse()
    out = []
    for m in rows:
        mo = MessageOut.model_validate(m)
        # Hide burned media; serve absolute URLs for the rest.
        mo.media_url = None if m.is_burned else to_public_url(m.media_url)
        out.append(mo)
    return out


@router.post("/chats/{match_id}/messages", response_model=MessageOut)
async def send_message(
    match_id: uuid.UUID,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(rate_limiter("msg", limit=30, window=10)),
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
    # Contacts stay blocked only until BOTH sides approved the TG exchange (C4).
    tg_unlocked = bool(match.tg_unlocked_user1 and match.tg_unlocked_user2)
    if is_18_room and content and not tg_unlocked:
        import re
        if re.search(r"(@\w+|https?://|t\.me/|\+?[78][0-9]{10})", content or ""):
            raise HTTPException(status_code=422, detail="Share contacts only after TG unlock")

    msg = Message(
        match_id=match_id,
        sender_id=me.id,
        content=content,
        msg_type=body.msg_type,
        is_disappearing=is_18_room,
    )
    db.add(msg)

    # TG unlock counter: count every real (non-system) message (C3).
    if body.msg_type in (MsgTypeEnum.text, MsgTypeEnum.media):
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

    # Telegram push to the partner, throttled to once per minute per chat (UX/U-NOTIF).
    partner_id = match.user2_id if match.user1_id == me.id else match.user1_id
    partner_r = await db.execute(select(User).where(User.id == partner_id))
    partner = partner_r.scalar_one_or_none()
    # Don't push if the partner is already looking at this chat (live WS), and
    # throttle to at most once per minute per chat otherwise (U-NOTIF).
    if partner and not ws_manager.is_present(str(match_id), str(partner_id)):
        from app.core.redis import get_redis
        from app.services import notifications as notif
        redis = await get_redis()
        throttle_key = f"msgpush:{match_id}:{partner_id}"
        if await redis.set(throttle_key, "1", ex=60, nx=True):
            asyncio.create_task(notif.notify_new_message(partner.tg_id, me.name))

    return msg


@router.post("/chats/{match_id}/media", response_model=MessageOut)
async def send_media_message(
    match_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Send a photo/video message. In an 18+ room it is disappearing (F3/F4)."""
    match = await _check_match_access(db, match_id, me)

    content_type = file.content_type or ""
    is_video = content_type.startswith("video")
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > (15 if is_video else 5):
        raise HTTPException(status_code=413, detail="File too large")

    rel_url = await save_upload(data, me.id, "mp4" if is_video else "webp")

    # NSFW gate (stub today; real model later). 18+ rooms use the strict threshold.
    from app.services.moderation import nsfw_service
    score = await nsfw_service.classify(rel_url)
    threshold = 0.70 if match.is_18_room else 0.85
    if score >= threshold:
        raise HTTPException(status_code=422, detail="Media flagged as NSFW")

    msg = Message(
        match_id=match_id,
        sender_id=me.id,
        media_url=rel_url,
        msg_type=MsgTypeEnum.media,
        is_disappearing=match.is_18_room,
    )
    db.add(msg)
    match.messages_count += 1
    await db.commit()
    await db.refresh(msg)

    from app.ws.manager import ws_manager
    import asyncio
    payload = MessageOut.model_validate(msg).model_dump(mode="json")
    payload["media_url"] = to_public_url(msg.media_url)
    asyncio.create_task(ws_manager.broadcast(str(match_id), {
        "type": "message_sent",
        "message": payload,
    }))
    out = MessageOut.model_validate(msg)
    out.media_url = to_public_url(msg.media_url)
    return out


@router.post("/chats/{match_id}/request_tg")
async def request_tg(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    match = await _check_match_access(db, match_id, me)
    partner_id = match.user2_id if match.user1_id == me.id else match.user1_id

    # Requesting = giving my own consent to reveal my @username.
    if match.user1_id == me.id:
        match.tg_unlocked_user1 = True
    else:
        match.tg_unlocked_user2 = True
    mutual = bool(match.tg_unlocked_user1 and match.tg_unlocked_user2)

    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(match_id), {
        "type": ("tg_consent_approved" if mutual else "tg_consent_request"),
        "from_id": str(me.id),
        "match_id": str(match_id),
    }))

    sys_msg = Message(
        match_id=match_id, sender_id=me.id,
        content=("Telegram-контакты открыты ✅" if mutual else "Хочу обменяться Telegram — подтвердишь?"),
        msg_type=MsgTypeEnum.consent,
    )
    db.add(sys_msg)
    await db.commit()
    # Push the other side so they actually notice the request.
    if not mutual:
        partner_r = await db.execute(select(User).where(User.id == partner_id))
        partner = partner_r.scalar_one_or_none()
        if partner:
            from app.services import notifications as notif
            asyncio.create_task(notif.send_push(partner.tg_id, f"🔑 {me.name} предлагает обменяться Telegram. Подтверди в чате."))
    return {"ok": True, "mutual": mutual}


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
    from datetime import datetime, timezone
    from app.core.redis import get_redis
    redis = await get_redis()
    await redis.set(f"lastread:{match_id}:{me.id}", datetime.now(timezone.utc).isoformat())
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
