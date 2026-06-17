from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.models import Alert, Endpoint, Incident
from app.services.sentinelone_client import SentinelOneClient
from app.utils.helpers import normalize_severity

logger = get_logger(__name__)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
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


class SyncService:
    def __init__(self) -> None:
        self.client = SentinelOneClient()

    def sync_alerts(self, db: Session) -> int:
        synced = 0
        try:
            import asyncio
            raw_alerts = asyncio.run(self.client.get_alerts())
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

            severity = normalize_severity(
                raw.get("severity", raw.get("alertInfo", {}).get("severity", "MEDIUM"))
            )
            tactics, techniques = _extract_mitre(raw)
            agent_info = raw.get("agentRealtimeInfo", raw.get("agentDetectionInfo", {}))

            if alert:
                alert.title = raw.get("name", raw.get("title", alert.title))
                alert.description = raw.get("description", alert.description)
                alert.severity = severity
                alert.hostname = agent_info.get("agentComputerName", alert.hostname)
                alert.agent_id = str(agent_info.get("agentId", alert.agent_id or ""))
                alert.mitre_tactics = tactics or alert.mitre_tactics
                alert.mitre_techniques = techniques or alert.mitre_techniques
                alert.raw_data = raw
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
                )
                db.add(alert)
            synced += 1

        db.flush()
        logger.info("sync_alerts_complete", count=synced)
        return synced

    def sync_agents(self, db: Session) -> int:
        synced = 0
        try:
            import asyncio
            raw_agents = asyncio.run(self.client.get_agents())
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
                )
                db.add(endpoint)
            synced += 1

        db.flush()
        logger.info("sync_agents_complete", count=synced)
        return synced

    def sync_threats(self, db: Session) -> int:
        synced = 0
        try:
            import asyncio
            raw_threats = asyncio.run(self.client.get_threats())
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
            severity = normalize_severity(threat_info.get("classification", "HIGH"))
            tactics, techniques = _extract_mitre(raw)

            if alert:
                alert.title = threat_info.get("threatName", alert.title)
                alert.severity = severity
                alert.hostname = agent_info.get("agentComputerName", alert.hostname)
                alert.mitre_tactics = tactics or alert.mitre_tactics
                alert.mitre_techniques = techniques or alert.mitre_techniques
                alert.raw_data = raw
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

            if incident:
                incident.title = raw.get("name", raw.get("title", incident.title))
                incident.description = raw.get("description", incident.description)
                incident.severity = normalize_severity(raw.get("severity", incident.severity))
                incident.status = raw.get("status", incident.status).upper()
                incident.updated_at = datetime.now(timezone.utc)
            else:
                incident = Incident(
                    incident_number=incident_number,
                    title=raw.get("name", raw.get("title", "S1 Incident")),
                    description=raw.get("description"),
                    severity=normalize_severity(raw.get("severity", "MEDIUM")),
                    status=raw.get("status", "OPEN").upper(),
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
