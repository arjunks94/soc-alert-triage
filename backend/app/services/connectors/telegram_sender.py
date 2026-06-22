from typing import Any

import httpx


class TelegramConnector:
    async def test(self, config: dict[str, Any]) -> dict[str, Any]:
        token = config.get("bot_token", "")
        chat_id = config.get("chat_id", "")
        if not token or not chat_id:
            return {"ok": False, "error": "Bot token and chat ID are required"}
        text = "✅ SOC Dashboard Telegram integration test successful."
        return await self._send(token, chat_id, text)

    async def send_message(self, config: dict[str, Any], text: str) -> bool:
        result = await self._send(config.get("bot_token", ""), config.get("chat_id", ""), text)
        return bool(result.get("ok"))

    async def _send(self, token: str, chat_id: str, text: str) -> dict[str, Any]:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json={"chat_id": chat_id, "text": text})
            if response.status_code == 200 and response.json().get("ok"):
                return {"ok": True, "message": "Telegram message sent"}
            return {"ok": False, "error": response.text[:300]}

    def format_rdp_event(self, event: dict[str, Any]) -> str:
        title = str(event.get("title") or "")
        if "success" in title.lower():
            header = "🔴 RDP Success"
        elif "failure" in title.lower() or "failed" in title.lower():
            header = "🟡 RDP Failure"
        else:
            header = f"🔴 {title or 'RDP Event'}"
        site = event.get("site_name") or "—"
        lines = [
            header,
            f"Time: {event.get('event_at', '')}",
            f"User: {event.get('user_name') or '—'}",
            f"Source IP: {event.get('source_ip') or '—'}",
            f"Dest Host: {event.get('dest_host') or event.get('hostname') or '—'}",
            f"this is from site: {site}",
        ]
        return "\n".join(lines)
