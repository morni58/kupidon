"""Sprint 8: age gating + age-pool segregation (U-AGE safety)."""
import pytest
from app.models.user import GenderEnum, SearchGenderEnum
from app.core.agehelp import birthdate_n_years_ago
from tests.conftest import make_user, auth_headers


@pytest.mark.asyncio
async def test_onboarding_min_age(client, db):
    u = await make_user(db, name="Newbie", tg_id=80001, swipes_left=50)
    u.birth_date = None
    await db.commit()

    too_young = birthdate_n_years_ago(15).isoformat()
    r1 = await client.post("/api/onboarding", headers=auth_headers(u), json={
        "name": "Юный", "birth_date": too_young, "gender": "male", "search_gender": "female"})
    assert r1.status_code == 422

    ok_age = birthdate_n_years_ago(16).isoformat()
    r2 = await client.post("/api/onboarding", headers=auth_headers(u), json={
        "name": "Норм", "birth_date": ok_age, "gender": "male", "search_gender": "female"})
    assert r2.status_code == 200, r2.text


@pytest.mark.asyncio
async def test_age_pool_segregation(client, db):
    adult = await make_user(db, name="Adult", tg_id=80002, gender=GenderEnum.male,
                            search_gender=SearchGenderEnum.any, swipes_left=50,
                            birth_date=birthdate_n_years_ago(25))
    minor = await make_user(db, name="Minor", tg_id=80003, gender=GenderEnum.female,
                            search_gender=SearchGenderEnum.any, swipes_left=50,
                            birth_date=birthdate_n_years_ago(16))
    adult2 = await make_user(db, name="Adult2", tg_id=80004, gender=GenderEnum.female,
                             search_gender=SearchGenderEnum.any, swipes_left=50,
                             birth_date=birthdate_n_years_ago(22))

    # Adult sees adults only.
    res = await client.get("/api/feed", headers=auth_headers(adult))
    ids = [c["id"] for c in res.json()]
    assert str(adult2.id) in ids
    assert str(minor.id) not in ids

    # Minor sees minors only (not the adult).
    res2 = await client.get("/api/feed", headers=auth_headers(minor))
    ids2 = [c["id"] for c in res2.json()]
    assert str(adult.id) not in ids2
    assert str(adult2.id) not in ids2


@pytest.mark.asyncio
async def test_18plus_mode_blocked_for_minor(client, db):
    minor = await make_user(db, name="MinorV", tg_id=80005, gender=GenderEnum.female,
                            swipes_left=50, is_verified=True,
                            birth_date=birthdate_n_years_ago(16))
    res = await client.patch("/api/profile/me", headers=auth_headers(minor),
                             json={"is_18_mode_active": True})
    assert res.status_code == 403
