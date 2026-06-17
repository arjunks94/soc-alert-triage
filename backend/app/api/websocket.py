import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.logging import get_logger
from app.core.security import decode_token
from app.database.session import AsyncSessionLocal
from app.models.models import User
from sqlalchemy import select

logger = get_logger(__name__)
router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {
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


async def _authenticate_ws(token: Optional[str]) -> bool:
    if not token:
        return False
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return False
        user_id = payload.get("sub")
        if not user_id:
            return False
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == UUID(user_id), User.is_active.is_(True))
            )
            return result.scalar_one_or_none() is not None
    except (JWTError, ValueError):
        return False


async def _ws_handler(websocket: WebSocket, channel: str) -> None:
    token = websocket.query_params.get("token")
    if not await _authenticate_ws(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(channel, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)


@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket, token: Optional[str] = Query(None)):
    await _ws_handler(websocket, "alerts")


@router.websocket("/ws/incidents")
async def websocket_incidents(websocket: WebSocket, token: Optional[str] = Query(None)):
    await _ws_handler(websocket, "incidents")


@router.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket, token: Optional[str] = Query(None)):
    await _ws_handler(websocket, "dashboard")
