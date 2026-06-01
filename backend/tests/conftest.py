import os
# Disable the external geocoder in tests (deterministic, no network). Must be set
# before app modules import app.services.geocode.
os.environ.setdefault("GEOCODER_ENABLED", "0")

import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.core.deps import get_db
from app.core.security import create_jwt
from app.models.user import User, GenderEnum, SearchGenderEnum, TierEnum
from app.services.economy import seed_default_config

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def fake_redis():
    """Use an in-memory fake Redis so tests don't need a running server."""
    import fakeredis.aioredis as fr
    import app.core.redis as redis_mod
    redis_mod._redis = fr.FakeRedis(decode_responses=True)
    yield
    redis_mod._redis = None


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSession() as db:
        await seed_default_config(db)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def db():
    async with TestSession() as session:
        yield session


async def make_user(db: AsyncSession, **kwargs) -> User:
    from datetime import date
    defaults = dict(
        tg_id=abs(hash(str(kwargs))) % 10**9,
        name="Test",
        birth_date=date(1995, 1, 1),
        gender=GenderEnum.male,
        search_gender=SearchGenderEnum.female,
        tier=TierEnum.free,
        swipes_left=50,
        superlikes_left=0,
    )
    defaults.update(kwargs)
    user = User(**defaults)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_jwt(str(user.id))}"}
