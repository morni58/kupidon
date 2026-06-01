"""Regression tests for Sprint 2 (profile editing, media reorder, safety)."""
import pytest
from datetime import date
from app.models.user import GenderEnum, SearchGenderEnum, TierEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_profile_edit_updates_core_fields(client, db):
    """U-EDIT: name, birth_date, gender, search_gender, bio are editable."""
    u = await make_user(db, name="EditMe", tg_id=40001, gender=GenderEnum.male,
                        search_gender=SearchGenderEnum.female, swipes_left=50)
    res = await client.patch("/api/profile/me", headers=auth_headers(u), json={
        "name": "Новое Имя",
        "birth_date": "1990-05-05",
        "gender": "female",
        "search_gender": "any",
        "bio": "Люблю горы",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Новое Имя"
    assert body["gender"] == "female"
    assert str(body["birth_date"]).startswith("1990-05-05")


@pytest.mark.asyncio
async def test_profile_edit_rejects_underage(client, db):
    u = await make_user(db, name="Young", tg_id=40002, swipes_left=50)
    today = date.today()
    underage = today.replace(year=today.year - 15).isoformat()
    res = await client.patch("/api/profile/me", headers=auth_headers(u), json={"birth_date": underage})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_media_reorder_sets_main(client, db):
    """Flexible photo management: reorder puts the chosen slot first."""
    from app.models.media import MediaSlot, MediaTypeEnum
    u = await make_user(db, name="Photog", tg_id=40003, swipes_left=50)
    for i in (1, 2, 3):
        db.add(MediaSlot(user_id=u.id, media_url=f"/media/{u.id}/p{i}.webp",
                         media_type=MediaTypeEnum.photo, slot_index=i))
    await db.commit()

    res = await client.post("/api/media/reorder", headers=auth_headers(u), json=[3, 1, 2])
    assert res.status_code == 200

    mine = await client.get("/api/media/mine", headers=auth_headers(u))
    slots = sorted(mine.json(), key=lambda s: s["slot_index"])
    assert slots[0]["media_url"].endswith("p3.webp")


@pytest.mark.asyncio
async def test_report_then_block_flow(client, db):
    a = await make_user(db, name="Reporter", tg_id=40004, swipes_left=50)
    bad = await make_user(db, name="Bad", tg_id=40005, gender=GenderEnum.female, swipes_left=50)

    r1 = await client.post("/api/report", headers=auth_headers(a),
                           json={"target_id": str(bad.id), "reason": "abuse"})
    assert r1.status_code == 200
    # duplicate report rejected
    r2 = await client.post("/api/report", headers=auth_headers(a),
                           json={"target_id": str(bad.id), "reason": "abuse"})
    assert r2.status_code == 409
