import asyncio
import time
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SentinelOneAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class SentinelOneClient:
    """Client for SentinelOne Cloud Management Console API v2.1."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.S1_BASE_URL.rstrip("/")
        self.api_token = settings.S1_API_TOKEN
        self._rate_limit_delay = 0.1
        self._last_request_time = 0.0
        self._page_size = 100

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"ApiToken {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _rate_limit(self) -> None:
        elapsed = time.monotonic() - self._last_request_time
        if elapsed < self._rate_limit_delay:
            await asyncio.sleep(self._rate_limit_delay - elapsed)
        self._last_request_time = time.monotonic()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict[str, Any]] = None,
        json_data: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        if not self.base_url or not self.api_token:
            raise SentinelOneAPIError("SentinelOne API not configured")

        await self._rate_limit()
        url = f"{self.base_url}/web/api/v2.1{endpoint}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self._headers(),
                    params=params,
                    json=json_data,
                )
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", "5"))
                    logger.warning("rate_limited", retry_after=retry_after)
                    await asyncio.sleep(retry_after)
                    raise SentinelOneAPIError("Rate limited", 429)

                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "s1_api_error",
                    status=exc.response.status_code,
                    endpoint=endpoint,
                    detail=exc.response.text[:500],
                )
                raise SentinelOneAPIError(
                    f"API error: {exc.response.status_code}",
                    exc.response.status_code,
                ) from exc
            except httpx.RequestError as exc:
                logger.error("s1_request_error", endpoint=endpoint, error=str(exc))
                raise SentinelOneAPIError(f"Request failed: {exc}") from exc

    async def _paginate(
        self,
        endpoint: str,
        params: Optional[dict[str, Any]] = None,
        max_pages: Optional[int] = 50,
    ) -> list[dict[str, Any]]:
        all_items: list[dict[str, Any]] = []
        cursor: Optional[str] = None
        base_params = dict(params or {})
        base_params["limit"] = self._page_size
        pages = 0

        while True:
            request_params = dict(base_params)
            if cursor:
                request_params["cursor"] = cursor

            data = await self._request("GET", endpoint, params=request_params)
            pagination = data.get("pagination", {})
            items = self._extract_items(data)
            all_items.extend(items)
            pages += 1

            cursor = pagination.get("nextCursor")
            if not cursor or not items:
                break
            if max_pages is not None and pages >= max_pages:
                logger.info("s1_paginate_max_pages", endpoint=endpoint, pages=pages)
                break

        logger.info("s1_paginate_complete", endpoint=endpoint, count=len(all_items), pages=pages)
        return all_items

    @staticmethod
    def _extract_items(data: dict[str, Any]) -> list[dict[str, Any]]:
        for key in ("data", "threats", "agents", "sites", "incidents", "activities"):
            if key in data and isinstance(data[key], list):
                return data[key]
        return []

    async def get_alerts(self, max_pages: Optional[int] = 50, **filters: Any) -> list[dict[str, Any]]:
        params = {"sortOrder": "desc", **filters}
        return await self._paginate("/cloud-detection/alerts", params, max_pages=max_pages)

    async def get_threats(self, max_pages: Optional[int] = 50, **filters: Any) -> list[dict[str, Any]]:
        params = {"sortBy": "createdAt", "sortOrder": "desc", **filters}
        return await self._paginate("/threats", params, max_pages=max_pages)

    async def get_agents(self, max_pages: Optional[int] = 50, **filters: Any) -> list[dict[str, Any]]:
        params = {"sortBy": "lastActiveDate", "sortOrder": "desc", **filters}
        return await self._paginate("/agents", params, max_pages=max_pages)

    async def get_sites(self, **filters: Any) -> list[dict[str, Any]]:
        params = {"sortBy": "name", "sortOrder": "asc", **filters}
        return await self._paginate("/sites", params)

    async def get_incidents(self, **filters: Any) -> list[dict[str, Any]]:
        params = {"sortOrder": "desc", **filters}
        try:
            return await self._paginate("/incidents", params)
        except Exception as exc:
            logger.warning("s1_incidents_not_available", error=str(exc))
            return []

    async def get_activities(self, max_pages: Optional[int] = 20, **filters: Any) -> list[dict[str, Any]]:
        params = {"sortBy": "createdAt", "sortOrder": "desc", **filters}
        return await self._paginate("/activities", params, max_pages=max_pages)

    async def get_activity_types(self) -> dict[int, str]:
        try:
            data = await self._request("GET", "/activities/types")
            items = data.get("data", [])
            return {
                int(item["id"]): str(item.get("name", item.get("activityType", f"Type {item['id']}")))
                for item in items
                if item.get("id") is not None
            }
        except Exception as exc:
            logger.warning("s1_activity_types_not_available", error=str(exc))
            return {}

    async def health_check(self) -> bool:
        try:
            await self._request("GET", "/system/status")
            return True
        except SentinelOneAPIError:
            return False
