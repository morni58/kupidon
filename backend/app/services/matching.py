"""Feed scoring and matching logic."""
import math
import random
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from sqlalchemy import select, func, text, not_, exists
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, TierEnum, SearchGenderEnum
from app.models.swipe import Swipe, ActionTypeEnum
from app.models.match import Match
from app.models.tag import UserTag
from app.models.safety import Block
from app.models.vip import VIPNotification
from app.services.economy import get_config_value


TIER_BOOST = {TierEnum.free: 0.0, TierEnum.premium: 0.6, TierEnum.kupidon: 1.0}


def recency_score(last_active: datetime) -> float:
    delta = (datetime.now(timezone.utc) - last_active.replace(tzinfo=timezone.utc)).total_seconds()
    return max(0.0, 1.0 - delta / (7 * 24 * 3600))


def geo_score(lat1: Optional[float], lng1: Optional[float], lat2: Optional[float], lng2: Optional[float]) -> float:
    if None in (lat1, lng1, lat2, lng2):
        return 0.5
    dx = (lat1 - lat2) * 111000
    dy = (lng1 - lng2) * 111000 * math.cos(math.radians(lat1))
    dist_m = math.sqrt(dx ** 2 + dy ** 2)
    return max(0.0, 1.0 - dist_m / 200000)


async def get_my_tag_ids(db: AsyncSession, user_id: uuid.UUID) -> set[int]:
    result = await db.execute(select(UserTag.tag_id).where(UserTag.user_id == user_id))
    return {r[0] for r in result.all()}


async def score_candidate(
    me: User,
    candidate: User,
    my_tags: set[int],
    candidate_tags: set[int],
) -> float:
    tb = TIER_BOOST.get(candidate.tier, 0.0)
    tag_overlap = len(my_tags & candidate_tags) / max(len(my_tags | candidate_tags), 1)
    rec = recency_score(candidate.last_active_at)
    prof = candidate.profile_score / 100.0
    geo = geo_score(me.lat, me.lng, candidate.lat, candidate.lng)
    rnd = random.random() * 0.05

    return 0.30 * tb + 0.25 * tag_overlap + 0.20 * rec + 0.10 * prof + 0.10 * geo + rnd


async def get_feed(
    db: AsyncSession,
    me: User,
    verified_only: bool = False,
    limit: int = 15,
) -> List[User]:
    """Return scored and filtered feed candidates."""
    # Base filters
    q = (
        select(User)
        .where(User.id != me.id)
        .where(User.is_shadowbanned == False)
        .where(User.is_banned == False)
        .where(User.is_stealth_mode == False)
        .where(User.is_18_mode_active == me.is_18_mode_active)
        # Only fully onboarded profiles can appear in the feed (C1).
        .where(User.birth_date.isnot(None))
        .where(User.gender.isnot(None))
    )

    if me.search_gender and me.search_gender != SearchGenderEnum.any:
        q = q.where(User.gender == me.search_gender)

    if verified_only:
        q = q.where(User.is_verified == True)

    # Anti-oligarch shield works both ways (L2):
    # - an oligarch never sees shielded users
    # - a shielded user never sees oligarchs
    if me.is_oligarch_mode:
        q = q.where(User.is_anti_oligarch == False)
    if me.is_anti_oligarch:
        q = q.where(User.is_oligarch_mode == False)

    # Exclude already swiped
    swiped_sq = select(Swipe.target_id).where(Swipe.actor_id == me.id)
    q = q.where(User.id.not_in(swiped_sq))

    # Exclude blocks (bilateral)
    blocked_by_me = select(Block.blocked_id).where(Block.blocker_id == me.id)
    blocking_me = select(Block.blocker_id).where(Block.blocked_id == me.id)
    q = q.where(User.id.not_in(blocked_by_me)).where(User.id.not_in(blocking_me))

    result = await db.execute(q.limit(200))
    candidates = result.scalars().all()

    my_tags = await get_my_tag_ids(db, me.id)

    scored = []
    for c in candidates:
        c_tags = await get_my_tag_ids(db, c.id)
        s = await score_candidate(me, c, my_tags, c_tags)
        scored.append((s, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:limit]]


async def handle_swipe(
    db: AsyncSession,
    me: User,
    target_id: uuid.UUID,
    action_type: str,
    vip_message: Optional[str] = None,
) -> dict:
    # 1. Check limits (only swipe/superlike caps gate the action itself; the VIP
    #    cap is evaluated later, only when a VIP signal would actually be sent).
    if me.swipes_left <= 0:
        return {"error": "swipe_limit"}
    if action_type == "superlike" and me.superlikes_left <= 0:
        return {"error": "superlike_limit"}

    # 2. Get target
    result = await db.execute(select(User).where(User.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        return {"error": "user_not_found"}

    # Shadow-ban: swipe recorded for actor but doesn't count for target
    from app.services.moderation import moderate_text
    clean_vip_msg = moderate_text(vip_message) if vip_message else None

    # Idempotent upsert: the UNIQUE(actor_id, target_id) constraint means a
    # repeated swipe (double-tap, or after a rewind) must update, not insert,
    # otherwise we get an IntegrityError -> 500 (C7).
    existing_r = await db.execute(
        select(Swipe).where(Swipe.actor_id == me.id, Swipe.target_id == target_id)
    )
    swipe = existing_r.scalar_one_or_none()
    if swipe is not None:
        # Already swiped this person. Only charge/proceed if the action changes
        # to a like that could create a match; never double-charge limits.
        already_like = swipe.action_type in (ActionTypeEnum.right, ActionTypeEnum.superlike, "right", "superlike")
        swipe.action_type = action_type
        if clean_vip_msg:
            swipe.vip_message = clean_vip_msg
        if already_like:
            # Nothing new to charge; report current (no new match created here).
            await db.commit()
            return {"is_match": False, "match_id": None}
    else:
        swipe = Swipe(
            actor_id=me.id,
            target_id=target_id,
            action_type=action_type,
            is_vip_like=me.is_oligarch_mode,
            vip_message=clean_vip_msg,
        )
        db.add(swipe)
        await db.flush()  # ensure swipe.id is available for VIP notification

    me.swipes_left -= 1
    if action_type == "superlike":
        me.superlikes_left -= 1

    match_id = None
    is_match = False

    if action_type in ("right", "superlike") and not me.is_shadowbanned:
        # VIP signal for oligarch — within the daily cap, or via a paid ticket (C8).
        if me.is_oligarch_mode and not target.is_anti_oligarch:
            vip_daily_cap = int(await get_config_value(db, "vip_daily_cap", "20"))
            can_signal = me.vip_signals_used < vip_daily_cap
            if not can_signal:
                from app.services.tickets import consume_ticket
                can_signal = await consume_ticket("vip_signal", me.id)
            if can_signal:
                me.vip_signals_used += 1
                vip_notif = VIPNotification(target_id=target.id, swipe_id=swipe.id)
                db.add(vip_notif)

        # Check mutual like
        mutual_result = await db.execute(
            select(Swipe).where(
                Swipe.actor_id == target_id,
                Swipe.target_id == me.id,
                Swipe.action_type.in_(["right", "superlike"]),
            )
        )
        mutual = mutual_result.scalar_one_or_none()

        if mutual:
            match = Match(
                user1_id=me.id,
                user2_id=target_id,
                is_18_room=(me.is_18_mode_active and target.is_18_mode_active),
                is_oligarch_reveal=me.is_oligarch_mode,
            )
            db.add(match)
            await db.flush()  # get match.id

            # Reveal the VIP notification on mutual match, regardless of which
            # side completed it. The notification is linked to whichever like
            # carried the VIP signal — this swipe or the mutual one.
            vip_r = await db.execute(
                select(VIPNotification).where(
                    VIPNotification.swipe_id.in_([swipe.id, mutual.id])
                )
            )
            for vn in vip_r.scalars().all():
                vn.is_revealed = True

            match_id = match.id
            is_match = True

    await db.commit()
    return {"is_match": is_match, "match_id": match_id}
