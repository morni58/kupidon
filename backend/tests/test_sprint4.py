"""Geo tests (Sprint 4). Run with GEOCODER_ENABLED=0 so we exercise the
local-DB fallback path without hitting the network."""
import pytest
from app.models.user import GenderEnum
from app.models.city import City
from tests.conftest import make_user, auth_headers


async def _seed_city(db, name="Москва", region="Москва", lat=55.75, lng=37.61):
    c = City(name=name, region=region, country="RU", lat=lat, lng=lng)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest.mark.asyncio
async def test_geo_search_local_db(client, db):
    await _seed_city(db, name="Тестоград", region="ТО", lat=50.0, lng=50.0)
    u = await make_user(db, name="GeoU", tg_id=50001, swipes_left=50)
    res = await client.get("/api/geo/search?q=Тесто", headers=auth_headers(u))
    assert res.status_code == 200
    names = [c["name"] for c in res.json()]
    assert "Тестоград" in names


@pytest.mark.asyncio
async def test_geo_set_place_upserts_and_attaches(client, db):
    u = await make_user(db, name="Placer", tg_id=50002, swipes_left=50)
    res = await client.post("/api/geo/set_place", headers=auth_headers(u), json={
        "name": "Малые Васюки", "region": "Тестовская обл.", "country": "RU",
        "lat": 51.1, "lng": 39.2,
    })
    assert res.status_code == 200
    assert res.json()["city_name"] == "Малые Васюки"

    full = await client.get("/api/profile/full", headers=auth_headers(u))
    assert full.json()["city_name"] == "Малые Васюки"


@pytest.mark.asyncio
async def test_geo_resolve_fallback_nearest(client, db):
    near = await _seed_city(db, name="Близкий", region="Б", lat=60.0, lng=60.0)
    u = await make_user(db, name="Resolver", tg_id=50003, swipes_left=50)
    res = await client.post("/api/geo/resolve", headers=auth_headers(u), json={"lat": 60.01, "lng": 60.01})
    assert res.status_code == 200
    # With the geocoder disabled it must fall back to the nearest seeded city.
    assert res.json()["city_id"] is not None
