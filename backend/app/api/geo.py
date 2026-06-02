"""Geolocation: real reverse-geocoding + smart city/village/district search.

Backed by app.services.geocode (Nominatim + cache) with a graceful fallback to
the local ``cities`` table. Resolved places are upserted into ``cities`` so the
rest of the app keeps using ``city_id``. See U-GEO in IMPROVEMENTS.md.
"""
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.city import City
from app.schemas.user import GeoResolveRequest
from app.services import geocode

router = APIRouter(prefix="/api/geo", tags=["geo"])


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(float(lat2) - float(lat1))
    dlng = math.radians(float(lng2) - float(lng1))
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


async def find_or_create_city(db: AsyncSession, name: str, region: Optional[str],
                              country: Optional[str], lat: float, lng: float) -> City:
    """Look up a city by name (+region), creating it if missing."""
    q = select(City).where(func.lower(City.name) == name.lower())
    if region:
        q = q.where(City.region == region)
    existing = (await db.execute(q.limit(1))).scalar_one_or_none()
    if existing:
        return existing
    city = City(name=name, region=region, country=(country or "RU")[:2], lat=lat, lng=lng)
    db.add(city)
    await db.flush()
    return city


def _set_user_city(me: User, city: City, lat: float, lng: float) -> None:
    # Count a real city change (anti-troll signal), ignore first set / same city.
    if me.city_id and me.city_id != city.id:
        me.city_changes = (me.city_changes or 0) + 1
    me.city_id = city.id
    me.lat = lat
    me.lng = lng


@router.post("/resolve")
async def resolve_city(
    body: GeoResolveRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Reverse-geocode the coordinates to a real settlement and save it."""
    place = await geocode.reverse(body.lat, body.lng)
    if place:
        city = await find_or_create_city(db, place["name"], place.get("region"),
                                         place.get("country"), body.lat, body.lng)
        _set_user_city(me, city, body.lat, body.lng)
        await db.commit()
        return {"city_id": city.id, "city_name": city.name, "region": city.region,
                "lat": body.lat, "lng": body.lng}

    # Fallback: nearest seeded city.
    cities = (await db.execute(select(City))).scalars().all()
    if not cities:
        me.lat, me.lng = body.lat, body.lng
        await db.commit()
        return {"city_id": None, "city_name": None, "lat": body.lat, "lng": body.lng}
    nearest = min(cities, key=lambda c: haversine_km(body.lat, body.lng, c.lat, c.lng))
    _set_user_city(me, nearest, body.lat, body.lng)
    await db.commit()
    return {"city_id": nearest.id, "city_name": nearest.name, "region": nearest.region,
            "lat": body.lat, "lng": body.lng}


@router.get("/search")
async def search_cities(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Smart search: local DB first, augmented with the geocoder (villages,
    districts, typo-tolerant). Items without ``id`` are confirmed via /set_place."""
    results: list[dict] = []
    seen = set()

    # Local DB (substring, not just prefix).
    rows = (await db.execute(
        select(City).where(City.name.ilike(f"%{q}%")).limit(8)
    )).scalars().all()
    for c in rows:
        key = (c.name.lower(), c.region)
        seen.add(key)
        results.append({"id": c.id, "name": c.name, "region": c.region,
                        "lat": float(c.lat), "lng": float(c.lng)})

    # Geocoder augmentation.
    for p in await geocode.search(q):
        key = (p["name"].lower(), p.get("region"))
        if key in seen:
            continue
        seen.add(key)
        results.append({"id": None, "name": p["name"], "region": p.get("region"),
                        "country": p.get("country"), "lat": p["lat"], "lng": p["lng"]})

    return results[:12]


class SetPlaceRequest(BaseModel):
    name: str
    region: Optional[str] = None
    country: Optional[str] = "RU"
    lat: float
    lng: float


@router.post("/set_place")
async def set_place(
    body: SetPlaceRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Confirm a place (typed or picked from search) — upsert + attach to user."""
    city = await find_or_create_city(db, body.name, body.region, body.country, body.lat, body.lng)
    _set_user_city(me, city, body.lat, body.lng)
    await db.commit()
    return {"ok": True, "city_id": city.id, "city_name": city.name}


@router.post("/set_city/{city_id}")
async def set_city(
    city_id: int,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    city = (await db.execute(select(City).where(City.id == city_id))).scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    _set_user_city(me, city, city.lat, city.lng)
    await db.commit()
    return {"ok": True, "city_name": city.name}
