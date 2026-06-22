from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import (
    ALERT_COUNT,
    INCIDENT_COUNT,
    OFFLINE_AGENTS,
    ONLINE_AGENTS,
)
from app.models.models import Alert, Endpoint, Incident, User
from app.utils.helpers import classification_to_tier, extract_mitre_from_raw, infer_mitre_from_classification
from app.schemas.schemas import (
    DashboardSummary,
    HeatmapCell,
    ThreatFeedItem,
    TimelinePoint,
    TopAsset,
)


class DashboardService:
    async def get_summary(self, db: AsyncSession) -> DashboardSummary:
        severity_counts = await db.execute(
            select(Alert.severity, func.count(Alert.id))
            .where(Alert.status.notin_(["CLOSED", "FALSE_POSITIVE"]))
            .group_by(Alert.severity)
        )
        counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for severity, count in severity_counts.all():
            tier = classification_to_tier(severity or "UNKNOWN")
            counts[tier] = counts.get(tier, 0) + count

        open_incidents = await db.scalar(
            select(func.count(Incident.id)).where(Incident.status.notin_(["CLOSED", "RESOLVED"]))
        )
        online = await db.scalar(select(func.count(Endpoint.id)).where(Endpoint.is_online.is_(True)))
        offline = await db.scalar(select(func.count(Endpoint.id)).where(Endpoint.is_online.is_(False)))
        total_alerts = await db.scalar(select(func.count(Alert.id)))
        new_alerts = await db.scalar(select(func.count(Alert.id)).where(Alert.status == "NEW"))

        summary = DashboardSummary(
            critical=counts["CRITICAL"],
            high=counts["HIGH"],
            medium=counts["MEDIUM"],
            low=counts["LOW"],
            open_incidents=open_incidents or 0,
            online_agents=online or 0,
            offline_agents=offline or 0,
            total_alerts=total_alerts or 0,
            new_alerts=new_alerts or 0,
        )

        for severity in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
            for status in ("NEW", "OPEN", "INVESTIGATING", "ESCALATED"):
                result = await db.execute(
                    select(Alert.severity, func.count(Alert.id)).where(
                        Alert.status == status
                    ).group_by(Alert.severity)
                )
                count = sum(
                    row[1]
                    for row in result.all()
                    if classification_to_tier(row[0] or "UNKNOWN") == severity
                )
                ALERT_COUNT.labels(severity=severity, status=status).set(count)

        for status in ("OPEN", "INVESTIGATING", "ESCALATED", "CONTAINED", "CLOSED"):
            count = await db.scalar(select(func.count(Incident.id)).where(Incident.status == status))
            INCIDENT_COUNT.labels(status=status).set(count or 0)

        ONLINE_AGENTS.set(online or 0)
        OFFLINE_AGENTS.set(offline or 0)

        return summary

    async def get_threats(self, db: AsyncSession, limit: int = 20) -> list[ThreatFeedItem]:
        result = await db.execute(
            select(Alert)
            .where(Alert.status.notin_(["CLOSED", "FALSE_POSITIVE"]))
            .order_by(Alert.created_at.desc())
            .limit(limit * 3)
        )
        alerts = [
            a for a in result.scalars().all()
            if classification_to_tier(a.severity) in ("CRITICAL", "HIGH")
        ][:limit]
        return [
            ThreatFeedItem(
                id=a.id,
                title=a.title,
                severity=a.severity,
                hostname=a.hostname,
                created_at=a.created_at,
            )
            for a in alerts
        ]

    async def get_heatmap(self, db: AsyncSession) -> list[HeatmapCell]:
        result = await db.execute(
            select(Alert.mitre_tactics, Alert.mitre_techniques, Alert.severity, Alert.raw_data)
            .where(Alert.status.notin_(["CLOSED", "FALSE_POSITIVE"]))
        )
        cell_counts: dict[tuple[str, str], int] = {}
        for tactics, techniques, severity, raw_data in result.all():
            tactics_list = list(tactics or [])
            techniques_list = list(techniques or [])

            if (not tactics_list or not techniques_list) and isinstance(raw_data, dict):
                extracted_t, extracted_k = extract_mitre_from_raw(raw_data)
                if extracted_t:
                    tactics_list = extracted_t
                if extracted_k:
                    techniques_list = extracted_k

            if not tactics_list or not techniques_list:
                ft, fk = infer_mitre_from_classification(severity or "UNKNOWN")
                tactics_list = tactics_list or ft
                techniques_list = techniques_list or fk

            for tactic in tactics_list:
                for technique in techniques_list:
                    key = (tactic, technique)
                    cell_counts[key] = cell_counts.get(key, 0) + 1

        return [
            HeatmapCell(tactic=tactic, technique=technique, count=count)
            for (tactic, technique), count in sorted(cell_counts.items(), key=lambda x: -x[1])
        ]

    async def get_timeline(self, db: AsyncSession, hours: int = 24) -> list[TimelinePoint]:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await db.execute(
            select(
                func.date_trunc("hour", Alert.created_at).label("hour"),
                Alert.severity,
                func.count(Alert.id),
            )
            .where(Alert.created_at >= since)
            .group_by("hour", Alert.severity)
            .order_by("hour")
        )

        hour_data: dict[str, dict[str, int]] = {}
        for hour, severity, count in result.all():
            hour_str = hour.strftime("%Y-%m-%d %H:00") if hour else "unknown"
            if hour_str not in hour_data:
                hour_data[hour_str] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            key = classification_to_tier(severity or "UNKNOWN").lower()
            if key in hour_data[hour_str]:
                hour_data[hour_str][key] += count

        return [TimelinePoint(hour=h, **counts) for h, counts in sorted(hour_data.items())]

    async def get_endpoints(self, db: AsyncSession) -> dict[str, Any]:
        total = await db.scalar(select(func.count(Endpoint.id)))
        online = await db.scalar(select(func.count(Endpoint.id)).where(Endpoint.is_online.is_(True)))
        by_os = await db.execute(
            select(Endpoint.os_name, func.count(Endpoint.id)).group_by(Endpoint.os_name)
        )
        by_health = await db.execute(
            select(Endpoint.health_status, func.count(Endpoint.id)).group_by(Endpoint.health_status)
        )
        return {
            "total": total or 0,
            "online": online or 0,
            "offline": (total or 0) - (online or 0),
            "by_os": {row[0] or "Unknown": row[1] for row in by_os.all()},
            "by_health": {row[0] or "Unknown": row[1] for row in by_health.all()},
        }

    async def get_top_assets(self, db: AsyncSession, limit: int = 10) -> list[TopAsset]:
        severity_order = case(
            (Alert.severity == "CRITICAL", 4),
            (Alert.severity == "HIGH", 3),
            (Alert.severity == "MEDIUM", 2),
            else_=1,
        )
        result = await db.execute(
            select(
                Alert.hostname,
                func.count(Alert.id).label("alert_count"),
                func.max(severity_order).label("max_sev"),
            )
            .where(Alert.hostname.isnot(None), Alert.status.notin_(["CLOSED", "FALSE_POSITIVE"]))
            .group_by(Alert.hostname)
            .order_by(func.count(Alert.id).desc())
            .limit(limit)
        )
        sev_map = {4: "CRITICAL", 3: "HIGH", 2: "MEDIUM", 1: "LOW"}
        return [
            TopAsset(
                hostname=row[0],
                alert_count=row[1],
                severity_max=sev_map.get(row[2], "LOW"),
            )
            for row in result.all()
        ]

    async def get_analyst_workload(self, db: AsyncSession) -> list[dict[str, Any]]:
        result = await db.execute(
            select(
                User.id,
                User.name,
                func.count(Alert.id).label("alert_count"),
            )
            .outerjoin(Alert, Alert.assigned_analyst_id == User.id)
            .where(User.role.in_(["SOC_ANALYST", "SOC_MANAGER"]))
            .group_by(User.id, User.name)
        )
        return [
            {"analyst_id": str(row[0]), "name": row[1], "alert_count": row[2]}
            for row in result.all()
        ]

    async def get_incident_distribution(self, db: AsyncSession) -> dict[str, int]:
        result = await db.execute(select(Incident.status, func.count(Incident.id)).group_by(Incident.status))
        return {row[0]: row[1] for row in result.all()}
