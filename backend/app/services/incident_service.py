from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Incident
from app.schemas.schemas import IncidentCreate, IncidentUpdate
from app.utils.helpers import create_audit_log, generate_incident_number


class IncidentService:
    async def list_incidents(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        status: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> tuple[list[Incident], int]:
        query = select(Incident)
        count_query = select(func.count(Incident.id))

        if status:
            query = query.where(Incident.status == status.upper())
            count_query = count_query.where(Incident.status == status.upper())
        if severity:
            query = query.where(Incident.severity == severity.upper())
            count_query = count_query.where(Incident.severity == severity.upper())

        total = await db.scalar(count_query) or 0
        result = await db.execute(
            query.order_by(Incident.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_incident(self, db: AsyncSession, incident_id: UUID) -> Optional[Incident]:
        result = await db.execute(select(Incident).where(Incident.id == incident_id))
        return result.scalar_one_or_none()

    async def create_incident(
        self, db: AsyncSession, data: IncidentCreate, user_id: UUID
    ) -> Incident:
        incident = Incident(
            incident_number=generate_incident_number(),
            title=data.title,
            description=data.description,
            severity=data.severity,
            status=data.status,
            assigned_analyst=data.assigned_analyst,
            alert_ids=[str(aid) for aid in data.alert_ids],
            timeline=[
                {
                    "action": "CREATED",
                    "user_id": str(user_id),
                    "details": "Incident created",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ],
        )
        db.add(incident)
        await create_audit_log(
            db,
            "CREATE_INCIDENT",
            f"incident:{incident.incident_number}",
            user_id=user_id,
        )
        return incident

    async def update_incident(
        self,
        db: AsyncSession,
        incident_id: UUID,
        update: IncidentUpdate,
        user_id: UUID,
    ) -> Optional[Incident]:
        incident = await self.get_incident(db, incident_id)
        if not incident:
            return None

        changes: dict[str, Any] = {}
        for field in ("title", "description", "severity", "status", "assigned_analyst", "notes"):
            value = getattr(update, field, None)
            if value is not None:
                if field in ("severity", "status") and isinstance(value, str):
                    value = value.upper()
                changes[field] = str(value) if isinstance(value, UUID) else value
                setattr(incident, field, value)

        timeline = list(incident.timeline or [])
        timeline.append(
            {
                "action": "UPDATED",
                "user_id": str(user_id),
                "details": str(changes),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        incident.timeline = timeline
        incident.updated_at = datetime.now(timezone.utc)

        await create_audit_log(
            db,
            "UPDATE_INCIDENT",
            f"incident:{incident.incident_number}",
            user_id=user_id,
            details=changes,
        )
        return incident

    async def add_evidence(
        self,
        db: AsyncSession,
        incident_id: UUID,
        evidence: dict[str, Any],
        user_id: UUID,
    ) -> Optional[Incident]:
        incident = await self.get_incident(db, incident_id)
        if not incident:
            return None

        evidence_list = list(incident.evidence or [])
        evidence["uploaded_at"] = datetime.now(timezone.utc).isoformat()
        evidence["uploaded_by"] = str(user_id)
        evidence_list.append(evidence)
        incident.evidence = evidence_list

        timeline = list(incident.timeline or [])
        timeline.append(
            {
                "action": "EVIDENCE_ADDED",
                "user_id": str(user_id),
                "details": evidence.get("filename", "attachment"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        incident.timeline = timeline
        incident.updated_at = datetime.now(timezone.utc)

        await create_audit_log(
            db,
            "ADD_EVIDENCE",
            f"incident:{incident.incident_number}",
            user_id=user_id,
        )
        return incident
