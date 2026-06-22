from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.database.session import get_db
from app.models.models import User
from app.services.connectors import (
    ElasticConnector,
    SmtpConnector,
    SplunkConnector,
    SyslogConnector,
    TelegramConnector,
    WazuhConnector,
)
from app.services.settings_service import INTEGRATION_KEYS, SettingsService

router = APIRouter(prefix="/settings", tags=["Settings"])
settings_service = SettingsService()

CONNECTORS = {
    "splunk": SplunkConnector(),
    "elastic": ElasticConnector(),
    "wazuh": WazuhConnector(),
    "syslog": SyslogConnector(),
    "smtp": SmtpConnector(),
    "telegram": TelegramConnector(),
}


class IntegrationUpdate(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = False


class IntegrationTestRequest(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)


@router.get("")
async def list_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SOC_MANAGER")),
):
    return await settings_service.list_all(db)


@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SOC_MANAGER")),
):
    if key not in INTEGRATION_KEYS:
        raise HTTPException(status_code=404, detail="Unknown integration")
    return await settings_service.get(db, key)


@router.put("/{key}")
async def save_setting(
    key: str,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ADMIN")),
):
    if key not in INTEGRATION_KEYS:
        raise HTTPException(status_code=404, detail="Unknown integration")
    return await settings_service.save(db, key, body.config, body.enabled, current_user.id)


@router.post("/{key}/test")
async def test_setting(
    key: str,
    body: IntegrationTestRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SOC_MANAGER")),
):
    if key not in INTEGRATION_KEYS:
        raise HTTPException(status_code=404, detail="Unknown integration")

    stored = await settings_service.get_config(db, key)
    from app.services.settings_service import _merge_secrets
    config = _merge_secrets(stored, body.config)

    if key == "sentinelone":
        from app.services.sentinelone_client import SentinelOneClient
        client = SentinelOneClient(config=config)
        ok = await client.health_check()
        return {"ok": ok, "message": "SentinelOne API connected" if ok else "Connection failed"}

    if key == "enrichment":
        has_vt = bool(config.get("virustotal_api_key"))
        return {"ok": has_vt, "message": "VirusTotal key configured" if has_vt else "VirusTotal API key missing"}

    connector = CONNECTORS.get(key)
    if not connector:
        return {"ok": False, "error": "No test available for this integration"}
    return await connector.test(config)
