import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.redis import get_redis, close_redis
from app.api import auth, profile, feed, chats, reports, verify, media, payments, views, geo
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


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Turn race-condition DB conflicts into a clean 409 instead of 500 (C7/C10)."""
    return JSONResponse(status_code=409, content={"detail": "conflict"})


# CORS: allow configured frontends in prod, fall back to "*" in development.
_origins_env = os.environ.get("CORS_ORIGINS", "").strip()
if _origins_env:
    _allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    _allow_credentials = True
else:
    # "*" cannot be combined with credentials per the CORS spec; the app uses
    # Bearer tokens (not cookies), so credentials are not needed here (S2).
    _allow_origins = ["*"]
    _allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
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
app.include_router(geo.router)

# WebSocket
app.include_router(ws_router)

# Static media (Railway Volume / local dir)
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")
os.makedirs(MEDIA_ROOT, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0"}
