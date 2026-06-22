"""Add system settings and RDP event fields

Revision ID: 003
Revises: 002
Create Date: 2026-06-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.add_column("security_events", sa.Column("source_ip", sa.String(45), nullable=True))
    op.add_column("security_events", sa.Column("dest_host", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("security_events", "dest_host")
    op.drop_column("security_events", "source_ip")
    op.drop_table("system_settings")
