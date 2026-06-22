from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import PaginatedResponse, SecurityEventResponse
from app.services.event_service import EventService

router = APIRouter(prefix="/events", tags=["Events"])
event_service = EventService()


@router.get("/stats")
async def get_event_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await event_service.get_stats(db)


@router.get("", response_model=PaginatedResponse)
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category: Optional[str] = Query(None, pattern="^(activity|remote_desktop)$"),
    event_type: Optional[str] = Query(None, max_length=100),
    search: Optional[str] = Query(None, max_length=200),
    agent_id: Optional[str] = Query(None, max_length=255),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = await event_service.list_events(
        db, page, page_size, category, event_type, search, agent_id
    )
    return PaginatedResponse(
        items=[SecurityEventResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/{event_id}", response_model=SecurityEventResponse)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    event = await event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return SecurityEventResponse.model_validate(event)
