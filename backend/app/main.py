import os
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("cupidbot")

from app.core.config import settings
from app.core.redis import get_redis, close_redis
from app.api import auth, profile, feed, chats, reports, verify, media, payments, views, geo, account
from app.ws.chat import router as ws_router
from app.services.cron import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_redis()
    from app.services.economy import seed_default_config
    from app.services.bootstrap import ensure_schema, seed_tags
    from app.db.database import async_session_maker
    await ensure_schema()
    async with async_session_maker() as db:
        await seed_default_config(db)
    await seed_tags()
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
app.include_router(account.router)

# WebSocket
app.include_router(ws_router)

# Static media (Railway Volume / local dir)
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/app/media")
os.makedirs(MEDIA_ROOT, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    """Liveness + dependency check (DB + Redis)."""
    db_ok = redis_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.warning("health: db down: %s", e)
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception as e:
        logger.warning("health: redis down: %s", e)
    status = "ok" if (db_ok and redis_ok) else "degraded"
    code = 200 if status == "ok" else 503
    return JSONResponse(status_code=code, content={
        "status": status, "version": "3.0.0", "db": db_ok, "redis": redis_ok,
    })
