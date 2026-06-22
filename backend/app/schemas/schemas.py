from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=2048)


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    role: str = Field(default="SOC_ANALYST", pattern="^(SOC_ADMIN|SOC_MANAGER|SOC_ANALYST|VIEWER)$")


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime


class AlertBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str
    status: str = "NEW"
    hostname: Optional[str] = None
    username: Optional[str] = None
    site_name: Optional[str] = None
    agent_id: Optional[str] = None
    mitre_tactics: list[str] = []
    mitre_techniques: list[str] = []


class AlertCreate(AlertBase):
    sentinel_alert_id: str


class AlertUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(NEW|OPEN|INVESTIGATING|ESCALATED|CONTAINED|FALSE_POSITIVE|CLOSED)$")
    assigned_analyst_id: Optional[UUID] = None
    notes: Optional[str] = Field(None, max_length=5000)
    severity: Optional[str] = Field(None, max_length=50)


class AlertResponse(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sentinel_alert_id: str
    assigned_analyst_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AlertBulkAction(BaseModel):
    alert_ids: list[UUID]
    action: str
    value: Optional[str] = None
    analyst_id: Optional[UUID] = None


class EndpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    os_name: Optional[str] = None
    os_version: Optional[str] = None
    last_seen: Optional[datetime] = None
    health_status: Optional[str] = None
    is_online: bool
    group_name: Optional[str] = None
    site_name: Optional[str] = None
    raw_data: Optional[dict[str, Any]] = None


class SecurityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sentinel_event_id: str
    event_type: str
    category: str
    title: str
    description: Optional[str] = None
    hostname: Optional[str] = None
    agent_id: Optional[str] = None
    user_name: Optional[str] = None
    site_name: Optional[str] = None
    severity: str
    event_at: datetime
    raw_data: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class SyncResponse(BaseModel):
    status: str
    counts: dict[str, int]


class IncidentBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str
    status: str = "OPEN"


class IncidentCreate(IncidentBase):
    alert_ids: list[UUID] = []
    assigned_analyst: Optional[UUID] = None


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    assigned_analyst: Optional[UUID] = None
    notes: Optional[str] = None


class IncidentTimelineEntry(BaseModel):
    action: str
    user_id: Optional[UUID] = None
    details: Optional[str] = None
    timestamp: datetime


class EvidenceAttachment(BaseModel):
    filename: str
    content_type: str
    data: str
    uploaded_by: Optional[UUID] = None


class IncidentResponse(IncidentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    incident_number: str
    assigned_analyst: Optional[UUID] = None
    alert_ids: list[str] = []
    evidence: list[dict[str, Any]] = []
    timeline: list[dict[str, Any]] = []
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID] = None
    action: str
    resource: str
    details: Optional[dict[str, Any]] = None
    timestamp: datetime


class DashboardSummary(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    open_incidents: int = 0
    online_agents: int = 0
    offline_agents: int = 0
    total_alerts: int = 0
    new_alerts: int = 0


class ThreatFeedItem(BaseModel):
    id: UUID
    title: str
    severity: str
    hostname: Optional[str] = None
    created_at: datetime


class HeatmapCell(BaseModel):
    tactic: str
    technique: str
    count: int


class TimelinePoint(BaseModel):
    hour: str
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class TopAsset(BaseModel):
    hostname: str
    alert_count: int
    severity_max: str


class EnrichmentRequest(BaseModel):
    ioc_type: str = Field(pattern="^(ip|hash|domain)$")
    ioc_value: str


class EnrichmentResponse(BaseModel):
    ioc_type: str
    ioc_value: str
    providers: dict[str, Any]
    cached: bool = False


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int
