"""Sprint 11: account export + soft delete."""
import pytest
from app.models.user import GenderEnum, SearchGenderEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_export_data(client, db):
    u = await make_user(db, name="Exporter", tg_id=110001, bio="привет", swipes_left=50)
    res = await client.get("/api/account/export", headers=auth_headers(u))
    assert res.status_code == 200
    body = res.json()
    assert body["profile"]["name"] == "Exporter"
    assert "stats" in body and "media" in body


@pytest.mark.asyncio
async def test_soft_delete_blocks_access_and_feed(client, db):
    victim = await make_user(db, name="Leaver", tg_id=110002, gender=GenderEnum.female,
                             search_gender=SearchGenderEnum.any, swipes_left=50)
    seeker = await make_user(db, name="Seeker11", tg_id=110003, gender=GenderEnum.male,
                             search_gender=SearchGenderEnum.any, swipes_left=50)

    res = await client.delete("/api/account", headers=auth_headers(victim))
    assert res.status_code == 200

    # Deleted account can no longer authenticate.
    me = await client.get("/api/profile/me", headers=auth_headers(victim))
    assert me.status_code == 401

    # And is gone from the feed.
    feed = await client.get("/api/feed", headers=auth_headers(seeker))
    assert str(victim.id) not in [c["id"] for c in feed.json()]
