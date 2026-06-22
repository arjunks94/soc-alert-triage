from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from sqlalchemy import text

from app.api import alerts, auth, dashboard, events, incidents, misc, settings as settings_api, sync, threats, users, websocket
from app.api.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.database.session import engine

app_config = get_settings()
setup_logging()

health_router = APIRouter(tags=["Health"])


@health_router.get("/health")
async def health():
    return {"status": "healthy", "version": app_config.APP_VERSION}


@health_router.get("/ready")
async def ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as exc:
        return {"status": "not_ready", "error": str(exc)}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=app_config.APP_NAME,
        version=app_config.APP_VERSION,
        description="Enterprise SOC Alert Triage Dashboard with SentinelOne Integration",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_config.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=app_config.RATE_LIMIT_PER_MINUTE)

    app.include_router(health_router)
    app.include_router(auth.router, prefix="/api")
    app.include_router(alerts.router, prefix="/api")
    app.include_router(incidents.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(dashboard.endpoints_router, prefix="/api")
    app.include_router(misc.router, prefix="/api")
    app.include_router(sync.router, prefix="/api")
    app.include_router(events.router, prefix="/api")
    app.include_router(threats.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    app.include_router(users.router, prefix="/api")
    from app.api import rbac
    app.include_router(rbac.router, prefix="/api")
    app.include_router(websocket.router)

    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    return app


app = create_app()
