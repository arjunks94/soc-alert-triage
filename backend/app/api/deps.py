from typing import Annotated, Optional

from fastapi import Query

from app.utils.sanitize import sanitize_search

SearchParam = Annotated[Optional[str], Query(max_length=200)]
SiteParam = Annotated[Optional[str], Query(max_length=200)]
GroupParam = Annotated[Optional[str], Query(max_length=200)]
OsParam = Annotated[Optional[str], Query(max_length=100)]
IpParam = Annotated[Optional[str], Query(max_length=45)]
HostnameParam = Annotated[Optional[str], Query(max_length=255)]


def clean_search(value: Optional[str]) -> Optional[str]:
    return sanitize_search(value)


def clean_filter(value: Optional[str]) -> Optional[str]:
    return sanitize_search(value, max_length=255)
