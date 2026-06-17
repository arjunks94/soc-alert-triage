import time

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.core.metrics import SYNC_DURATION, SYNC_ERRORS
from app.database.session import Base
from app.services.sync_service import SyncService

setup_logging()
settings = get_settings()
logger = get_logger(__name__)

celery_app = Celery(
    "soc_dashboard",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "sync-alerts": {
            "task": "app.tasks.celery_tasks.sync_alerts",
            "schedule": settings.SYNC_ALERTS_INTERVAL_SECONDS,
        },
        "sync-agents": {
            "task": "app.tasks.celery_tasks.sync_agents",
            "schedule": settings.SYNC_AGENTS_INTERVAL_SECONDS,
        },
        "sync-incidents": {
            "task": "app.tasks.celery_tasks.sync_incidents",
            "schedule": settings.SYNC_INCIDENTS_INTERVAL_SECONDS,
        },
        "sync-threats": {
            "task": "app.tasks.celery_tasks.sync_threats",
            "schedule": 300.0,
        },
    },
)

sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)


def _broadcast_sync(task_name: str, count: int) -> None:
    try:
        import asyncio
        from app.api.websocket import manager

        channel_map = {
            "sync_alerts": "alerts",
            "sync_threats": "alerts",
            "sync_incidents": "incidents",
            "sync_agents": "dashboard",
        }
        channel = channel_map.get(task_name, "dashboard")
        asyncio.run(manager.broadcast(channel, {"type": "sync_complete", "task": task_name, "count": count}))
        if channel != "dashboard":
            asyncio.run(manager.broadcast("dashboard", {"type": "sync_complete", "task": task_name}))
    except Exception as exc:
        logger.warning("ws_broadcast_failed", error=str(exc))


def _run_sync(task_name: str, sync_method: str) -> dict:
    start = time.monotonic()
    session = SyncSession()
    try:
        service = SyncService()
        method = getattr(service, sync_method)
        count = method(session)
        session.commit()
        duration = time.monotonic() - start
        SYNC_DURATION.labels(task_name=task_name).observe(duration)
        logger.info("sync_task_complete", task=task_name, count=count, duration=duration)
        _broadcast_sync(task_name, count)
        return {"status": "success", "count": count, "duration": duration}
    except Exception as exc:
        session.rollback()
        SYNC_ERRORS.labels(task_name=task_name).inc()
        logger.error("sync_task_failed", task=task_name, error=str(exc))
        raise
    finally:
        session.close()


@celery_app.task(name="app.tasks.celery_tasks.sync_alerts", bind=True, max_retries=3)
def sync_alerts(self):
    try:
        return _run_sync("sync_alerts", "sync_alerts")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.tasks.celery_tasks.sync_agents", bind=True, max_retries=3)
def sync_agents(self):
    try:
        return _run_sync("sync_agents", "sync_agents")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.celery_tasks.sync_threats", bind=True, max_retries=3)
def sync_threats(self):
    try:
        return _run_sync("sync_threats", "sync_threats")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.celery_tasks.sync_incidents", bind=True, max_retries=3)
def sync_incidents(self):
    try:
        return _run_sync("sync_incidents", "sync_incidents")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
