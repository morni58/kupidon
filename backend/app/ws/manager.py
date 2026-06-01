"""WebSocket connection manager for chat rooms.

Tracks which users are present in each room so the API layer can suppress
Telegram push notifications when the recipient is already looking at the chat.
"""
import json
from collections import defaultdict
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)
        # room_id -> { user_id: connection_count }
        self._room_users: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    async def connect(self, room_id: str, ws: WebSocket, user_id: str | None = None):
        await ws.accept()
        self._rooms[room_id].add(ws)
        if user_id:
            self._room_users[room_id][user_id] += 1

    def disconnect(self, room_id: str, ws: WebSocket, user_id: str | None = None):
        self._rooms[room_id].discard(ws)
        if user_id and room_id in self._room_users:
            self._room_users[room_id][user_id] -= 1
            if self._room_users[room_id][user_id] <= 0:
                self._room_users[room_id].pop(user_id, None)
            if not self._room_users[room_id]:
                self._room_users.pop(room_id, None)
        if not self._rooms[room_id]:
            self._rooms.pop(room_id, None)

    def is_present(self, room_id: str, user_id: str) -> bool:
        """True if the given user currently has an open socket on this chat."""
        return self._room_users.get(room_id, {}).get(user_id, 0) > 0

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
