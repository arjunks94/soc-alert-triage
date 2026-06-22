import json
import socket
from typing import Any


class SyslogConnector:
    async def test(self, config: dict[str, Any]) -> dict[str, Any]:
        host = config.get("host")
        port = int(config.get("port", 514))
        protocol = config.get("protocol", "udp").lower()
        if not host:
            return {"ok": False, "error": "Syslog host is required"}
        try:
            message = "<134>soc-dashboard: connectivity test"
            if protocol == "tcp":
                with socket.create_connection((host, port), timeout=5) as sock:
                    sock.sendall(f"{message}\n".encode())
            else:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                    sock.settimeout(5)
                    sock.sendto(message.encode(), (host, port))
            return {"ok": True, "message": f"Syslog test message sent to {host}:{port} via {protocol.upper()}"}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    async def send_event(self, config: dict[str, Any], event: dict[str, Any]) -> bool:
        host = config.get("host")
        port = int(config.get("port", 514))
        protocol = config.get("protocol", "udp").lower()
        facility = int(config.get("facility", 16))
        priority = facility * 8 + 6
        payload = json.dumps(event, default=str)
        message = f"<{priority}>soc-dashboard: {payload}"
        try:
            if protocol == "tcp":
                with socket.create_connection((host, port), timeout=5) as sock:
                    sock.sendall(f"{message}\n".encode())
            else:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                    sock.sendto(message.encode(), (host, port))
            return True
        except OSError:
            return False
