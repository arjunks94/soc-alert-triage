import pytest

from app.utils.helpers import generate_incident_number, normalize_severity


def test_normalize_severity():
    assert normalize_severity("critical") == "CRITICAL"
    assert normalize_severity("HIGH") == "HIGH"
    assert normalize_severity("info") == "LOW"


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
