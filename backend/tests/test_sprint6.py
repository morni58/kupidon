"""Sprint 6: Golden Key + boost."""
import pytest
from app.models.user import GenderEnum, SearchGenderEnum, TierEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_golden_key_creates_unlocked_match(client, db):
    rich = await make_user(db, name="Whale", tg_id=60001, tier=TierEnum.kupidon,
                           is_oligarch_mode=True, stars_balance=2000, swipes_left=50)
    target = await make_user(db, name="GoldTarget", tg_id=60002, gender=GenderEnum.female, swipes_left=50)

    res = await client.post("/api/buy_golden_contact", headers=auth_headers(rich),
                            json={"target_id": str(target.id)})
    assert res.status_code == 200, res.text
    assert res.json()["match_id"]

    # Stars charged, match unlocked both sides.
    await db.refresh(rich)
    assert rich.stars_balance == 1000
    import uuid as _uuid
    from sqlalchemy import select
    from app.models.match import Match
    m = (await db.execute(select(Match).where(Match.id == _uuid.UUID(res.json()["match_id"])))).scalar_one()
    assert m.tg_unlocked_user1 and m.tg_unlocked_user2


@pytest.mark.asyncio
async def test_golden_key_requires_kupidon(client, db):
    u = await make_user(db, name="Poor", tg_id=60003, tier=TierEnum.free, stars_balance=5000, swipes_left=50)
    t = await make_user(db, name="T2", tg_id=60004, gender=GenderEnum.female, swipes_left=50)
    res = await client.post("/api/buy_golden_contact", headers=auth_headers(u), json={"target_id": str(t.id)})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_golden_key_insufficient_stars(client, db):
    u = await make_user(db, name="LowStars", tg_id=60005, tier=TierEnum.kupidon,
                        is_oligarch_mode=True, stars_balance=100, swipes_left=50)
    t = await make_user(db, name="T3", tg_id=60006, gender=GenderEnum.female, swipes_left=50)
    res = await client.post("/api/buy_golden_contact", headers=auth_headers(u), json={"target_id": str(t.id)})
    assert res.status_code == 402


@pytest.mark.asyncio
async def test_boost_grant_and_lookup(db):
    """Boost is stored as a Redis TTL flag and surfaces via boosted_ids."""
    from app.services.tickets import grant_boost, boosted_ids
    u = await make_user(db, name="Boosted", tg_id=60007, swipes_left=50)
    other = await make_user(db, name="Plain", tg_id=60008, swipes_left=50)
    await grant_boost(u.id)
    ids = await boosted_ids([u.id, other.id])
    assert u.id in ids and other.id not in ids
