from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.models import Alert, User
from app.utils.helpers import normalize_classification

router = APIRouter(tags=["Threats"])


@router.get("/threats")
async def list_threats(
    severity: Optional[str] = Query(None, max_length=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    base_filter = Alert.sentinel_alert_id.like("threat-%")
    query = select(Alert).where(base_filter).order_by(Alert.created_at.desc()).limit(200)
    if severity:
        query = query.where(Alert.severity == normalize_classification(severity))

    result = await db.execute(query)
    threats = result.scalars().all()

    severity_counts = await db.execute(
        select(Alert.severity, func.count(Alert.id))
        .where(base_filter)
        .group_by(Alert.severity)
        .order_by(func.count(Alert.id).desc())
    )
    distribution = {row[0]: row[1] for row in severity_counts.all()}

    return {
        "threats": [
            {
                "id": str(t.id),
                "title": t.title,
                "severity": t.severity,
                "hostname": t.hostname,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
            }
            for t in threats
        ],
        "severity_distribution": distribution,
        "total": sum(distribution.values()),
        "filtered_total": len(threats),
    }
