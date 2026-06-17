"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sentinel_alert_id", sa.String(255), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("severity", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("hostname", sa.String(255)),
        sa.Column("username", sa.String(255)),
        sa.Column("site_name", sa.String(255)),
        sa.Column("agent_id", sa.String(255)),
        sa.Column("mitre_tactics", postgresql.JSONB()),
        sa.Column("mitre_techniques", postgresql.JSONB()),
        sa.Column("assigned_analyst_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("notes", sa.Text()),
        sa.Column("raw_data", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])

    op.create_table(
        "endpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", sa.String(255), nullable=False, unique=True),
        sa.Column("hostname", sa.String(255)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("os_name", sa.String(100)),
        sa.Column("os_version", sa.String(100)),
        sa.Column("last_seen", sa.DateTime(timezone=True)),
        sa.Column("health_status", sa.String(50)),
        sa.Column("is_online", sa.Boolean()),
        sa.Column("group_name", sa.String(255)),
        sa.Column("site_name", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("incident_number", sa.String(50), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("severity", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("assigned_analyst", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("alert_ids", postgresql.JSONB()),
        sa.Column("evidence", postgresql.JSONB()),
        sa.Column("timeline", postgresql.JSONB()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource", sa.String(255), nullable=False),
        sa.Column("details", postgresql.JSONB()),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("timestamp", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "enrichment_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ioc_type", sa.String(50), nullable=False),
        sa.Column("ioc_value", sa.String(512), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("enrichment_cache")
    op.drop_table("audit_logs")
    op.drop_table("incidents")
    op.drop_table("endpoints")
    op.drop_table("alerts")
    op.drop_table("users")
