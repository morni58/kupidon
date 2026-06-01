"""Sprint 13: subscription expiry."""
import pytest
from datetime import datetime, timezone, timedelta
from app.models.user import TierEnum
from app.services.payments_apply import apply_payment_effect
import app.services.cron as cron_mod
from app.services.cron import daily_reset
from tests.conftest import make_user, auth_headers, TestSession


@pytest.fixture(autouse=True)
def _patch_cron_session(monkeypatch):
    # cron opens its own session via async_session_maker; point it at the test DB.
    monkeypatch.setattr(cron_mod, "async_session_maker", TestSession)


@pytest.mark.asyncio
async def test_payment_sets_tier_until(db):
    u = await make_user(db, name="Sub", tg_id=130001, swipes_left=0)
    await apply_payment_effect(u, "premium_month", 199)
    await db.commit()
    assert u.tier == TierEnum.premium
    assert u.tier_until is not None
    delta = u.tier_until.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)
    assert timedelta(days=29) < delta < timedelta(days=31)


@pytest.mark.asyncio
async def test_expired_subscription_downgrades(db):
    u = await make_user(db, name="Expired", tg_id=130002, tier=TierEnum.kupidon,
                        is_oligarch_mode=True, swipes_left=500)
    u.tier_until = datetime.now(timezone.utc) - timedelta(days=1)
    await db.commit()

    await daily_reset()

    await db.refresh(u)
    assert u.tier == TierEnum.free
    assert u.tier_until is None
    assert u.is_oligarch_mode is False


@pytest.mark.asyncio
async def test_admin_grant_without_expiry_persists(db):
    """Permanent (admin) grants have tier_until=None and must not be downgraded."""
    u = await make_user(db, name="VIPperm", tg_id=130003, tier=TierEnum.kupidon, swipes_left=500)
    assert u.tier_until is None
    await daily_reset()
    await db.refresh(u)
    assert u.tier == TierEnum.kupidon
