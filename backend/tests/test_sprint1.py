"""Regression tests for Sprint 1 critical fixes (see IMPROVEMENTS.md)."""
import pytest
from app.models.user import GenderEnum, SearchGenderEnum, TierEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_feed_skips_non_onboarded_user(client, db):
    """C1: a user without birth_date/gender must not appear and must not crash the feed."""
    searcher = await make_user(db, name="Searcher", tg_id=30001,
                               gender=GenderEnum.male, search_gender=SearchGenderEnum.any, swipes_left=50)
    half = await make_user(db, name="Half", tg_id=30002, swipes_left=50)
    half.birth_date = None
    half.gender = None
    await db.commit()

    res = await client.get("/api/feed", headers=auth_headers(searcher))
    assert res.status_code == 200
    ids = [c["id"] for c in res.json()]
    assert str(half.id) not in ids


@pytest.mark.asyncio
async def test_force_chat_free_requires_ticket_then_works(client, db):
    """C2: free user gets 402 without a paid ticket, succeeds after one is granted."""
    from app.services.tickets import grant_force_chat_ticket

    free = await make_user(db, name="FreeFC", tg_id=30003, tier=TierEnum.free, swipes_left=50)
    target = await make_user(db, name="FCTarget", tg_id=30004, gender=GenderEnum.female, swipes_left=50)

    r1 = await client.post("/api/force_chat", json={"target_id": str(target.id)}, headers=auth_headers(free))
    assert r1.status_code == 402

    await grant_force_chat_ticket(free.id)
    r2 = await client.post("/api/force_chat", json={"target_id": str(target.id)}, headers=auth_headers(free))
    assert r2.status_code == 200
    assert r2.json()["match_id"]


@pytest.mark.asyncio
async def test_messages_count_increments_per_message(client, db):
    """C3: TG unlock counter grows on every real message, not only after a reply."""
    a = await make_user(db, name="MsgA", tg_id=30005, gender=GenderEnum.male,
                        search_gender=SearchGenderEnum.female, swipes_left=50)
    b = await make_user(db, name="MsgB", tg_id=30006, gender=GenderEnum.female,
                        search_gender=SearchGenderEnum.male, swipes_left=50)
    await client.post("/api/swipe", json={"target_id": str(b.id), "action_type": "right"}, headers=auth_headers(a))
    r = await client.post("/api/swipe", json={"target_id": str(a.id), "action_type": "right"}, headers=auth_headers(b))
    match_id = r.json()["match_id"]

    for _ in range(3):
        await client.post(f"/api/chats/{match_id}/messages",
                          json={"content": "привет", "msg_type": "text"}, headers=auth_headers(a))

    info = await client.get(f"/api/chats/{match_id}/info", headers=auth_headers(a))
    assert info.json()["messages_count"] == 3
    assert info.json()["my_messages"] == 3
