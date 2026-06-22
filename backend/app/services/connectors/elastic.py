from typing import Any

import httpx


class ElasticConnector:
    async def test(self, config: dict[str, Any]) -> dict[str, Any]:
        url = (config.get("url") or "").rstrip("/")
        if not url:
            return {"ok": False, "error": "Elasticsearch URL is required"}
        headers = {"Content-Type": "application/json"}
        if config.get("api_key"):
            headers["Authorization"] = f"ApiKey {config['api_key']}"
        elif config.get("username") and config.get("password"):
            auth = (config["username"], config["password"])
        else:
            auth = None
        async with httpx.AsyncClient(timeout=15.0, verify=config.get("verify_ssl", True)) as client:
            response = await client.get(f"{url}/_cluster/health", headers=headers, auth=auth)
            if response.status_code == 200:
                data = response.json()
                return {"ok": True, "message": f"Elasticsearch cluster status: {data.get('status')}"}
            return {"ok": False, "error": f"HTTP {response.status_code}: {response.text[:200]}"}

    async def send_event(self, config: dict[str, Any], event: dict[str, Any]) -> bool:
        index = config.get("index", "soc-events")
        url = f"{config['url'].rstrip('/')}/{index}/_doc"
        headers = {"Content-Type": "application/json"}
        auth = None
        if config.get("api_key"):
            headers["Authorization"] = f"ApiKey {config['api_key']}"
        elif config.get("username"):
            auth = (config["username"], config.get("password", ""))
        async with httpx.AsyncClient(timeout=15.0, verify=config.get("verify_ssl", True)) as client:
            response = await client.post(url, json=event, headers=headers, auth=auth)
            return response.status_code in (200, 201)
