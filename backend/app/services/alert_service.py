from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Alert, Incident
from app.schemas.schemas import AlertUpdate
from app.utils.helpers import create_audit_log, generate_incident_number, normalize_severity


class AlertService:
    VALID_STATUSES = {
        "NEW", "OPEN", "INVESTIGATING", "ESCALATED", "CONTAINED", "FALSE_POSITIVE", "CLOSED"
    }

    async def list_alerts(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        analyst_id: Optional[UUID] = None,
    ) -> tuple[list[Alert], int]:
        query = select(Alert)
        count_query = select(func.count(Alert.id))

        filters = []
        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(
                    Alert.title.ilike(pattern),
                    Alert.hostname.ilike(pattern),
                    Alert.description.ilike(pattern),
                )
            )
        if severity:
            filters.append(Alert.severity == severity.upper())
        if status:
            filters.append(Alert.status == status.upper())
        if analyst_id:
            filters.append(Alert.assigned_analyst_id == analyst_id)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        total = await db.scalar(count_query) or 0
        result = await db.execute(
            query.order_by(Alert.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_alert(self, db: AsyncSession, alert_id: UUID) -> Optional[Alert]:
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        return result.scalar_one_or_none()

    async def update_alert(
        self,
        db: AsyncSession,
        alert_id: UUID,
        update: AlertUpdate,
        user_id: UUID,
    ) -> Optional[Alert]:
        alert = await self.get_alert(db, alert_id)
        if not alert:
            return None

        changes: dict[str, Any] = {}
        if update.status and update.status.upper() in self.VALID_STATUSES:
            changes["status"] = update.status.upper()
            alert.status = update.status.upper()
        if update.assigned_analyst_id is not None:
            changes["assigned_analyst_id"] = str(update.assigned_analyst_id)
            alert.assigned_analyst_id = update.assigned_analyst_id
        if update.notes is not None:
            changes["notes"] = update.notes
            alert.notes = update.notes
        if update.severity:
            changes["severity"] = normalize_severity(update.severity)
            alert.severity = normalize_severity(update.severity)

        alert.updated_at = datetime.now(timezone.utc)
        await create_audit_log(
            db, "UPDATE_ALERT", f"alert:{alert_id}", user_id=user_id, details=changes
        )
        return alert

    async def bulk_action(
        self,
        db: AsyncSession,
        alert_ids: list[UUID],
        action: str,
        user_id: UUID,
        value: Optional[str] = None,
        analyst_id: Optional[UUID] = None,
    ) -> int:
        updated = 0
        for alert_id in alert_ids:
            alert = await self.get_alert(db, alert_id)
            if not alert:
                continue

            if action == "change_status" and value and value.upper() in self.VALID_STATUSES:
                alert.status = value.upper()
                updated += 1
            elif action == "assign" and analyst_id:
                alert.assigned_analyst_id = analyst_id
                updated += 1
            elif action == "escalate":
                alert.status = "ESCALATED"
                updated += 1

            alert.updated_at = datetime.now(timezone.utc)

        await create_audit_log(
            db,
            f"BULK_{action.upper()}",
            f"alerts:{len(alert_ids)}",
            user_id=user_id,
            details={"alert_ids": [str(a) for a in alert_ids], "action": action},
        )
        return updated

    async def create_incident_from_alert(
        self,
        db: AsyncSession,
        alert_id: UUID,
        user_id: UUID,
        title: Optional[str] = None,
    ) -> Optional[Incident]:
        alert = await self.get_alert(db, alert_id)
        if not alert:
            return None

        incident = Incident(
            incident_number=generate_incident_number(),
            title=title or f"Incident: {alert.title}",
            description=alert.description,
            severity=alert.severity,
            status="OPEN",
            assigned_analyst=alert.assigned_analyst_id,
            alert_ids=[str(alert_id)],
            timeline=[
                {
                    "action": "CREATED",
                    "user_id": str(user_id),
                    "details": f"Created from alert {alert.sentinel_alert_id}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ],
        )
        db.add(incident)
        alert.status = "ESCALATED"
        alert.updated_at = datetime.now(timezone.utc)

        await create_audit_log(
            db,
            "CREATE_INCIDENT",
            f"incident:{incident.incident_number}",
            user_id=user_id,
            details={"alert_id": str(alert_id)},
        )
        return incident
