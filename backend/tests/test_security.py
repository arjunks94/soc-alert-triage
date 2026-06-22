import pytest

from app.utils.helpers import classification_to_tier, generate_incident_number, normalize_severity


def test_normalize_severity():
    assert normalize_severity("critical") == "CRITICAL"
    assert normalize_severity("HIGH") == "HIGH"
    assert normalize_severity("info") == "INFO"
    assert normalize_severity("Malware") == "MALWARE"
    assert normalize_severity("Ransomware") == "RANSOMWARE"


def test_classification_to_tier():
    assert classification_to_tier("MALWARE") == "HIGH"
    assert classification_to_tier("RANSOMWARE") == "CRITICAL"
    assert classification_to_tier("BENIGN") == "LOW"
    assert classification_to_tier("GENERAL") == "MEDIUM"
    assert classification_to_tier("CRITICAL") == "CRITICAL"


def test_generate_incident_number():
    number = generate_incident_number()
    assert number.startswith("INC-")
    assert len(number) > 10


@pytest.mark.asyncio
async def test_password_hash():
    from app.core.security import get_password_hash, verify_password

    hashed = get_password_hash("testpassword123")
    assert verify_password("testpassword123", hashed)
    assert not verify_password("wrong", hashed)
