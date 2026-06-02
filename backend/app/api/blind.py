"""Blind Date — the killer feature.

Each user can get ONE blind match per day: identities (name + photos) stay
hidden, you only see age, city, interests, prompts and the anthem. You chat
"blind"; if BOTH tap "Раскрыться", photos open and it becomes a normal match.
Reuses the existing Match/chat infrastructure via the ``is_blind`` flag.
"""
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.match import Match
from app.models.swipe import Swipe
from app.models.safety import Block

router = APIRouter(prefix="/api/blind", tags=["blind"])


async def _active_blind_for(db: AsyncSession, me: User):
    """The user's still-blind match (not yet fully revealed)."""
    r = await db.execute(
        select(Match).where(
            Match.is_blind == True,
            or_(Match.user1_id == me.id, Match.user2_id == me.id),
        ).order_by(Match.created_at.desc()).limit(1)
    )
    return r.scalar_one_or_none()


def _gender_ok(me: User, other: User) -> bool:
    sg = getattr(me.search_gender, "value", me.search_gender)
    og = getattr(other.gender, "value", other.gender)
    sg2 = getattr(other.search_gender, "value", other.search_gender)
    mg = getattr(me.gender, "value", me.gender)
    if sg != "any" and og != sg:
        return False
    if sg2 != "any" and mg != sg2:
        return False
    return True


@router.get("/today")
async def blind_today(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    """Return today's blind match (blurred partner info) or status."""
    m = await _active_blind_for(db, me)
    today_key = date.today().isoformat()
    joined = bool(m and m.created_at and m.created_at.date().isoformat() == today_key)
    if not m:
        return {"status": "none", "joined_today": False}

    partner_id = m.user2_id if m.user1_id == me.id else m.user1_id
    p = (await db.execute(select(User).where(User.id == partner_id))).scalar_one_or_none()
    if not p:
        return {"status": "none"}

    i_am_1 = (m.user1_id == me.id)
    my_reveal = m.blind_reveal_user1 if i_am_1 else m.blind_reveal_user2
    their_reveal = m.blind_reveal_user2 if i_am_1 else m.blind_reveal_user1

    # tags + city (allowed in blind mode)
    from app.models.tag import UserTag, AdminTag
    from app.models.city import City
    tags = (await db.execute(
        select(AdminTag.id, AdminTag.name, AdminTag.color_hex, AdminTag.emoji)
        .join(UserTag, AdminTag.id == UserTag.tag_id).where(UserTag.user_id == partner_id)
    )).all()
    city = None
    if p.city_id:
        city = (await db.execute(select(City.name).where(City.id == p.city_id))).scalar_one_or_none()
    age = None
    if p.birth_date:
        t = date.today(); age = t.year - p.birth_date.year - ((t.month, t.day) < (p.birth_date.month, p.birth_date.day))

    return {
        "status": "matched",
        "match_id": str(m.id),
        "my_reveal": bool(my_reveal),
        "their_reveal": bool(their_reveal),
        "partner": {
            "age": age, "city": city, "bio": p.bio, "prompts": p.prompts or {},
            "anthem_url": p.anthem_url, "anthem_title": p.anthem_title, "anthem_start": p.anthem_start,
            "tags": [{"id": t[0], "name": t[1], "color_hex": t[2], "emoji": t[3]} for t in tags],
        },
    }


@router.post("/join")
async def blind_join(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    """Join tonight's blind date — pair with a compatible waiting user, or wait."""
    if not me.birth_date or not me.gender:
        raise HTTPException(status_code=400, detail="Сначала заполни анкету")

    existing = await _active_blind_for(db, me)
    if existing:
        return {"status": "matched", "match_id": str(existing.id)}

    # Daily limit (free: 1/day) via Redis.
    from app.core.redis import get_redis
    redis = await get_redis()
    day = date.today().isoformat()
    if not await redis.set(f"blindjoin:{me.id}:{day}", "1", ex=86400, nx=True):
        # Already joined today and the match ended without reveal.
        raise HTTPException(status_code=429, detail="Свидание вслепую доступно раз в день. Возвращайся завтра 🌙")

    # Look for someone already waiting in the blind pool today.
    pool_ids = await redis.smembers(f"blindpool:{day}")
    for pid in list(pool_ids):
        if pid == str(me.id):
            continue
        cand = (await db.execute(select(User).where(User.id == pid))).scalar_one_or_none()
        if not cand or cand.is_banned or cand.is_deleted or cand.is_18_mode_active != me.is_18_mode_active:
            await redis.srem(f"blindpool:{day}", pid)
            continue
        if not _gender_ok(me, cand):
            continue
        # not blocked either way
        blk = (await db.execute(select(Block).where(or_(
            and_(Block.blocker_id == me.id, Block.blocked_id == cand.id),
            and_(Block.blocker_id == cand.id, Block.blocked_id == me.id),
        )))).first()
        if blk:
            continue
        # not already matched
        ex = (await db.execute(select(Match).where(or_(
            and_(Match.user1_id == me.id, Match.user2_id == cand.id),
            and_(Match.user1_id == cand.id, Match.user2_id == me.id),
        )))).first()
        if ex:
            continue
        # pair!
        await redis.srem(f"blindpool:{day}", pid)
        match = Match(user1_id=cand.id, user2_id=me.id, is_blind=True,
                      is_18_room=(me.is_18_mode_active and cand.is_18_mode_active))
        db.add(match)
        await db.commit()
        await db.refresh(match)
        try:
            from app.services import notifications as notif
            await notif.send_push(cand.tg_id, "🎭 Тебя ждёт свидание вслепую! Открой CupidBot.")
        except Exception:
            pass
        return {"status": "matched", "match_id": str(match.id)}

    # Nobody to pair with → wait in the pool.
    await redis.sadd(f"blindpool:{day}", str(me.id))
    await redis.expire(f"blindpool:{day}", 86400)
    return {"status": "waiting"}


@router.post("/reveal")
async def blind_reveal(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    """Reveal yourself. When BOTH reveal, the blind match becomes a real one."""
    m = await _active_blind_for(db, me)
    if not m:
        raise HTTPException(status_code=404, detail="Нет активного свидания вслепую")
    i_am_1 = (m.user1_id == me.id)
    if i_am_1:
        m.blind_reveal_user1 = True
    else:
        m.blind_reveal_user2 = True
    both = m.blind_reveal_user1 and m.blind_reveal_user2
    if both:
        m.is_blind = False
    await db.commit()

    from app.ws.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast(str(m.id), {"type": ("blind_revealed" if both else "blind_reveal_one"), "from_id": str(me.id)}))
    if both:
        partner_id = m.user2_id if m.user1_id == me.id else m.user1_id
        p = (await db.execute(select(User).where(User.id == partner_id))).scalar_one_or_none()
        if p:
            try:
                from app.services import notifications as notif
                await notif.send_push(p.tg_id, "🎉 Вы раскрылись друг другу! Загляни в чат.")
            except Exception:
                pass
    return {"both": both, "match_id": str(m.id)}
