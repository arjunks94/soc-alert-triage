from typing import Any

import httpx


class SplunkConnector:
    async def test(self, config: dict[str, Any]) -> dict[str, Any]:
        url = (config.get("hec_url") or "").rstrip("/")
        token = config.get("hec_token", "")
        if not url or not token:
            return {"ok": False, "error": "HEC URL and token are required"}
        endpoint = f"{url}/services/collector/event"
        payload = {"event": {"message": "SOC Dashboard connectivity test", "source": "soc-dashboard"}}
        headers = {"Authorization": f"Splunk {token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=15.0, verify=config.get("verify_ssl", True)) as client:
            response = await client.post(endpoint, json=payload, headers=headers)
            if response.status_code in (200, 201):
                return {"ok": True, "message": "Splunk HEC connection successful"}
            return {"ok": False, "error": f"HTTP {response.status_code}: {response.text[:200]}"}

    async def send_event(self, config: dict[str, Any], event: dict[str, Any]) -> bool:
        result = await self.test(config) if not config.get("hec_url") else None
        if result and not result.get("ok"):
            return False
        url = config["hec_url"].rstrip("/")
        headers = {"Authorization": f"Splunk {config['hec_token']}", "Content-Type": "application/json"}
        body = {
            "event": event,
            "sourcetype": config.get("sourcetype", "soc:dashboard"),
            "index": config.get("index"),
        }
        async with httpx.AsyncClient(timeout=15.0, verify=config.get("verify_ssl", True)) as client:
            response = await client.post(f"{url}/services/collector/event", json=body, headers=headers)
            return response.status_code in (200, 201)
