"""Shared user-stats computation.

Used by the owner-only dashboard (/api/account/stats) and the gated
"view someone else's stats" endpoint (/api/profile/{id}/stats), which is
unlocked either by a Kupidon subscription or a one-off Stars purchase.
"""
from datetime import datetime, timezone

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.match import Match
from app.models.message import Message


async def compute_user_stats(db: AsyncSession, u: User, *, private: bool = True) -> dict:
    """Activity numbers + (optionally) anti-troll identity signals.

    ``private=True`` includes sensitive owner-only fields (trust_score and the
    city/gender change counters). Public viewers get the vanity metrics only.
    """
    from app.models.swipe import Swipe
    from app.models.vip import ProfileView

    likes_given = (await db.execute(select(func.count(Swipe.id)).where(
        Swipe.actor_id == u.id, Swipe.action_type.in_(["right", "superlike"])))).scalar_one()
    passes = (await db.execute(select(func.count(Swipe.id)).where(
        Swipe.actor_id == u.id, Swipe.action_type == "left"))).scalar_one()
    likes_received = (await db.execute(select(func.count(Swipe.id)).where(
        Swipe.target_id == u.id, Swipe.action_type.in_(["right", "superlike"])))).scalar_one()
    matches = (await db.execute(select(func.count(Match.id)).where(
        or_(Match.user1_id == u.id, Match.user2_id == u.id)))).scalar_one()
    messages = (await db.execute(select(func.count(Message.id)).where(Message.sender_id == u.id))).scalar_one()
    views = (await db.execute(select(func.count(ProfileView.id)).where(ProfileView.target_id == u.id))).scalar_one()

    days = 0
    if u.created_at:
        days = max(1, (datetime.now(timezone.utc) - u.created_at.replace(tzinfo=timezone.utc)).days + 1)
    total_swipes = likes_given + passes
    match_rate = round((matches / likes_given * 100), 1) if likes_given else 0.0

    out = {
        "member_since": u.created_at.isoformat() if u.created_at else None,
        "days_with_us": days,
        "likes_given": likes_given,
        "likes_received": likes_received,
        "passes": passes,
        "total_swipes": total_swipes,
        "matches": matches,
        "match_rate": match_rate,
        "messages_sent": messages,
        "views_received": views,
        "streak_days": u.streak_days,
        "profile_score": u.profile_score,
    }
    if private:
        out.update({
            "trust_score": u.trust_score,
            # Anti-troll signals (the funny "how many times you re-rolled yourself").
            "city_changes": u.city_changes or 0,
            "gender_changes": u.gender_changes or 0,
        })
    else:
        # Public viewers still see the anti-troll badges — that's the whole point
        # of paying to "scout" someone before matching.
        out.update({
            "city_changes": u.city_changes or 0,
            "gender_changes": u.gender_changes or 0,
        })
    return out
