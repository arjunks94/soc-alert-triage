from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import SystemSetting

SECRET_FIELDS = frozenset({
    "api_token", "password", "hec_token", "api_key", "bot_token",
    "abuseipdb_api_key", "greynoise_api_key", "virustotal_api_key",
})

MASK = "********"

INTEGRATION_KEYS = (
    "sentinelone", "splunk", "elastic", "wazuh", "syslog",
    "enrichment", "smtp", "telegram",
)

ENV_DEFAULTS: dict[str, dict[str, Any]] = {
    "sentinelone": lambda s: {
        "base_url": s.S1_BASE_URL,
        "api_token": s.S1_API_TOKEN,
    },
    "enrichment": lambda s: {
        "virustotal_api_key": s.VIRUSTOTAL_API_KEY,
        "abuseipdb_api_key": s.ABUSEIPDB_API_KEY,
        "greynoise_api_key": s.GREYNOISE_API_KEY,
    },
}


def _mask_config(config: dict[str, Any]) -> dict[str, Any]:
    masked = dict(config)
    for field in SECRET_FIELDS:
        if masked.get(field):
            masked[field] = MASK
    return masked


def _merge_secrets(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = {**existing, **incoming}
    for field in SECRET_FIELDS:
        if incoming.get(field) in (None, "", MASK):
            if existing.get(field):
                merged[field] = existing[field]
            else:
                merged.pop(field, None)
    return merged


class SettingsService:
    async def get(self, db: AsyncSession, key: str) -> dict[str, Any]:
        row = await self._get_row(db, key)
        env = get_settings()
        defaults = ENV_DEFAULTS.get(key, lambda _: {})(env)
        config = {**defaults, **(row.config if row else {})}
        return {
            "key": key,
            "enabled": row.enabled if row else bool(defaults.get("base_url") or defaults.get("api_token")),
            "config": _mask_config(config),
        }

    async def list_all(self, db: AsyncSession) -> list[dict[str, Any]]:
        return [await self.get(db, key) for key in INTEGRATION_KEYS]

    async def save(
        self,
        db: AsyncSession,
        key: str,
        config: dict[str, Any],
        enabled: bool,
        user_id: UUID,
    ) -> dict[str, Any]:
        row = await self._get_row(db, key)
        if row:
            row.config = _merge_secrets(row.config or {}, config)
            row.enabled = enabled
            row.updated_by = user_id
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = SystemSetting(
                key=key,
                config=config,
                enabled=enabled,
                updated_by=user_id,
            )
            db.add(row)
        await db.flush()
        return await self.get(db, key)

    async def get_config(self, db: AsyncSession, key: str) -> dict[str, Any]:
        """Unmasked config merged with environment defaults."""
        row = await self._get_row(db, key)
        env = get_settings()
        defaults = ENV_DEFAULTS.get(key, lambda _: {})(env)
        stored = row.config if row else {}
        merged = {**defaults, **stored}
        if row and not row.enabled and key not in ("sentinelone", "enrichment"):
            return {}
        return merged

    def get_config_sync(self, session: Session, key: str) -> dict[str, Any]:
        row = session.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        ).scalar_one_or_none()
        env = get_settings()
        defaults = ENV_DEFAULTS.get(key, lambda _: {})(env)
        stored = row.config if row else {}
        if row and not row.enabled and key not in ("sentinelone", "enrichment"):
            return {}
        return {**defaults, **stored}

    async def _get_row(self, db: AsyncSession, key: str) -> Optional[SystemSetting]:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        return result.scalar_one_or_none()
