import json
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, Set[WebSocket]] = {
            "alerts": set(),
            "incidents": set(),
            "dashboard": set(),
        }

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[channel].add(websocket)
        logger.info("ws_connected", channel=channel, total=len(self.active_connections[channel]))

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self.active_connections[channel].discard(websocket)
        logger.info("ws_disconnected", channel=channel)

    async def broadcast(self, channel: str, message: dict) -> None:
        dead: set[WebSocket] = set()
        payload = json.dumps(message, default=str)
        for connection in self.active_connections.get(channel, set()):
            try:
                await connection.send_text(payload)
            except Exception:
                dead.add(connection)
        for conn in dead:
            self.active_connections[channel].discard(conn)


manager = ConnectionManager()


@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await manager.connect("alerts", websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect("alerts", websocket)


@router.websocket("/ws/incidents")
async def websocket_incidents(websocket: WebSocket):
    await manager.connect("incidents", websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect("incidents", websocket)


@router.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await manager.connect("dashboard", websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect("dashboard", websocket)
