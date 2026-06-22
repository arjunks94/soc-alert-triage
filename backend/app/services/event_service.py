from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import SecurityEvent
from app.utils.sanitize import sanitize_search


class EventService:
    async def list_events(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        category: Optional[str] = None,
        event_type: Optional[str] = None,
        search: Optional[str] = None,
        agent_id: Optional[str] = None,
    ) -> tuple[list[SecurityEvent], int]:
        query = select(SecurityEvent)
        count_query = select(func.count(SecurityEvent.id))

        if category:
            query = query.where(SecurityEvent.category == category)
            count_query = count_query.where(SecurityEvent.category == category)
        if event_type:
            event_type = sanitize_search(event_type, 100)
            query = query.where(SecurityEvent.event_type.ilike(f"%{event_type}%"))
            count_query = count_query.where(SecurityEvent.event_type.ilike(f"%{event_type}%"))
        if agent_id:
            agent_id = sanitize_search(agent_id, 255)
            query = query.where(SecurityEvent.agent_id == agent_id)
            count_query = count_query.where(SecurityEvent.agent_id == agent_id)
        if search:
            search = sanitize_search(search, 200)
            pattern = f"%{search}%"
            search_filter = or_(
                SecurityEvent.title.ilike(pattern),
                SecurityEvent.description.ilike(pattern),
                SecurityEvent.hostname.ilike(pattern),
                SecurityEvent.user_name.ilike(pattern),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        total = await db.scalar(count_query) or 0
        result = await db.execute(
            query.order_by(SecurityEvent.event_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_event(self, db: AsyncSession, event_id: UUID) -> Optional[SecurityEvent]:
        result = await db.execute(select(SecurityEvent).where(SecurityEvent.id == event_id))
        return result.scalar_one_or_none()

    async def get_stats(self, db: AsyncSession) -> dict[str, Any]:
        total = await db.scalar(select(func.count(SecurityEvent.id))) or 0
        remote_desktop = await db.scalar(
            select(func.count(SecurityEvent.id)).where(SecurityEvent.category == "remote_desktop")
        ) or 0
        by_category = await db.execute(
            select(SecurityEvent.category, func.count(SecurityEvent.id)).group_by(SecurityEvent.category)
        )
        return {
            "total": total,
            "remote_desktop": remote_desktop,
            "by_category": {row[0]: row[1] for row in by_category.all()},
        }
