from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import clean_filter
from app.core.security import get_current_user, require_role
from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import (
    EvidenceAttachment,
    IncidentCreate,
    IncidentResponse,
    IncidentUpdate,
    PaginatedResponse,
)
from app.services.incident_service import IncidentService
from app.api.websocket import manager

router = APIRouter(prefix="/incidents", tags=["Incidents"])
incident_service = IncidentService()


@router.get("", response_model=PaginatedResponse)
async def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incidents, total = await incident_service.list_incidents(
        db, page, page_size, clean_filter(status_filter), clean_filter(severity)
    )
    return PaginatedResponse(
        items=[IncidentResponse.model_validate(i) for i in incidents],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incident = await incident_service.get_incident(db, incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    data: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ANALYST")),
):
    incident = await incident_service.create_incident(db, data, current_user.id)
    await manager.broadcast("incidents", {"type": "incident_created", "id": str(incident.id)})
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: UUID,
    update: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ANALYST")),
):
    incident = await incident_service.update_incident(db, incident_id, update, current_user.id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    await manager.broadcast("incidents", {"type": "incident_updated", "id": str(incident_id)})
    return incident


@router.post("/{incident_id}/evidence", response_model=IncidentResponse)
async def add_evidence(
    incident_id: UUID,
    evidence: EvidenceAttachment,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ANALYST")),
):
    incident = await incident_service.add_evidence(
        db, incident_id, evidence.model_dump(), current_user.id
    )
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident
