"""WebSocket endpoint for chat with Long Polling fallback."""
import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from app.core.security import decode_jwt
from app.db.database import async_session_maker
from app.models.user import User
from app.models.match import Match
from app.ws.manager import ws_manager

router = APIRouter()


@router.websocket("/ws/chat/{match_id}")
async def chat_ws(
    match_id: str,
    ws: WebSocket,
    token: str = Query(...),
):
    # Auth
    user_id = decode_jwt(token)
    if not user_id:
        await ws.close(code=4001)
        return

    async with async_session_maker() as db:
        user_r = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = user_r.scalar_one_or_none()
        if not user:
            await ws.close(code=4001)
            return

        match_r = await db.execute(select(Match).where(Match.id == uuid.UUID(match_id)))
        match = match_r.scalar_one_or_none()
        if not match or user.id not in (match.user1_id, match.user2_id):
            await ws.close(code=4003)
            return

        # Update last_active
        from datetime import datetime, timezone
        user.last_active_at = datetime.now(timezone.utc)
        await db.commit()

    await ws_manager.connect(match_id, ws)
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue

            event = msg.get("type")
            if event == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
            elif event == "typing":
                await ws_manager.broadcast(match_id, {
                    "type": "typing",
                    "user_id": user_id,
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(match_id, ws)
