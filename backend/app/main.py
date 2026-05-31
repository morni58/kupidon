from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.redis import get_redis, close_redis
from app.api import auth, profile, feed, chats, reports, verify, media, payments, views
from app.ws.chat import router as ws_router
from app.services.cron import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_redis()
    from app.services.economy import seed_default_config
    from app.db.database import async_session_maker
    async with async_session_maker() as db:
        await seed_default_config(db)
    scheduler = start_scheduler()
    yield
    # Shutdown
    scheduler.shutdown()
    await close_redis()


app = FastAPI(title="CupidBot API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(feed.router)
app.include_router(chats.router)
app.include_router(reports.router)
app.include_router(verify.router)
app.include_router(media.router)
app.include_router(payments.router)
app.include_router(views.router)

# WebSocket
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0"}
