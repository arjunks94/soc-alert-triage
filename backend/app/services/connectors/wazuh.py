from typing import Any

import httpx

from app.services.connectors.elastic import ElasticConnector


class WazuhConnector:
    """Wazuh indexer/API connectivity (Elasticsearch-compatible indexer or Wazuh API)."""

    async def test(self, config: dict[str, Any]) -> dict[str, Any]:
        url = (config.get("url") or "").rstrip("/")
        if not url:
            return {"ok": False, "error": "Wazuh URL is required"}
        mode = config.get("mode", "indexer")
        if mode == "api":
            return await self._test_api(url, config)
        return await self._test_indexer(url, config)

    async def _test_indexer(self, url: str, config: dict[str, Any]) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        auth = (config.get("username", ""), config.get("password", ""))
        async with httpx.AsyncClient(timeout=15.0, verify=config.get("verify_ssl", False)) as client:
            response = await client.get(f"{url}/_cluster/health", headers=headers, auth=auth)
            if response.status_code == 200:
                return {"ok": True, "message": "Wazuh indexer connection successful"}
            return {"ok": False, "error": f"HTTP {response.status_code}: {response.text[:200]}"}

    async def _test_api(self, url: str, config: dict[str, Any]) -> dict[str, Any]:
        auth = (config.get("username", ""), config.get("password", ""))
        async with httpx.AsyncClient(timeout=15.0, verify=config.get("verify_ssl", False)) as client:
            response = await client.get(f"{url}/", auth=auth)
            if response.status_code == 200:
                return {"ok": True, "message": "Wazuh API connection successful"}
            return {"ok": False, "error": f"HTTP {response.status_code}: {response.text[:200]}"}

    async def send_event(self, config: dict[str, Any], event: dict[str, Any]) -> bool:
        connector = ElasticConnector()
        indexer_url = config.get("indexer_url") or config.get("url")
        if not indexer_url:
            return False
        send_config = {**config, "url": indexer_url, "index": config.get("index", "wazuh-alerts")}
        return await connector.send_event(send_config, event)
