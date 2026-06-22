from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.models import Alert, Endpoint, Incident, SecurityEvent
from app.services.sentinelone_client import SentinelOneClient
from app.utils.helpers import normalize_classification

logger = get_logger(__name__)

REMOTE_DESKTOP_KEYWORDS = (
    "remote shell",
    "remote desktop",
    "remote ops",
    "remote script",
    "remote profiling",
    "rdp",
    "mstsc",
    "terminal services",
    "remote session",
)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _extract_event_time(raw: dict[str, Any]) -> Optional[datetime]:
    for key in ("createdAt", "alertCreatedAt", "detectedAt", "updatedAt", "createdDate"):
        dt = _parse_datetime(raw.get(key))
        if dt:
            return dt
    threat_info = raw.get("threatInfo", {})
    if isinstance(threat_info, dict):
        dt = _parse_datetime(threat_info.get("createdAt"))
        if dt:
            return dt
    alert_info = raw.get("alertInfo", {})
    if isinstance(alert_info, dict):
        dt = _parse_datetime(alert_info.get("createdAt"))
        if dt:
            return dt
    return None


def _extract_mitre(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    tactics: list[str] = []
    techniques: list[str] = []
    for key in ("mitreTactics", "mitre_tactics", "tactics"):
        if key in data and isinstance(data[key], list):
            tactics.extend(str(t) for t in data[key])
    for key in ("mitreTechniques", "mitre_techniques", "techniques"):
        if key in data and isinstance(data[key], list):
            techniques.extend(str(t) for t in data[key])
    indicators = data.get("indicators", data.get("threatInfo", {}))
    if isinstance(indicators, dict):
        for tactic in indicators.get("mitreTactics", []):
            tactics.append(tactic.get("name", str(tactic)) if isinstance(tactic, dict) else str(tactic))
        for technique in indicators.get("mitreTechniques", []):
            techniques.append(technique.get("name", str(technique)) if isinstance(technique, dict) else str(technique))
    return list(set(tactics)), list(set(techniques))


def _coerce_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, dict):
        return str(value.get("name") or value.get("value") or value.get("id") or "")
    return str(value)


def _extract_classification(raw: dict[str, Any]) -> str:
    threat_info = raw.get("threatInfo", {})
    alert_info = raw.get("alertInfo", {})
    for source in (
        threat_info.get("classification"),
        raw.get("classification"),
        raw.get("severity"),
        alert_info.get("classification"),
        alert_info.get("severity"),
        alert_info.get("category"),
    ):
        if source:
            return normalize_classification(str(source))
    return "UNKNOWN"


def _categorize_activity(raw: dict[str, Any], type_name: str = "") -> str:
    nested = raw.get("data", {}) if isinstance(raw.get("data"), dict) else {}
    text = " ".join(
        filter(
            None,
            [
                str(raw.get("description", "")),
                type_name,
                str(nested.get("fullScopeDetails", "")),
                str(nested.get("computerName", "")),
            ],
        )
    ).lower()
    if any(keyword in text for keyword in REMOTE_DESKTOP_KEYWORDS):
        return "remote_desktop"
    return "activity"


def _incremental_since(db: Session, column, full: bool, default_days: int = 30) -> dict[str, str]:
    if full:
        since = datetime.now(timezone.utc) - timedelta(days=default_days)
        return {"createdAt__gte": since.isoformat()}
    last = db.execute(select(func.max(column))).scalar()
    if last:
        since = last - timedelta(days=1)
    else:
        since = datetime.now(timezone.utc) - timedelta(days=default_days)
    return {"createdAt__gte": since.isoformat()}


class SyncService:
    def __init__(self) -> None:
        self.client = SentinelOneClient()

    def sync_all(self, db: Session, full: bool = False) -> dict[str, int]:
        max_pages = None if full else 50
        return {
            "alerts": self.sync_alerts(db, full=full, max_pages=max_pages),
            "threats": self.sync_threats(db, full=full, max_pages=max_pages),
            "agents": self.sync_agents(db, max_pages=max_pages),
            "incidents": self.sync_incidents(db),
            "events": self.sync_activities(db, full=full),
        }

    def sync_alerts(self, db: Session, full: bool = False, max_pages: Optional[int] = 50) -> int:
        synced = 0
        try:
            import asyncio
            filters = _incremental_since(db, Alert.created_at, full)
            raw_alerts = asyncio.run(self.client.get_alerts(max_pages=max_pages, **filters))
        except Exception as exc:
            logger.error("sync_alerts_failed", error=str(exc))
            raise

        for raw in raw_alerts:
            alert_id = str(raw.get("id", raw.get("alertId", "")))
            if not alert_id:
                continue

            alert = db.execute(
                select(Alert).where(Alert.sentinel_alert_id == alert_id)
            ).scalar_one_or_none()

            severity = _extract_classification(raw)
            tactics, techniques = _extract_mitre(raw)
            agent_info = raw.get("agentRealtimeInfo", raw.get("agentDetectionInfo", {}))
            event_time = _extract_event_time(raw)

            if alert:
                alert.title = raw.get("name", raw.get("title", alert.title))
                alert.description = raw.get("description", alert.description)
                alert.severity = severity
                alert.hostname = agent_info.get("agentComputerName", alert.hostname)
                alert.agent_id = str(agent_info.get("agentId", alert.agent_id or ""))
                alert.mitre_tactics = tactics or alert.mitre_tactics
                alert.mitre_techniques = techniques or alert.mitre_techniques
                alert.raw_data = raw
                if event_time:
                    alert.created_at = event_time
                alert.updated_at = datetime.now(timezone.utc)
            else:
                alert = Alert(
                    sentinel_alert_id=alert_id,
                    title=raw.get("name", raw.get("title", "Unknown Alert")),
                    description=raw.get("description"),
                    severity=severity,
                    status="NEW",
                    hostname=agent_info.get("agentComputerName"),
                    site_name=raw.get("siteName"),
                    agent_id=str(agent_info.get("agentId", "")),
                    mitre_tactics=tactics,
                    mitre_techniques=techniques,
                    raw_data=raw,
                    created_at=event_time or datetime.now(timezone.utc),
                )
                db.add(alert)
            synced += 1

        db.flush()
        logger.info("sync_alerts_complete", count=synced)
        return synced

    def sync_agents(self, db: Session, max_pages: Optional[int] = 50) -> int:
        synced = 0
        try:
            import asyncio
            raw_agents = asyncio.run(self.client.get_agents(max_pages=max_pages))
        except Exception as exc:
            logger.error("sync_agents_failed", error=str(exc))
            raise

        for raw in raw_agents:
            agent_id = str(raw.get("id", ""))
            if not agent_id:
                continue

            endpoint = db.execute(
                select(Endpoint).where(Endpoint.agent_id == agent_id)
            ).scalar_one_or_none()

            is_active = raw.get("isActive", False)
            is_decommissioned = raw.get("isDecommissioned", False)
            is_online = is_active and not is_decommissioned

            if endpoint:
                endpoint.hostname = raw.get("computerName", endpoint.hostname)
                endpoint.ip_address = raw.get("lastIpToMgmt") or raw.get("externalIp") or endpoint.ip_address
                endpoint.os_name = raw.get("osName", endpoint.os_name)
                endpoint.os_version = raw.get("osRevision", endpoint.os_version)
                endpoint.last_seen = _parse_datetime(raw.get("lastActiveDate")) or endpoint.last_seen
                endpoint.health_status = "healthy" if is_online else "offline"
                endpoint.is_online = is_online
                endpoint.group_name = raw.get("groupName", endpoint.group_name)
                endpoint.site_name = raw.get("siteName", endpoint.site_name)
                endpoint.raw_data = raw
                endpoint.updated_at = datetime.now(timezone.utc)
            else:
                endpoint = Endpoint(
                    agent_id=agent_id,
                    hostname=raw.get("computerName"),
                    ip_address=raw.get("lastIpToMgmt") or raw.get("externalIp"),
                    os_name=raw.get("osName"),
                    os_version=raw.get("osRevision"),
                    last_seen=_parse_datetime(raw.get("lastActiveDate")),
                    health_status="healthy" if is_online else "offline",
                    is_online=is_online,
                    group_name=raw.get("groupName"),
                    site_name=raw.get("siteName"),
                    raw_data=raw,
                )
                db.add(endpoint)
            synced += 1

        db.flush()
        logger.info("sync_agents_complete", count=synced)
        return synced

    def sync_threats(self, db: Session, full: bool = False, max_pages: Optional[int] = 50) -> int:
        synced = 0
        try:
            import asyncio
            filters = _incremental_since(db, Alert.created_at, full)
            raw_threats = asyncio.run(self.client.get_threats(max_pages=max_pages, **filters))
        except Exception as exc:
            logger.error("sync_threats_failed", error=str(exc))
            raise

        for raw in raw_threats:
            threat_id = str(raw.get("id", ""))
            if not threat_id:
                continue

            alert = db.execute(
                select(Alert).where(Alert.sentinel_alert_id == f"threat-{threat_id}")
            ).scalar_one_or_none()

            threat_info = raw.get("threatInfo", {})
            agent_info = raw.get("agentRealtimeInfo", {})
            severity = _extract_classification(raw)
            tactics, techniques = _extract_mitre(raw)
            event_time = _extract_event_time(raw)

            if alert:
                alert.title = threat_info.get("threatName", alert.title)
                alert.severity = severity
                alert.hostname = agent_info.get("agentComputerName", alert.hostname)
                alert.mitre_tactics = tactics or alert.mitre_tactics
                alert.mitre_techniques = techniques or alert.mitre_techniques
                alert.raw_data = raw
                if event_time:
                    alert.created_at = event_time
                alert.updated_at = datetime.now(timezone.utc)
            else:
                alert = Alert(
                    sentinel_alert_id=f"threat-{threat_id}",
                    title=threat_info.get("threatName", "Unknown Threat"),
                    description=threat_info.get("filePath"),
                    severity=severity,
                    status="NEW",
                    hostname=agent_info.get("agentComputerName"),
                    agent_id=str(agent_info.get("agentId", "")),
                    mitre_tactics=tactics,
                    mitre_techniques=techniques,
                    raw_data=raw,
                    created_at=event_time or datetime.now(timezone.utc),
                )
                db.add(alert)
            synced += 1

        db.flush()
        logger.info("sync_threats_complete", count=synced)
        return synced

    def sync_incidents(self, db: Session) -> int:
        synced = 0
        try:
            import asyncio
            raw_incidents = asyncio.run(self.client.get_incidents())
        except Exception as exc:
            logger.error("sync_incidents_failed", error=str(exc))
            raise

        for raw in raw_incidents:
            s1_id = str(raw.get("id", ""))
            if not s1_id:
                continue

            incident_number = f"S1-{s1_id}"
            incident = db.execute(
                select(Incident).where(Incident.incident_number == incident_number)
            ).scalar_one_or_none()

            event_time = _extract_event_time(raw)

            if incident:
                incident.title = raw.get("name", raw.get("title", incident.title))
                incident.description = raw.get("description", incident.description)
                incident.severity = normalize_classification(str(raw.get("severity", incident.severity)))
                incident.status = raw.get("status", incident.status).upper()
                if event_time:
                    incident.created_at = event_time
                incident.updated_at = datetime.now(timezone.utc)
            else:
                incident = Incident(
                    incident_number=incident_number,
                    title=raw.get("name", raw.get("title", "S1 Incident")),
                    description=raw.get("description"),
                    severity=normalize_classification(str(raw.get("severity", "MEDIUM"))),
                    status=raw.get("status", "OPEN").upper(),
                    created_at=event_time or datetime.now(timezone.utc),
                    timeline=[{
                        "action": "SYNCED_FROM_S1",
                        "details": f"Synced from SentinelOne incident {s1_id}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }],
                )
                db.add(incident)
            synced += 1

        db.flush()
        logger.info("sync_incidents_complete", count=synced)
        return synced

    def sync_activities(self, db: Session, full: bool = False) -> int:
        synced = 0
        try:
            import asyncio
            activity_types = asyncio.run(self.client.get_activity_types())
            filters: dict[str, Any] = {}
            if not full:
                last_event = db.execute(select(func.max(SecurityEvent.event_at))).scalar()
                if last_event:
                    filters["createdAt__gte"] = last_event.isoformat()
                else:
                    since = datetime.now(timezone.utc) - timedelta(days=30)
                    filters["createdAt__gte"] = since.isoformat()
            max_pages = None if full else 20
            raw_activities = asyncio.run(self.client.get_activities(max_pages=max_pages, **filters))
        except Exception as exc:
            logger.error("sync_activities_failed", error=str(exc))
            raise

        for raw in raw_activities:
            event_id = str(raw.get("id") or raw.get("activityUuid") or "")
            if not event_id:
                continue

            activity_type_id = raw.get("activityType")
            type_name = activity_types.get(int(activity_type_id), f"Activity {activity_type_id}")
            category = _categorize_activity(raw, type_name)
            nested = raw.get("data", {}) if isinstance(raw.get("data"), dict) else {}
            event_time = _parse_datetime(raw.get("createdAt")) or datetime.now(timezone.utc)

            event = db.execute(
                select(SecurityEvent).where(SecurityEvent.sentinel_event_id == event_id)
            ).scalar_one_or_none()

            title = _coerce_str(raw.get("description")) or type_name
            description = nested.get("fullScopeDetails") or nested.get("computerName")
            hostname = nested.get("computerName") or _coerce_str(raw.get("agentComputerName"))
            agent_id = _coerce_str(raw.get("agentId"))
            user_name = _coerce_str(nested.get("realUser")) or _coerce_str(raw.get("userId"))

            if event:
                event.event_type = type_name
                event.category = category
                event.title = title or event.title
                event.description = _coerce_str(description) or event.description
                event.hostname = hostname or event.hostname
                event.agent_id = agent_id or event.agent_id
                event.user_name = user_name or event.user_name
                event.site_name = _coerce_str(raw.get("siteName")) or event.site_name
                event.event_at = event_time
                event.raw_data = raw
                event.updated_at = datetime.now(timezone.utc)
            else:
                event = SecurityEvent(
                    sentinel_event_id=event_id,
                    event_type=type_name,
                    category=category,
                    title=title or "SentinelOne Activity",
                    description=_coerce_str(description),
                    hostname=hostname,
                    agent_id=agent_id,
                    user_name=user_name,
                    site_name=_coerce_str(raw.get("siteName")),
                    severity="INFO",
                    event_at=event_time,
                    raw_data=raw,
                )
                db.add(event)
            synced += 1

        db.flush()
        logger.info("sync_activities_complete", count=synced)
        return synced
