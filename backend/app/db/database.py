from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
