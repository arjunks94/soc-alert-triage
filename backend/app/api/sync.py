import asyncio
import threading
from datetime import datetime, timezone
from typing import Any, Optional

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.security import get_current_user, require_role
from app.models.models import User
from app.services.sentinelone_client import SentinelOneClient

router = APIRouter(prefix="/sync", tags=["Sync"])

settings = get_settings()
sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)

_sync_lock = threading.Lock()
_sync_state: dict[str, Any] = {
    "running": False,
    "started_at": None,
    "completed_at": None,
    "counts": None,
    "error": None,
    "task_id": None,
}


def _run_sync_all(full: bool) -> dict:
    from app.services.sync_service import SyncService

    session = SyncSession()
    try:
        service = SyncService()
        counts = service.sync_all(session, full=full)
        session.commit()
        return counts
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _background_sync(full: bool) -> None:
    global _sync_state
    try:
        counts = _run_sync_all(full)
        with _sync_lock:
            _sync_state["running"] = False
            _sync_state["completed_at"] = datetime.now(timezone.utc).isoformat()
            _sync_state["counts"] = counts
            _sync_state["error"] = None
        _broadcast_complete(counts)
    except Exception as exc:
        with _sync_lock:
            _sync_state["running"] = False
            _sync_state["completed_at"] = datetime.now(timezone.utc).isoformat()
            _sync_state["error"] = str(exc)


def _broadcast_complete(counts: dict) -> None:
    try:
        from app.api.websocket import manager

        total = sum(counts.values())
        asyncio.run(manager.broadcast("dashboard", {"type": "sync_complete", "counts": counts}))
        asyncio.run(manager.broadcast("alerts", {"type": "sync_complete", "count": total}))
        asyncio.run(manager.broadcast("events", {"type": "sync_complete", "count": counts.get("events", 0)}))
    except Exception:
        pass


def _start_background_sync(full: bool) -> None:
    global _sync_state
    with _sync_lock:
        if _sync_state["running"]:
            return
        _sync_state = {
            "running": True,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "counts": None,
            "error": None,
            "task_id": None,
        }
    thread = threading.Thread(target=_background_sync, args=(full,), daemon=True)
    thread.start()


def _dispatch_celery_sync(full: bool) -> Optional[str]:
    try:
        from app.tasks.celery_tasks import sync_all

        task = sync_all.delay(full=full)
        return task.id
    except Exception:
        return None


@router.post("")
async def trigger_sync(
    full: bool = Query(False, description="Fetch all activities from the last 30 days"),
    _: User = Depends(require_role("SOC_ANALYST")),
):
    with _sync_lock:
        if _sync_state["running"]:
            return {
                "status": "running",
                "message": "Sync already in progress",
                "started_at": _sync_state["started_at"],
            }

    task_id = await asyncio.to_thread(_dispatch_celery_sync, full)
    if task_id:
        with _sync_lock:
            _sync_state["running"] = True
            _sync_state["started_at"] = datetime.now(timezone.utc).isoformat()
            _sync_state["task_id"] = task_id
        return {"status": "started", "task_id": task_id, "mode": "celery"}

    await asyncio.to_thread(_start_background_sync, full)
    return {"status": "started", "mode": "background"}


@router.get("/status")
async def sync_status(_: User = Depends(get_current_user)):
    client = SentinelOneClient()
    configured = bool(settings.S1_BASE_URL and settings.S1_API_TOKEN)
    healthy = await client.health_check() if configured else False

    with _sync_lock:
        state = dict(_sync_state)

    if state.get("task_id") and state.get("running"):
        try:
            from app.tasks.celery_tasks import celery_app

            result = AsyncResult(state["task_id"], app=celery_app)
            if result.ready():
                with _sync_lock:
                    _sync_state["running"] = False
                    _sync_state["completed_at"] = datetime.now(timezone.utc).isoformat()
                    if result.successful():
                        payload = result.get() or {}
                        _sync_state["counts"] = payload.get("counts", payload)
                        _sync_state["error"] = None
                    else:
                        _sync_state["error"] = str(result.result)
                state = dict(_sync_state)
        except Exception:
            pass

    return {
        "configured": configured,
        "api_healthy": healthy,
        "base_url": settings.S1_BASE_URL or None,
        "running": state.get("running", False),
        "started_at": state.get("started_at"),
        "completed_at": state.get("completed_at"),
        "counts": state.get("counts"),
        "error": state.get("error"),
    }
