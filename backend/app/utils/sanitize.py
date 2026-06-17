import re
from typing import Optional

MAX_SEARCH_LENGTH = 200
MAX_TEXT_LENGTH = 2000
MAX_NOTES_LENGTH = 5000

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HTML_TAG = re.compile(r"<[^>]+>")


def sanitize_search(value: Optional[str], max_length: int = MAX_SEARCH_LENGTH) -> Optional[str]:
    """Strip control characters and limit length for search/filter inputs."""
    if value is None:
        return None
    cleaned = _CONTROL_CHARS.sub("", value.strip())
    cleaned = _HTML_TAG.sub("", cleaned)
    cleaned = cleaned[:max_length]
    return cleaned if cleaned else None


def sanitize_text(value: Optional[str], max_length: int = MAX_TEXT_LENGTH) -> Optional[str]:
    """Sanitize free-text fields (notes, descriptions)."""
    if value is None:
        return None
    cleaned = _CONTROL_CHARS.sub("", value.strip())
    cleaned = cleaned[:max_length]
    return cleaned if cleaned else None
