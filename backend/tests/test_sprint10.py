"""Sprint 10: health check + message pagination."""
import pytest
from app.models.user import GenderEnum, SearchGenderEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_health_ok(client):
    res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["db"] is True and body["redis"] is True


@pytest.mark.asyncio
async def test_messages_pagination(client, db):
    a = await make_user(db, name="PgA", tg_id=90001, gender=GenderEnum.male,
                        search_gender=SearchGenderEnum.female, swipes_left=50)
    b = await make_user(db, name="PgB", tg_id=90002, gender=GenderEnum.female,
                        search_gender=SearchGenderEnum.male, swipes_left=50)
    await client.post("/api/swipe", json={"target_id": str(b.id), "action_type": "right"}, headers=auth_headers(a))
    r = await client.post("/api/swipe", json={"target_id": str(a.id), "action_type": "right"}, headers=auth_headers(b))
    match_id = r.json()["match_id"]

    for i in range(5):
        await client.post(f"/api/chats/{match_id}/messages",
                          json={"content": f"m{i}", "msg_type": "text"}, headers=auth_headers(a))

    res = await client.get(f"/api/chats/{match_id}/messages?limit=2", headers=auth_headers(a))
    assert res.status_code == 200
    assert len(res.json()) == 2  # limit respected

    res_all = await client.get(f"/api/chats/{match_id}/messages", headers=auth_headers(a))
    assert len(res_all.json()) == 5
