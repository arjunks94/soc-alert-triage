import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog


async def create_audit_log(
    db: AsyncSession,
    action: str,
    resource: str,
    user_id: Optional[uuid.UUID] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log)
    await db.flush()
    return log


def normalize_severity(severity: str) -> str:
    mapping = {
        "critical": "CRITICAL",
        "high": "HIGH",
        "medium": "MEDIUM",
        "low": "LOW",
        "info": "LOW",
    }
    return mapping.get(severity.lower(), severity.upper())


def generate_incident_number() -> str:
    now = datetime.now(timezone.utc)
    return f"INC-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
