from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import clean_search
from app.core.security import get_current_user, require_role
from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import (
    AlertBulkAction,
    AlertResponse,
    AlertUpdate,
    PaginatedResponse,
)
from app.services.alert_service import AlertService
from app.api.websocket import manager

router = APIRouter(prefix="/alerts", tags=["Alerts"])
alert_service = AlertService()


@router.get("", response_model=PaginatedResponse)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, max_length=200),
    severity: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    analyst_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    alerts, total = await alert_service.list_alerts(
        db, page, page_size, clean_search(search), severity, status_filter, analyst_id
    )
    return PaginatedResponse(
        items=[AlertResponse.model_validate(a) for a in alerts],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    alert = await alert_service.get_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: UUID,
    update: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ANALYST")),
):
    alert = await alert_service.update_alert(db, alert_id, update, current_user.id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    await manager.broadcast("alerts", {"type": "alert_updated", "alert_id": str(alert_id)})
    await manager.broadcast("dashboard", {"type": "alert_updated"})
    return alert


@router.post("/bulk", response_model=dict)
async def bulk_action(
    action: AlertBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ANALYST")),
):
    updated = await alert_service.bulk_action(
        db,
        action.alert_ids,
        action.action,
        current_user.id,
        action.value,
        action.analyst_id,
    )
    await manager.broadcast("alerts", {"type": "bulk_update", "count": updated})
    await manager.broadcast("dashboard", {"type": "alerts_updated"})
    return {"updated": updated}


@router.post("/{alert_id}/incident", status_code=status.HTTP_201_CREATED)
async def create_incident_from_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ANALYST")),
):
    incident = await alert_service.create_incident_from_alert(db, alert_id, current_user.id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    await manager.broadcast("incidents", {"type": "incident_created"})
    return {"incident_id": str(incident.id), "incident_number": incident.incident_number}
