from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.models import Alert, Endpoint, Incident, SecurityEvent, SystemSetting
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
    "rdp success",
    "rdp failure",
    "rdp connection",
    "mstsc",
    "terminal services",
    "remote session",
    "interactive logon",
    "windows logon",
)


def _activity_text_blob(raw: dict[str, Any], type_name: str) -> str:
    nested = raw.get("data", {}) if isinstance(raw.get("data"), dict) else {}
    parts = [
        type_name,
        str(raw.get("description", "")),
        str(raw.get("primaryDescription", "")),
        str(raw.get("activityType", "")) if isinstance(raw.get("activityType"), str) else "",
        str(raw.get("siteName", "")),
        str(nested.get("fullScopeDetails", "")),
        str(nested.get("primaryDescription", "")),
        str(nested.get("accountName", "")),
        str(nested.get("computerName", "")),
        str(nested.get("siteName", "")),
        str(nested.get("userName", "")),
        str(nested.get("realUser", "")),
        str(nested.get("sourceIp", "")),
        str(nested.get("destinationHost", "")),
    ]
    return " ".join(p for p in parts if p).lower()


def _is_remote_desktop(raw: dict[str, Any], type_name: str) -> bool:
    text = _activity_text_blob(raw, type_name)
    type_lower = type_name.lower()
    if any(keyword in text or keyword in type_lower for keyword in REMOTE_DESKTOP_KEYWORDS):
        return True
    if "rdp" in text or "rdp" in type_lower:
        return True
    # Match structured SentinelOne / Telegram RDP alert text
    if "source ip" in text and ("dest host" in text or "destination" in text):
        return True
    if "user:" in text and "source ip" in text:
        return True
    return False


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
    from app.utils.helpers import extract_mitre_from_raw
    tactics, techniques = extract_mitre_from_raw(data)
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
    if _is_remote_desktop(raw, type_name):
        return "remote_desktop"
    return "activity"


def _parse_activity_fields(raw: dict[str, Any], type_name: str) -> dict[str, Any]:
    nested = raw.get("data", {}) if isinstance(raw.get("data"), dict) else {}
    description_text = str(
        raw.get("description", "") or raw.get("primaryDescription", "") or nested.get("primaryDescription", "") or ""
    )
    full_scope = str(nested.get("fullScopeDetails", "") or "")

    source_ip = (
        nested.get("sourceIp")
        or nested.get("sourceIP")
        or nested.get("ipAddress")
        or nested.get("externalIp")
    )
    dest_host = (
        nested.get("destinationHost")
        or nested.get("destHost")
        or nested.get("computerName")
        or nested.get("hostName")
    )
    user_name = (
        nested.get("realUser")
        or nested.get("userName")
        or nested.get("accountName")
        or raw.get("userId")
    )
    site_name = _coerce_str(raw.get("siteName")) or _coerce_str(nested.get("siteName"))
    hostname = nested.get("computerName") or _coerce_str(raw.get("agentComputerName"))

    for blob in (description_text, full_scope, _activity_text_blob(raw, type_name)):
        blob_lower = blob.lower() if isinstance(blob, str) else blob
        if not source_ip and "source ip" in blob_lower:
            for part in blob.replace(":", " ").replace(",", " ").split():
                if part.count(".") == 3 and all(p.isdigit() for p in part.split(".")):
                    source_ip = part
                    break
        if not dest_host and ("dest host" in blob_lower or "destination host" in blob_lower):
            for marker in ("dest host", "destination host"):
                if marker in blob_lower:
                    idx = blob_lower.find(marker)
                    fragment = blob[idx + len(marker) :].lstrip(" :")
                    dest_host = fragment.split("\n")[0].strip().split()[0] if fragment.strip() else dest_host
                    break
        if not user_name and "user:" in blob_lower:
            idx = blob_lower.find("user:")
            user_name = blob[idx + 5 :].split("\n")[0].strip().split(",")[0].strip()
        if not site_name and "site:" in blob_lower:
            idx = blob_lower.find("site:")
            site_name = blob[idx + 5 :].split("\n")[0].strip()

    category = _categorize_activity(raw, type_name)
    title = _coerce_str(raw.get("description")) or type_name
    if category == "remote_desktop":
        if "rdp success" in description_text.lower() or "success" in type_name.lower():
            title = "RDP Success"
            severity = "HIGH"
        elif "failure" in description_text.lower() or "failed" in description_text.lower():
            title = "RDP Failure"
            severity = "MEDIUM"
        else:
            title = title if "rdp" in title.lower() else f"RDP — {title}"
            severity = "HIGH"
        description = (
            f"User: {user_name or '—'}\n"
            f"Source IP: {source_ip or '—'}\n"
            f"Dest Host: {dest_host or hostname or '—'}\n"
            f"Site: {site_name or '—'}"
        )
    else:
        severity = "INFO"
        description = full_scope or nested.get("computerName")

    return {
        "category": category,
        "title": title or "SentinelOne Activity",
        "description": _coerce_str(description),
        "hostname": _coerce_str(hostname),
        "user_name": _coerce_str(user_name),
        "site_name": site_name,
        "source_ip": _coerce_str(source_ip),
        "dest_host": _coerce_str(dest_host),
        "severity": severity,
    }


def _notify_integrations(session: Session, event: SecurityEvent, is_new: bool) -> None:
    if not is_new or event.category != "remote_desktop":
        return
    import asyncio
    from app.services.settings_service import SettingsService
    from app.services.connectors import TelegramConnector, SyslogConnector, SplunkConnector, ElasticConnector, WazuhConnector

    settings = SettingsService()
    payload = {
        "event_at": event.event_at.isoformat(),
        "title": event.title,
        "user_name": event.user_name,
        "source_ip": event.source_ip,
        "dest_host": event.dest_host,
        "hostname": event.hostname,
        "site_name": event.site_name,
        "category": event.category,
    }

    async def _send_all() -> None:
        from app.models.models import SystemSetting
        for int_key, connector_cls in (
            ("telegram", TelegramConnector),
        ):
            row = session.execute(select(SystemSetting).where(SystemSetting.key == int_key)).scalar_one_or_none()
            if row and not row.enabled:
                continue
            cfg = settings.get_config_sync(session, int_key)
            if int_key == "telegram" and cfg.get("bot_token") and cfg.get("chat_id"):
                tg = TelegramConnector()
                await tg.send_message(cfg, tg.format_rdp_event(payload))
        for int_key, connector_cls in (
            ("splunk", SplunkConnector),
            ("elastic", ElasticConnector),
            ("wazuh", WazuhConnector),
            ("syslog", SyslogConnector),
        ):
            row = session.execute(select(SystemSetting).where(SystemSetting.key == int_key)).scalar_one_or_none()
            if not row or not row.enabled:
                continue
            cfg = settings.get_config_sync(session, int_key)
            await connector_cls().send_event(cfg, payload)

    try:
        asyncio.run(_send_all())
    except Exception as exc:
        logger.warning("integration_notify_failed", error=str(exc))


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
    def __init__(self, db: Optional[Session] = None) -> None:
        from app.services.settings_service import SettingsService
        config = SettingsService().get_config_sync(db, "sentinelone") if db else {}
        self.client = SentinelOneClient(config=config)
        self._db = db

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
            if full:
                since = datetime.now(timezone.utc) - timedelta(days=90)
                filters["createdAt__gte"] = since.isoformat()
            else:
                filters.update(_incremental_since(db, SecurityEvent.event_at, full=False, default_days=30))
            max_pages = None if full else 50
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
            parsed = _parse_activity_fields(raw, type_name)
            event_time = _parse_datetime(raw.get("createdAt")) or datetime.now(timezone.utc)

            event = db.execute(
                select(SecurityEvent).where(SecurityEvent.sentinel_event_id == event_id)
            ).scalar_one_or_none()

            agent_id = _coerce_str(raw.get("agentId"))
            is_new = event is None

            if event:
                event.event_type = type_name
                event.category = parsed["category"]
                event.title = parsed["title"]
                event.description = parsed["description"]
                event.hostname = parsed["hostname"] or event.hostname
                event.agent_id = agent_id or event.agent_id
                event.user_name = parsed["user_name"] or event.user_name
                event.site_name = parsed["site_name"] or event.site_name
                event.source_ip = parsed["source_ip"] or event.source_ip
                event.dest_host = parsed["dest_host"] or event.dest_host
                event.severity = parsed["severity"]
                event.event_at = event_time
                event.raw_data = raw
                event.updated_at = datetime.now(timezone.utc)
            else:
                event = SecurityEvent(
                    sentinel_event_id=event_id,
                    event_type=type_name,
                    category=parsed["category"],
                    title=parsed["title"],
                    description=parsed["description"],
                    hostname=parsed["hostname"],
                    agent_id=agent_id,
                    user_name=parsed["user_name"],
                    site_name=parsed["site_name"],
                    source_ip=parsed["source_ip"],
                    dest_host=parsed["dest_host"],
                    severity=parsed["severity"],
                    event_at=event_time,
                    raw_data=raw,
                )
                db.add(event)
            db.flush()
            _notify_integrations(db, event, is_new)
            synced += 1

        db.flush()
        logger.info("sync_activities_complete", count=synced)
        return synced
