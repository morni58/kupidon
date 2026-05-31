"""Tests: JWT auth and initData validation."""
import pytest
from app.core.security import create_jwt, decode_jwt


def test_jwt_roundtrip():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    token = create_jwt(user_id)
    assert decode_jwt(token) == user_id


def test_jwt_invalid():
    assert decode_jwt("bad.token.here") is None


def test_jwt_empty():
    assert decode_jwt("") is None


@pytest.mark.asyncio
async def test_profile_requires_auth(client):
    res = await client.get("/api/profile/me")
    assert res.status_code == 403  # no bearer
