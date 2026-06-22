from email.message import EmailMessage
from typing import Any

import aiosmtplib


class SmtpConnector:
    async def test(self, config: dict[str, Any]) -> dict[str, Any]:
        host = config.get("host")
        port = int(config.get("port", 587))
        if not host:
            return {"ok": False, "error": "SMTP host is required"}
        try:
            msg = EmailMessage()
            msg["From"] = config.get("from_email", config.get("username", "soc@dashboard.local"))
            msg["To"] = config.get("test_recipient") or config.get("from_email") or config.get("username", "")
            msg["Subject"] = "SOC Dashboard SMTP Test"
            msg.set_content("This is a test email from SOC Dashboard alert notification settings.")
            await aiosmtplib.send(
                msg,
                hostname=host,
                port=port,
                username=config.get("username") or None,
                password=config.get("password") or None,
                start_tls=config.get("use_tls", True),
                use_tls=config.get("use_ssl", False),
            )
            return {"ok": True, "message": f"SMTP test email sent via {host}:{port}"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    async def send_alert(self, config: dict[str, Any], subject: str, body: str, recipients: list[str]) -> bool:
        try:
            msg = EmailMessage()
            msg["From"] = config.get("from_email", config.get("username"))
            msg["To"] = ", ".join(recipients)
            msg["Subject"] = subject
            msg.set_content(body)
            await aiosmtplib.send(
                msg,
                hostname=config["host"],
                port=int(config.get("port", 587)),
                username=config.get("username") or None,
                password=config.get("password") or None,
                start_tls=config.get("use_tls", True),
                use_tls=config.get("use_ssl", False),
            )
            return True
        except Exception:
            return False
