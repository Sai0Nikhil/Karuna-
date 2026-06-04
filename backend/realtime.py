"""KARUNA backend — WebSocket connection manager.

Every connected client receives every case mutation event. For the demo
this is fine; for production we would filter by NGO / city / role.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

log = logging.getLogger("karuna.realtime")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        log.info("WS connected — total=%d", len(self._connections))
        try:
            await ws.send_text(json.dumps({"type": "hello", "connections": len(self._connections)}))
        except Exception:
            pass

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
        log.info("WS disconnected — total=%d", len(self._connections))

    async def broadcast(self, event: dict[str, Any]) -> None:
        """Fire-and-forget broadcast to every live socket. Dead sockets are dropped."""
        if not self._connections:
            return
        payload = json.dumps(event, default=str)
        dead: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)


manager = ConnectionManager()


async def ws_endpoint(ws: WebSocket) -> None:
    """Default WebSocket route handler — clients only listen, no inbound messages."""
    await manager.connect(ws)
    try:
        while True:
            # Keep the connection alive; ignore inbound text (ping or similar)
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning("WS error: %s", e)
    finally:
        await manager.disconnect(ws)
