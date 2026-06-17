from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.models import Endpoint, User
from app.schemas.schemas import DashboardSummary, EndpointResponse, PaginatedResponse
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
dashboard_service = DashboardService()


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_summary(db)


@router.get("/threats")
async def get_threats(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_threats(db, limit)


@router.get("/heatmap")
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_heatmap(db)


@router.get("/timeline")
async def get_timeline(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_timeline(db, hours)


@router.get("/endpoints")
async def get_endpoints(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_endpoints(db)


@router.get("/top-assets")
async def get_top_assets(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_top_assets(db, limit)


@router.get("/analyst-workload")
async def get_analyst_workload(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_analyst_workload(db)


@router.get("/incident-distribution")
async def get_incident_distribution(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await dashboard_service.get_incident_distribution(db)


endpoints_router = APIRouter(prefix="/endpoints", tags=["Endpoints"])


@endpoints_router.get("", response_model=PaginatedResponse)
async def list_endpoints(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    online_only: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import func

    query = select(Endpoint)
    count_query = select(func.count(Endpoint.id))
    if online_only is not None:
        query = query.where(Endpoint.is_online == online_only)
        count_query = count_query.where(Endpoint.is_online == online_only)

    total = await db.scalar(count_query) or 0
    result = await db.execute(
        query.order_by(Endpoint.hostname).offset((page - 1) * page_size).limit(page_size)
    )
    items = [EndpointResponse.model_validate(e) for e in result.scalars().all()]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )
