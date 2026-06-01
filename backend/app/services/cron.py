"""Daily CRON jobs: reset counters, streaks, burned media cleanup."""
import asyncio
from datetime import date, datetime, timezone, timedelta
from sqlalchemy import update, select, delete

from app.db.database import async_session_maker
from app.models.user import User, TierEnum
from app.models.message import Message
from app.services.economy import get_config_value


async def daily_reset():
    """00:00 MSK reset: swipes, force_chats, vip_signals, superlikes, streaks."""
    async with async_session_maker() as db:
        free_sw = int(await get_config_value(db, "free_swipes_daily", "50"))
        prem_sw = int(await get_config_value(db, "premium_swipes", "200"))
        kup_sw = int(await get_config_value(db, "kupidon_swipes", "500"))

        today = date.today()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=36)

        users_r = await db.execute(select(User).where(User.is_banned == False))
        users = users_r.scalars().all()

        now = datetime.now(timezone.utc)
        for user in users:
            # Expire paid subscriptions whose term has ended -> back to free.
            if user.tier != TierEnum.free and user.tier_until is not None:
                tu = user.tier_until
                if tu.tzinfo is None:
                    tu = tu.replace(tzinfo=timezone.utc)
                if tu < now:
                    user.tier = TierEnum.free
                    user.tier_until = None
                    user.is_oligarch_mode = False
                    user.is_stealth_mode = False

            # Reset daily counters
            if user.tier == TierEnum.free:
                user.swipes_left = free_sw
                user.superlikes_left = 0
            elif user.tier == TierEnum.premium:
                user.swipes_left = prem_sw
                user.superlikes_left = 5
            elif user.tier == TierEnum.kupidon:
                user.swipes_left = kup_sw
                user.superlikes_left = 5

            user.force_chats_used = 0
            user.vip_signals_used = 0

            # Streak logic
            if user.last_active_at and user.last_active_at.replace(tzinfo=timezone.utc) >= cutoff:
                if user.last_streak_date != today:
                    user.streak_days = (user.streak_days or 0) + 1
                    user.last_streak_date = today

                    # Streak rewards: 3/7/14
                    if user.streak_days in (3, 7, 14):
                        user.superlikes_left += 1
                        user.swipes_left += 20
            else:
                user.streak_days = 0

        await db.commit()


async def daily_engagement_push():
    """Once a day, tell users how many people viewed their profile (U-NOTIF).
    Only for recently-active users with a meaningful count — not spammy."""
    from app.models.vip import ProfileView
    from sqlalchemy import func
    from app.services import notifications as notif

    async with async_session_maker() as db:
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        rows = await db.execute(
            select(ProfileView.target_id, func.count(ProfileView.id))
            .where(ProfileView.created_at >= day_ago)
            .group_by(ProfileView.target_id)
        )
        counts = {tid: c for tid, c in rows.all()}
        if not counts:
            return
        users_r = await db.execute(
            select(User).where(User.id.in_(list(counts.keys())), User.last_active_at >= week_ago)
        )
        for user in users_r.scalars().all():
            c = counts.get(user.id, 0)
            if c >= 3:
                await notif.notify_profile_views(user.tg_id, c)


async def hourly_cleanup():
    """Clean burned messages and stale Redis feed caches."""
    async with async_session_maker() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        await db.execute(
            delete(Message).where(
                Message.is_burned == True,
                Message.created_at < cutoff,
            )
        )
        await db.commit()


def start_scheduler():
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = AsyncIOScheduler()
    # Daily reset at 00:00 Moscow time (UTC+3 = 21:00 UTC)
    scheduler.add_job(daily_reset, CronTrigger(hour=21, minute=0, timezone="UTC"))
    # Hourly cleanup
    scheduler.add_job(hourly_cleanup, CronTrigger(minute=0))
    # Daily engagement push at 18:00 UTC (21:00 MSK).
    scheduler.add_job(daily_engagement_push, CronTrigger(hour=18, minute=0, timezone="UTC"))
    scheduler.start()
    return scheduler
