from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import EnrichmentRequest, EnrichmentResponse, UserResponse
from app.services.enrichment import EnrichmentService

router = APIRouter(tags=["Enrichment & Users"])
enrichment_service = EnrichmentService()


@router.post("/enrichment", response_model=EnrichmentResponse)
async def enrich_ioc(
    request: EnrichmentRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SOC_ANALYST")),
):
    results, cached = await enrichment_service.enrich(db, request.ioc_type, request.ioc_value)
    return EnrichmentResponse(
        ioc_type=request.ioc_type,
        ioc_value=request.ioc_value,
        providers=results,
        cached=cached,
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.is_active.is_(True)).order_by(User.name))
    return result.scalars().all()


@router.get("/threats")
async def list_threats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.models import Alert
    from sqlalchemy import func

    result = await db.execute(
        select(Alert)
        .where(Alert.sentinel_alert_id.like("threat-%"))
        .order_by(Alert.created_at.desc())
        .limit(100)
    )
    threats = result.scalars().all()
    severity_counts = await db.execute(
        select(Alert.severity, func.count(Alert.id))
        .where(Alert.sentinel_alert_id.like("threat-%"))
        .group_by(Alert.severity)
    )
    return {
        "threats": [
            {
                "id": str(t.id),
                "title": t.title,
                "severity": t.severity,
                "hostname": t.hostname,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
            }
            for t in threats
        ],
        "severity_distribution": {row[0]: row[1] for row in severity_counts.all()},
    }
