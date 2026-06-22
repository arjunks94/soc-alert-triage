from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import SystemSetting

MODULES: tuple[str, ...] = (
    "dashboard",
    "alerts",
    "incidents",
    "endpoints",
    "events",
    "threats",
    "analysts",
    "settings",
    "wallboard",
    "sync",
)

MODULE_LABELS: dict[str, str] = {
    "dashboard": "Dashboard",
    "alerts": "Alerts",
    "incidents": "Incidents",
    "endpoints": "Endpoints",
    "events": "Events",
    "threats": "Threats",
    "analysts": "Analysts",
    "settings": "Settings",
    "wallboard": "Wallboard",
    "sync": "SentinelOne Sync",
}

PERMISSION_LEVELS: tuple[str, ...] = ("none", "view", "edit", "manage")
LEVEL_RANK = {"none": 0, "view": 1, "edit": 2, "manage": 3}

DEFAULT_ROLE_PERMISSIONS: dict[str, dict[str, str]] = {
    "SOC_ADMIN": {module: "manage" for module in MODULES},
    "SOC_MANAGER": {
        "dashboard": "view",
        "alerts": "edit",
        "incidents": "edit",
        "endpoints": "view",
        "events": "view",
        "threats": "view",
        "analysts": "view",
        "settings": "edit",
        "wallboard": "view",
        "sync": "edit",
    },
    "SOC_ANALYST": {
        "dashboard": "view",
        "alerts": "edit",
        "incidents": "edit",
        "endpoints": "view",
        "events": "view",
        "threats": "view",
        "analysts": "view",
        "settings": "none",
        "wallboard": "view",
        "sync": "edit",
    },
    "VIEWER": {
        "dashboard": "view",
        "alerts": "view",
        "incidents": "view",
        "endpoints": "view",
        "events": "view",
        "threats": "view",
        "analysts": "none",
        "settings": "none",
        "wallboard": "view",
        "sync": "none",
    },
}

ROLES: tuple[str, ...] = tuple(DEFAULT_ROLE_PERMISSIONS.keys())
SETTINGS_KEY = "role_permissions"


class RbacService:
    async def get_permissions(self, db: AsyncSession) -> dict[str, dict[str, str]]:
        row = await self._get_row(db)
        stored = row.config if row else {}
        merged: dict[str, dict[str, str]] = {}
        for role in ROLES:
            base = dict(DEFAULT_ROLE_PERMISSIONS[role])
            overrides = stored.get(role, {}) if isinstance(stored.get(role), dict) else {}
            for module in MODULES:
                level = overrides.get(module, base.get(module, "none"))
                if level not in PERMISSION_LEVELS:
                    level = base.get(module, "none")
                base[module] = level
            merged[role] = base
        return merged

    async def save_permissions(
        self,
        db: AsyncSession,
        permissions: dict[str, dict[str, str]],
        user_id: UUID,
    ) -> dict[str, dict[str, str]]:
        from datetime import datetime, timezone

        sanitized: dict[str, dict[str, str]] = {}
        for role in ROLES:
            if role not in permissions:
                continue
            sanitized[role] = {}
            for module in MODULES:
                level = permissions[role].get(module, DEFAULT_ROLE_PERMISSIONS[role].get(module, "none"))
                sanitized[role][module] = level if level in PERMISSION_LEVELS else "none"

        row = await self._get_row(db)
        if row:
            row.config = sanitized
            row.updated_by = user_id
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = SystemSetting(key=SETTINGS_KEY, config=sanitized, enabled=True, updated_by=user_id)
            db.add(row)
        await db.flush()
        return await self.get_permissions(db)

    def permissions_for_role(self, role: str, matrix: dict[str, dict[str, str]]) -> dict[str, str]:
        return matrix.get(role, DEFAULT_ROLE_PERMISSIONS.get(role, {}))

    def can_access(self, role: str, module: str, minimum: str, matrix: Optional[dict[str, dict[str, str]]] = None) -> bool:
        perms = (matrix or {}).get(role, DEFAULT_ROLE_PERMISSIONS.get(role, {}))
        level = perms.get(module, DEFAULT_ROLE_PERMISSIONS.get(role, {}).get(module, "none"))
        return LEVEL_RANK.get(level, 0) >= LEVEL_RANK.get(minimum, 0)

    async def _get_row(self, db: AsyncSession) -> Optional[SystemSetting]:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == SETTINGS_KEY))
        return result.scalar_one_or_none()

    def describe_matrix(self, matrix: dict[str, dict[str, str]]) -> dict[str, Any]:
        return {
            "modules": [{"id": m, "label": MODULE_LABELS[m]} for m in MODULES],
            "roles": list(ROLES),
            "levels": list(PERMISSION_LEVELS),
            "permissions": matrix,
            "defaults": DEFAULT_ROLE_PERMISSIONS,
        }
