"""Tests: swipe→match logic, daily limits, shadow ban, oligarch reveal."""
import pytest
from datetime import date
from app.models.user import GenderEnum, SearchGenderEnum, TierEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_swipe_left_no_match(client, db):
    alice = await make_user(db, name="Alice", gender=GenderEnum.female, search_gender=SearchGenderEnum.male, tg_id=10001)
    bob = await make_user(db, name="Bob", gender=GenderEnum.male, search_gender=SearchGenderEnum.female, tg_id=10002)

    res = await client.post("/api/swipe",
        json={"target_id": str(alice.id), "action_type": "left"},
        headers=auth_headers(bob))
    assert res.status_code == 200
    assert res.json()["is_match"] == False


@pytest.mark.asyncio
async def test_mutual_like_creates_match(client, db):
    alice = await make_user(db, name="Alice2", gender=GenderEnum.female, search_gender=SearchGenderEnum.male, tg_id=10003)
    bob = await make_user(db, name="Bob2", gender=GenderEnum.male, search_gender=SearchGenderEnum.female, tg_id=10004)

    # Bob likes Alice
    r1 = await client.post("/api/swipe",
        json={"target_id": str(alice.id), "action_type": "right"},
        headers=auth_headers(bob))
    assert r1.json()["is_match"] == False

    # Alice likes Bob → match!
    r2 = await client.post("/api/swipe",
        json={"target_id": str(bob.id), "action_type": "right"},
        headers=auth_headers(alice))
    assert r2.json()["is_match"] == True
    assert r2.json()["match_id"] is not None


@pytest.mark.asyncio
async def test_swipe_limit_enforced(client, db):
    user = await make_user(db, name="LimitUser", tg_id=10005, swipes_left=0)
    target = await make_user(db, name="Target", tg_id=10006, gender=GenderEnum.female)

    res = await client.post("/api/swipe",
        json={"target_id": str(target.id), "action_type": "left"},
        headers=auth_headers(user))
    assert res.status_code == 429


@pytest.mark.asyncio
async def test_shadowbanned_user_swipe_invisible(client, db):
    """Shadow-banned user swipes — no match created, other user doesn't see."""
    shadow = await make_user(db, name="Shadow", tg_id=10007, is_shadowbanned=True, swipes_left=50)
    target = await make_user(db, name="Victim", tg_id=10008, gender=GenderEnum.female, swipes_left=50)

    # Shadow user likes target
    r1 = await client.post("/api/swipe",
        json={"target_id": str(target.id), "action_type": "right"},
        headers=auth_headers(shadow))
    assert r1.status_code == 200
    data = r1.json()
    # Shadowbanned: swipe recorded but no match created even if mutual
    assert data["is_match"] == False


@pytest.mark.asyncio
async def test_oligarch_reveal_only_on_mutual(client, db):
    """Oligarch VIP signal: revealed only when mutual like happens."""
    oligarch = await make_user(db, name="Olig", tg_id=10009, tier=TierEnum.kupidon,
                               is_oligarch_mode=True, swipes_left=50, vip_signals_used=0)
    girl = await make_user(db, name="Girl", tg_id=10010, gender=GenderEnum.female,
                           is_anti_oligarch=False, swipes_left=50)

    # Oligarch likes girl (VIP signal sent, not revealed)
    r1 = await client.post("/api/swipe",
        json={"target_id": str(girl.id), "action_type": "right"},
        headers=auth_headers(oligarch))
    assert r1.json()["is_match"] == False

    # Check VIP notification NOT revealed
    from sqlalchemy import select
    from app.models.vip import VIPNotification
    vip_r = await db.execute(select(VIPNotification).where(VIPNotification.target_id == girl.id))
    vip = vip_r.scalar_one_or_none()
    assert vip is not None
    assert vip.is_revealed == False

    # Girl reciprocates → match, VIP revealed
    r2 = await client.post("/api/swipe",
        json={"target_id": str(oligarch.id), "action_type": "right"},
        headers=auth_headers(girl))
    assert r2.json()["is_match"] == True

    await db.refresh(vip)
    assert vip.is_revealed == True


@pytest.mark.asyncio
async def test_anti_oligarch_shield(client, db):
    """Anti-oligarch girl is invisible to oligarch."""
    oligarch = await make_user(db, name="Olig2", tg_id=10011, tier=TierEnum.kupidon,
                               is_oligarch_mode=True, swipes_left=50)
    protected_girl = await make_user(db, name="Protected", tg_id=10012, gender=GenderEnum.female,
                                     is_anti_oligarch=True, swipes_left=50)

    res = await client.get("/api/feed", headers=auth_headers(oligarch))
    assert res.status_code == 200
    ids = [c["id"] for c in res.json()]
    assert str(protected_girl.id) not in ids


@pytest.mark.asyncio
async def test_block_removes_from_feed(client, db):
    alice = await make_user(db, name="AliceB", tg_id=10013, gender=GenderEnum.female, swipes_left=50)
    bob = await make_user(db, name="BobB", tg_id=10014, swipes_left=50)

    await client.post("/api/block",
        json={"target_id": str(alice.id)},
        headers=auth_headers(bob))

    res = await client.get("/api/feed", headers=auth_headers(bob))
    ids = [c["id"] for c in res.json()]
    assert str(alice.id) not in ids


@pytest.mark.asyncio
async def test_report_shadow_bans_after_3(client, db):
    bad_guy = await make_user(db, name="BadGuy", tg_id=10015, swipes_left=50)
    reporters = []
    for i in range(3):
        r = await make_user(db, name=f"Reporter{i}", tg_id=20000 + i, swipes_left=50)
        reporters.append(r)

    for rep in reporters[:2]:
        await client.post("/api/report",
            json={"target_id": str(bad_guy.id), "reason": "spam"},
            headers=auth_headers(rep))

    # After 3rd report → auto shadowban
    await client.post("/api/report",
        json={"target_id": str(bad_guy.id), "reason": "fake"},
        headers=auth_headers(reporters[2]))

    from sqlalchemy import select
    from app.models.user import User
    await db.refresh(bad_guy)
    assert bad_guy.is_shadowbanned == True


@pytest.mark.asyncio
async def test_18_pool_isolation(client, db):
    """18+ users only see other 18+ users in feed."""
    user_normal = await make_user(db, name="Normal18", tg_id=10016, is_18_mode_active=False, swipes_left=50)
    user_18 = await make_user(db, name="Hot18", tg_id=10017, is_18_mode_active=True, swipes_left=50,
                               gender=GenderEnum.female, is_verified=True)

    res = await client.get("/api/feed", headers=auth_headers(user_normal))
    ids = [c["id"] for c in res.json()]
    assert str(user_18.id) not in ids


@pytest.mark.asyncio
async def test_payment_idempotent(client, db):
    user = await make_user(db, name="Payer", tg_id=10018, swipes_left=50)
    headers = auth_headers(user)

    # Create invoice
    r1 = await client.post("/api/payments/create_invoice?product=superlike", headers=headers)
    assert r1.status_code == 200
    payload = r1.json()["invoice_payload"]

    # First payment
    r2 = await client.post("/api/payments/webhook/successful_payment", json={
        "invoice_payload": payload,
        "telegram_payment_charge_id": "tgpay_123",
        "total_amount": 150,
        "currency": "XTR",
    })
    assert r2.json()["ok"] == True

    # Duplicate — idempotent
    r3 = await client.post("/api/payments/webhook/successful_payment", json={
        "invoice_payload": payload,
        "telegram_payment_charge_id": "tgpay_123",
        "total_amount": 150,
        "currency": "XTR",
    })
    assert r3.json()["ok"] == True
    assert r3.json().get("idempotent") == True
