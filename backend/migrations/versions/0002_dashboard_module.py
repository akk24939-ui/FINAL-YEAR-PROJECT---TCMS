"""Consumer Module — additive migration for Dashboard module.

Adds:
  1. consumer_limits table (dedicated limit storage, separate from restrictions)
  2. consumers table — new columns: blood_group, emergency_contact_name,
                                    emergency_contact_phone
  3. purchases table  — new columns: shop_name, standard_drinks,
                                     remaining_daily_limit, remaining_weekly_limit
                      — makes shop_id nullable (consumer purchases before shop module)

Does NOT drop or alter existing columns — safe to run against a live DB.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. consumer_limits (new table) ────────────────────────────────────────
    op.create_table(
        "consumer_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "consumer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("consumers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Limits in standard drinks — 0.0 means "no limit set yet"
        sa.Column(
            "daily_limit_sd", sa.Float, nullable=False, server_default="0"
        ),
        sa.Column(
            "weekly_limit_sd", sa.Float, nullable=False, server_default="0"
        ),
        sa.Column(
            "monthly_limit_sd", sa.Float, nullable=False, server_default="0"
        ),
        # Beverage preference — JSON array e.g. ["BEER", "WINE"]
        sa.Column(
            "beverage_preference",
            postgresql.JSONB,
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_consumer_limits_consumer_id",
        "consumer_limits",
        ["consumer_id"],
        unique=True,
    )

    # ── 2. consumers — new profile columns ────────────────────────────────────
    op.add_column(
        "consumers",
        sa.Column("blood_group", sa.String(10), nullable=True),
    )
    op.add_column(
        "consumers",
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
    )
    op.add_column(
        "consumers",
        sa.Column("emergency_contact_phone", sa.String(15), nullable=True),
    )

    # ── 3. purchases — new tracking columns (only if table exists) ────────────
    # The purchases table is created by the Shop Operator module migration.
    # These columns are added here if that table already exists; otherwise
    # they will be added by the operator module migration which includes them.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "purchases" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("purchases")]
        if "shop_name" not in existing_cols:
            op.add_column("purchases", sa.Column("shop_name", sa.String(200), nullable=True))
        if "standard_drinks" not in existing_cols:
            op.add_column("purchases", sa.Column("standard_drinks", sa.Float, nullable=True))
        if "remaining_daily_limit" not in existing_cols:
            op.add_column("purchases", sa.Column("remaining_daily_limit", sa.Float, nullable=True))
        if "remaining_weekly_limit" not in existing_cols:
            op.add_column("purchases", sa.Column("remaining_weekly_limit", sa.Float, nullable=True))


def downgrade() -> None:
    # Reverse in dependency order

    # purchases
    op.alter_column(
        "purchases",
        "shop_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.drop_column("purchases", "remaining_weekly_limit")
    op.drop_column("purchases", "remaining_daily_limit")
    op.drop_column("purchases", "standard_drinks")
    op.drop_column("purchases", "shop_name")

    # consumers
    op.drop_column("consumers", "emergency_contact_phone")
    op.drop_column("consumers", "emergency_contact_name")
    op.drop_column("consumers", "blood_group")

    # consumer_limits
    op.drop_index("ix_consumer_limits_consumer_id", table_name="consumer_limits")
    op.drop_table("consumer_limits")
