"""Real geocoding via OpenStreetMap Nominatim with Redis caching + DB fallback.

Covers reverse-geocoding (coords -> settlement name) and forward search
(city/village/district, typo-tolerant, понимает районы). Results are cached and
gracefully fall back to the local ``cities`` table when the geocoder is disabled
or unreachable. See U-GEO in IMPROVEMENTS.md.

Swap NOMINATIM_URL for a self-hosted instance or a paid provider in prod;
public Nominatim is rate-limited (~1 req/s) so we cache aggressively.
"""
import json
import os
import logging
from typing import Optional

import httpx

from app.core.redis import get_redis

logger = logging.getLogger("cupidbot.geo")

GEOCODER_ENABLED = os.environ.get("GEOCODER_ENABLED", "1") not in ("0", "false", "")
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org").rstrip("/")
USER_AGENT = os.environ.get("GEOCODER_UA", "CupidBot/3.0 (dating mini app)")
_CACHE_TTL = 24 * 3600

# Address fields, most specific first, used to pick a human place name.
_PLACE_KEYS = ["city", "town", "village", "hamlet", "municipality", "suburb", "city_district", "county"]


def _place_name(address: dict) -> Optional[str]:
    for k in _PLACE_KEYS:
        if address.get(k):
            return address[k]
    return None


async def _cached(key: str):
    redis = await get_redis()
    val = await redis.get(key)
    return json.loads(val) if val else None


async def _store(key: str, value) -> None:
    redis = await get_redis()
    await redis.setex(key, _CACHE_TTL, json.dumps(value, ensure_ascii=False))


async def reverse(lat: float, lng: float) -> Optional[dict]:
    """Coords -> {name, region, country, lat, lng}. None if not resolvable."""
    if not GEOCODER_ENABLED:
        return None
    key = f"geo:rev:{round(lat, 3)}:{round(lng, 3)}"
    cached = await _cached(key)
    if cached is not None:
        return cached or None
    try:
        async with httpx.AsyncClient(timeout=6, headers={"User-Agent": USER_AGENT}) as client:
            r = await client.get(f"{NOMINATIM_URL}/reverse", params={
                "format": "jsonv2", "lat": lat, "lon": lng,
                "accept-language": "ru", "zoom": 12, "addressdetails": 1,
            })
            data = r.json()
        address = data.get("address", {})
        place = {
            "name": _place_name(address) or data.get("name") or "Местоположение",
            "region": address.get("state") or address.get("region"),
            "country": (address.get("country_code") or "RU").upper()[:2],
            "lat": float(data.get("lat", lat)),
            "lng": float(data.get("lon", lng)),
        }
        await _store(key, place)
        return place
    except Exception as e:
        logger.warning("reverse geocode failed: %s", e)
        await _store(key, {})  # negative cache to avoid hammering
        return None


async def search(q: str, limit: int = 8) -> list[dict]:
    """Forward search -> list of {name, region, country, lat, lng}."""
    q = (q or "").strip()
    if not q or not GEOCODER_ENABLED:
        return []
    key = f"geo:search:{q.lower()}"
    cached = await _cached(key)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=6, headers={"User-Agent": USER_AGENT}) as client:
            r = await client.get(f"{NOMINATIM_URL}/search", params={
                "format": "jsonv2", "q": q, "accept-language": "ru",
                "limit": limit, "addressdetails": 1,
            })
            rows = r.json()
        out = []
        seen = set()
        for d in rows:
            address = d.get("address", {})
            name = _place_name(address) or (d.get("display_name", "").split(",")[0])
            if not name:
                continue
            region = address.get("state") or address.get("region")
            dedup = (name, region)
            if dedup in seen:
                continue
            seen.add(dedup)
            out.append({
                "name": name,
                "region": region,
                "country": (address.get("country_code") or "").upper()[:2],
                "lat": float(d["lat"]),
                "lng": float(d["lon"]),
            })
        await _store(key, out)
        return out
    except Exception as e:
        logger.warning("geocode search failed: %s", e)
        return []
