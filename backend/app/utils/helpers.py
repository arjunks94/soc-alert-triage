import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog


async def create_audit_log(
    db: AsyncSession,
    action: str,
    resource: str,
    user_id: Optional[uuid.UUID] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log)
    await db.flush()
    return log


def normalize_classification(value: str) -> str:
    """Normalize SentinelOne severity or threat classification for storage."""
    if not value or not str(value).strip():
        return "UNKNOWN"
    cleaned = str(value).strip().upper().replace(" ", "_").replace("-", "_")
    standard = {
        "critical": "CRITICAL",
        "high": "HIGH",
        "medium": "MEDIUM",
        "low": "LOW",
        "info": "INFO",
    }
    return standard.get(cleaned.lower(), cleaned)


def normalize_severity(severity: str) -> str:
    return normalize_classification(severity)


# Map threat classifications to MITRE tactic/technique when S1 omits explicit MITRE fields
CLASSIFICATION_MITRE_FALLBACK: dict[str, tuple[str, str]] = {
    "MALWARE": ("Execution", "Malicious File"),
    "RANSOMWARE": ("Impact", "Data Encrypted for Impact"),
    "TROJAN": ("Execution", "User Execution"),
    "VIRUS": ("Execution", "Malicious File"),
    "WORM": ("Lateral Movement", "Remote Services"),
    "EXPLOIT": ("Initial Access", "Exploit Public-Facing Application"),
    "CRYPTOMINER": ("Impact", "Resource Hijacking"),
    "CRYPTOMINING": ("Impact", "Resource Hijacking"),
    "SPYWARE": ("Collection", "Input Capture"),
    "BACKDOOR": ("Persistence", "Create Account"),
    "ROOTKIT": ("Defense Evasion", "Rootkit"),
    "DOWNLOADER": ("Command and Control", "Ingress Tool Transfer"),
    "PHISHING": ("Initial Access", "Phishing"),
    "PUP": ("Execution", "User Execution"),
    "PUA": ("Execution", "User Execution"),
    "GENERAL": ("Discovery", "System Information Discovery"),
    "SUSPICIOUS": ("Defense Evasion", "Obfuscated Files or Information"),
    "NETWORK": ("Command and Control", "Application Layer Protocol"),
    "BENIGN": ("N/A", "Benign Activity"),
    "UNKNOWN": ("N/A", "Unclassified Threat"),
}


def infer_mitre_from_classification(classification: str) -> tuple[list[str], list[str]]:
    key = normalize_classification(classification)
    tactic, technique = CLASSIFICATION_MITRE_FALLBACK.get(key, ("N/A", key.replace("_", " ").title()))
    return [tactic], [technique]


def extract_mitre_from_raw(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Extract MITRE tactics/techniques from SentinelOne threat or alert payload."""
    tactics: list[str] = []
    techniques: list[str] = []

    def _add_tactic(name: str) -> None:
        if name and name not in tactics:
            tactics.append(name)

    def _add_technique(name: str) -> None:
        if name and name not in techniques:
            techniques.append(name)

    for key in ("mitreTactics", "mitre_tactics", "tactics"):
        value = data.get(key)
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _add_tactic(str(item.get("name") or item.get("title") or ""))
                    for tech in item.get("techniques", []) or []:
                        if isinstance(tech, dict):
                            _add_technique(str(tech.get("name") or tech.get("title") or ""))
                        else:
                            _add_technique(str(tech))
                elif item:
                    _add_tactic(str(item))

    for key in ("mitreTechniques", "mitre_techniques", "techniques"):
        value = data.get(key)
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _add_technique(str(item.get("name") or item.get("title") or ""))
                elif item:
                    _add_technique(str(item))

    indicators = data.get("indicators")
    if isinstance(indicators, list):
        for indicator in indicators:
            if not isinstance(indicator, dict):
                continue
            for tactic in indicator.get("tactics", []) or []:
                if isinstance(tactic, dict):
                    _add_tactic(str(tactic.get("name") or ""))
                    for tech in tactic.get("techniques", []) or []:
                        if isinstance(tech, dict):
                            _add_technique(str(tech.get("name") or ""))
                        else:
                            _add_technique(str(tech))
                elif tactic:
                    _add_tactic(str(tactic))

    for nested_key in ("threatInfo", "alertInfo", "indicators"):
        nested = data.get(nested_key)
        if isinstance(nested, dict):
            nt, nk = extract_mitre_from_raw(nested)
            for t in nt:
                _add_tactic(t)
            for t in nk:
                _add_technique(t)

    classification = (
        data.get("classification")
        or (data.get("threatInfo") or {}).get("classification")
        or (data.get("alertInfo") or {}).get("classification")
    )
    if not tactics and classification:
        ft, fk = infer_mitre_from_classification(str(classification))
        tactics.extend(ft)
        techniques.extend(fk)

    return tactics, techniques


# Map SentinelOne threat classifications to dashboard severity tiers
_TIER_CRITICAL = frozenset({
    "CRITICAL", "RANSOMWARE", "ROOTKIT", "BACKDOOR", "CREDENTIAL_THEFT", "APT",
})
_TIER_HIGH = frozenset({
    "HIGH", "MALWARE", "TROJAN", "VIRUS", "WORM", "EXPLOIT", "CRYPTOMINER",
    "CRYPTOMINING", "SPYWARE", "ADWARE",
})
_TIER_MEDIUM = frozenset({
    "MEDIUM", "GENERAL", "SUSPICIOUS", "NETWORK", "PHISHING", "HACKTOOL",
    "PUP", "PUA", "LATERAL_MOVEMENT", "DOWNLOADER", "UNKNOWN",
})
_TIER_LOW = frozenset({
    "LOW", "BENIGN", "INFO", "GENERIC", "UNCHECKED",
})


def classification_to_tier(value: str) -> str:
    """Map stored severity/classification to CRITICAL/HIGH/MEDIUM/LOW for dashboards."""
    key = normalize_classification(value)
    if key in _TIER_CRITICAL:
        return "CRITICAL"
    if key in _TIER_HIGH:
        return "HIGH"
    if key in _TIER_MEDIUM:
        return "MEDIUM"
    if key in _TIER_LOW:
        return "LOW"
    upper = key.upper()
    if any(token in upper for token in ("RANSOM", "ROOTKIT", "BACKDOOR", "CRITICAL")):
        return "CRITICAL"
    if any(token in upper for token in ("MALWARE", "TROJAN", "VIRUS", "CRYPTO", "EXPLOIT")):
        return "HIGH"
    if any(token in upper for token in ("BENIGN", "INFO", "LOW")):
        return "LOW"
    return "MEDIUM"


def generate_incident_number() -> str:
    now = datetime.now(timezone.utc)
    return f"INC-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
