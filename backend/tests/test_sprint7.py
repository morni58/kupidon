"""Sprint 7: paid tag requests + feed tag filter."""
import pytest
from app.models.user import GenderEnum, SearchGenderEnum
from app.models.tag import AdminTag, UserTag, TagRequest, TagRequestStatusEnum
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_request_tag_charges_and_pends(client, db):
    u = await make_user(db, name="Tagger", tg_id=70001, stars_balance=500, swipes_left=50)
    res = await client.post("/api/tags/request", headers=auth_headers(u),
                            json={"name": "Воркаут", "emoji": "💪", "category": "Спорт"})
    assert res.status_code == 200, res.text
    await db.refresh(u)
    assert u.stars_balance == 300  # 500 - 200

    from sqlalchemy import select
    reqs = (await db.execute(select(TagRequest).where(TagRequest.user_id == u.id))).scalars().all()
    assert len(reqs) == 1 and reqs[0].status == TagRequestStatusEnum.pending


@pytest.mark.asyncio
async def test_request_tag_insufficient_stars(client, db):
    u = await make_user(db, name="Broke", tg_id=70002, stars_balance=10, swipes_left=50)
    res = await client.post("/api/tags/request", headers=auth_headers(u), json={"name": "Дайвинг"})
    assert res.status_code == 402


@pytest.mark.asyncio
async def test_request_tag_duplicate_existing(client, db):
    db.add(AdminTag(name="Шахматы", color_hex="#000000", emoji="♟️", is_active=True))
    await db.commit()
    u = await make_user(db, name="Dup", tg_id=70003, stars_balance=500, swipes_left=50)
    res = await client.post("/api/tags/request", headers=auth_headers(u), json={"name": "шахматы"})
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_feed_tag_filter(client, db):
    tag = AdminTag(name="Рыбалка", color_hex="#3B82F6", emoji="🎣", is_active=True)
    db.add(tag)
    await db.flush()
    searcher = await make_user(db, name="Seeker", tg_id=70004, gender=GenderEnum.male,
                               search_gender=SearchGenderEnum.any, swipes_left=50)
    with_tag = await make_user(db, name="Angler", tg_id=70005, gender=GenderEnum.female, swipes_left=50)
    without = await make_user(db, name="NoTag", tg_id=70006, gender=GenderEnum.female, swipes_left=50)
    db.add(UserTag(user_id=with_tag.id, tag_id=tag.id))
    await db.commit()

    res = await client.get(f"/api/feed?tags={tag.id}", headers=auth_headers(searcher))
    assert res.status_code == 200
    ids = [c["id"] for c in res.json()]
    assert str(with_tag.id) in ids
    assert str(without.id) not in ids
