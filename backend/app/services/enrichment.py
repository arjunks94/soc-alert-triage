from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.models import EnrichmentCache

logger = get_logger(__name__)


class EnrichmentProvider:
    name: str = "base"

    async def enrich(self, ioc_type: str, ioc_value: str) -> dict[str, Any]:
        raise NotImplementedError


class VirusTotalProvider(EnrichmentProvider):
    name = "virustotal"

    async def enrich(self, ioc_type: str, ioc_value: str) -> dict[str, Any]:
        settings = get_settings()
        if not settings.VIRUSTOTAL_API_KEY:
            return {"error": "VirusTotal API key not configured"}

        headers = {"x-apikey": settings.VIRUSTOTAL_API_KEY}
        endpoints = {
            "ip": f"https://www.virustotal.com/api/v3/ip_addresses/{ioc_value}",
            "hash": f"https://www.virustotal.com/api/v3/files/{ioc_value}",
            "domain": f"https://www.virustotal.com/api/v3/domains/{ioc_value}",
        }
        url = endpoints.get(ioc_type)
        if not url:
            return {"error": f"Unsupported IOC type: {ioc_type}"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, headers=headers)
                if response.status_code == 404:
                    return {"found": False, "malicious": False}
                response.raise_for_status()
                data = response.json().get("data", {})
                attributes = data.get("attributes", {})
                stats = attributes.get("last_analysis_stats", {})
                return {
                    "found": True,
                    "malicious": stats.get("malicious", 0) > 0,
                    "stats": stats,
                    "reputation": attributes.get("reputation"),
                    "categories": attributes.get("categories", {}),
                }
            except httpx.HTTPError as exc:
                logger.error("virustotal_error", error=str(exc))
                return {"error": str(exc)}


class AbuseIPDBProvider(EnrichmentProvider):
    name = "abuseipdb"

    async def enrich(self, ioc_type: str, ioc_value: str) -> dict[str, Any]:
        if ioc_type != "ip":
            return {"skipped": True, "reason": "AbuseIPDB only supports IP addresses"}

        settings = get_settings()
        if not settings.ABUSEIPDB_API_KEY:
            return {"error": "AbuseIPDB API key not configured"}

        headers = {"Key": settings.ABUSEIPDB_API_KEY, "Accept": "application/json"}
        params = {"ipAddress": ioc_value, "maxAgeInDays": 90, "verbose": ""}

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    "https://api.abuseipdb.com/api/v2/check",
                    headers=headers,
                    params=params,
                )
                response.raise_for_status()
                data = response.json().get("data", {})
                return {
                    "abuse_confidence_score": data.get("abuseConfidenceScore", 0),
                    "is_public": data.get("isPublic"),
                    "country_code": data.get("countryCode"),
                    "usage_type": data.get("usageType"),
                    "total_reports": data.get("totalReports", 0),
                    "is_whitelisted": data.get("isWhitelisted", False),
                }
            except httpx.HTTPError as exc:
                logger.error("abuseipdb_error", error=str(exc))
                return {"error": str(exc)}


class GreyNoiseProvider(EnrichmentProvider):
    name = "greynoise"

    async def enrich(self, ioc_type: str, ioc_value: str) -> dict[str, Any]:
        if ioc_type != "ip":
            return {"skipped": True, "reason": "GreyNoise only supports IP addresses"}

        settings = get_settings()
        if not settings.GREYNOISE_API_KEY:
            return {"error": "GreyNoise API key not configured"}

        headers = {"key": settings.GREYNOISE_API_KEY, "Accept": "application/json"}
        url = f"https://api.greynoise.io/v3/community/{ioc_value}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, headers=headers)
                if response.status_code == 404:
                    return {"found": False, "noise": False}
                response.raise_for_status()
                data = response.json()
                return {
                    "found": True,
                    "noise": data.get("noise", False),
                    "riot": data.get("riot", False),
                    "classification": data.get("classification"),
                    "name": data.get("name"),
                    "tags": data.get("tags", []),
                }
            except httpx.HTTPError as exc:
                logger.error("greynoise_error", error=str(exc))
                return {"error": str(exc)}


class EnrichmentService:
    def __init__(self) -> None:
        self.providers: list[EnrichmentProvider] = [
            VirusTotalProvider(),
            AbuseIPDBProvider(),
            GreyNoiseProvider(),
        ]

    async def _get_cached(
        self, db: AsyncSession, ioc_type: str, ioc_value: str
    ) -> Optional[dict[str, Any]]:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(EnrichmentCache).where(
                EnrichmentCache.ioc_type == ioc_type,
                EnrichmentCache.ioc_value == ioc_value,
                EnrichmentCache.expires_at > now,
            )
        )
        entries = result.scalars().all()
        if not entries:
            return None
        return {entry.provider: entry.result for entry in entries}

    async def _cache_result(
        self, db: AsyncSession, ioc_type: str, ioc_value: str, provider: str, result: dict[str, Any]
    ) -> None:
        settings = get_settings()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.ENRICHMENT_CACHE_TTL_SECONDS)
        cache_entry = EnrichmentCache(
            ioc_type=ioc_type,
            ioc_value=ioc_value,
            provider=provider,
            result=result,
            expires_at=expires_at,
        )
        db.add(cache_entry)

    async def enrich(self, db: AsyncSession, ioc_type: str, ioc_value: str) -> tuple[dict[str, Any], bool]:
        cached = await self._get_cached(db, ioc_type, ioc_value)
        if cached:
            return cached, True

        results: dict[str, Any] = {}
        for provider in self.providers:
            result = await provider.enrich(ioc_type, ioc_value)
            results[provider.name] = result
            await self._cache_result(db, ioc_type, ioc_value, provider.name, result)

        return results, False

    async def enrich_ip(self, db: AsyncSession, ip: str) -> tuple[dict[str, Any], bool]:
        return await self.enrich(db, "ip", ip)

    async def enrich_hash(self, db: AsyncSession, file_hash: str) -> tuple[dict[str, Any], bool]:
        return await self.enrich(db, "hash", file_hash)

    async def enrich_domain(self, db: AsyncSession, domain: str) -> tuple[dict[str, Any], bool]:
        return await self.enrich(db, "domain", domain)
