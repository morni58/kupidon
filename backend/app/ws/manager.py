"""WebSocket connection manager for chat rooms."""
import asyncio
import json
from collections import defaultdict
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, room_id: str, ws: WebSocket):
        await ws.accept()
        self._rooms[room_id].add(ws)

    def disconnect(self, room_id: str, ws: WebSocket):
        self._rooms[room_id].discard(ws)
        if not self._rooms[room_id]:
            del self._rooms[room_id]

    async def broadcast(self, room_id: str, data: dict):
        message = json.dumps(data)
        dead = set()
        for ws in list(self._rooms.get(room_id, [])):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._rooms[room_id].discard(ws)


ws_manager = ConnectionManager()
