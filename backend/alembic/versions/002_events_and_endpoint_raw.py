"""Add security events and endpoint raw_data

Revision ID: 002
Revises: 001
Create Date: 2026-06-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("endpoints", sa.Column("raw_data", postgresql.JSONB(), nullable=True))

    op.create_table(
        "security_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sentinel_event_id", sa.String(255), nullable=False, unique=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, server_default="activity"),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("hostname", sa.String(255)),
        sa.Column("agent_id", sa.String(255)),
        sa.Column("user_name", sa.String(255)),
        sa.Column("site_name", sa.String(255)),
        sa.Column("severity", sa.String(50), nullable=False, server_default="INFO"),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_data", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_security_events_event_type", "security_events", ["event_type"])
    op.create_index("ix_security_events_category", "security_events", ["category"])
    op.create_index("ix_security_events_event_at", "security_events", ["event_at"])
    op.create_index("ix_security_events_agent_id", "security_events", ["agent_id"])
    op.create_index("ix_security_events_severity", "security_events", ["severity"])


def downgrade() -> None:
    op.drop_table("security_events")
    op.drop_column("endpoints", "raw_data")
