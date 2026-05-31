"""Geolocation: resolve nearest city, city autocomplete."""
import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.city import City
from app.schemas.user import GeoResolveRequest

router = APIRouter(prefix="/api/geo", tags=["geo"])


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(float(lat2) - float(lat1))
    dlng = math.radians(float(lng2) - float(lng1))
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


@router.post("/resolve")
async def resolve_city(
    body: GeoResolveRequest,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Find nearest city to given coordinates and save to user profile."""
    cities_r = await db.execute(select(City))
    cities = cities_r.scalars().all()
    if not cities:
        # No cities seeded — just save coordinates
        me.lat = body.lat
        me.lng = body.lng
        await db.commit()
        return {"city_id": None, "city_name": None, "lat": body.lat, "lng": body.lng}

    nearest = min(cities, key=lambda c: haversine_km(body.lat, body.lng, c.lat, c.lng))
    me.city_id = nearest.id
    me.lat = body.lat
    me.lng = body.lng
    await db.commit()
    return {
        "city_id": nearest.id,
        "city_name": nearest.name,
        "region": nearest.region,
        "lat": body.lat,
        "lng": body.lng,
    }


@router.get("/search")
async def search_cities(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Autocomplete city search."""
    result = await db.execute(
        select(City).where(City.name.ilike(f"{q}%")).limit(10)
    )
    cities = result.scalars().all()
    return [
        {"id": c.id, "name": c.name, "region": c.region, "lat": float(c.lat), "lng": float(c.lng)}
        for c in cities
    ]


@router.post("/set_city/{city_id}")
async def set_city(
    city_id: int,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    city_r = await db.execute(select(City).where(City.id == city_id))
    city = city_r.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    me.city_id = city.id
    me.lat = city.lat
    me.lng = city.lng
    await db.commit()
    return {"ok": True, "city_name": city.name}
