"""0004 — Operator Module: add new shop columns.

Adds columns to `shops` that were introduced in the Admin Module shop management
but missed from migration 0003. Also ensures system_config table is present.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = 'c4d5e6f7a8b9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def _col_exists(table: str, column: str) -> bool:
    """Check if a column already exists (idempotent helper)."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
    ), {"t": table})
    return result.fetchone() is not None


def upgrade() -> None:
    # ── shops table ──────────────────────────────────────────────────────────
    if not _table_exists("shops"):
        op.create_table(
            "shops",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("shop_code", sa.String(50), nullable=False, unique=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("address", sa.Text, nullable=False),
            sa.Column("district", sa.String(100), nullable=False),
            sa.Column("license_number", sa.String(100), nullable=True),
            sa.Column("operator_name", sa.String(200), nullable=True),
            sa.Column("operator_phone", sa.String(20), nullable=True),
            sa.Column("operator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("is_active", sa.Boolean, default=True),
            sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("suspension_reason", sa.String(500), nullable=True),
            sa.Column("suspended_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("pin_rotation_due_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_shops_shop_code", "shops", ["shop_code"], unique=True)
        op.create_index("ix_shops_district", "shops", ["district"])
    else:
        # Add columns only if they don't already exist
        new_cols = [
            ("operator_name", sa.String(200), True),
            ("operator_phone", sa.String(20), True),
            ("suspended_at", sa.DateTime(timezone=True), True),
            ("suspension_reason", sa.String(500), True),
            ("pin_rotation_due_at", sa.DateTime(timezone=True), True),
        ]
        for col_name, col_type, nullable in new_cols:
            if not _col_exists("shops", col_name):
                op.add_column("shops", sa.Column(col_name, col_type, nullable=nullable))

        if not _col_exists("shops", "suspended_by"):
            op.add_column("shops", sa.Column(
                "suspended_by",
                UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True
            ))

    # ── system_config ─────────────────────────────────────────────────────────
    if not _table_exists("system_config"):
        op.create_table(
            "system_config",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("key", sa.String(100), nullable=False),
            sa.Column("value", sa.Text, nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_system_config_key", "system_config", ["key"], unique=True)

    # ── users — new operator fields ───────────────────────────────────────────
    operator_cols = [
        ("must_change_password", sa.Boolean, False, False),
        ("token_version", sa.Integer, False, 0),
        ("pin_hash", sa.String(255), True, None),
        ("pin_failed_attempts", sa.Integer, False, 0),
        ("pin_locked_until", sa.DateTime(timezone=True), True, None),
        ("last_pin_rotation", sa.DateTime(timezone=True), True, None),
        ("otp_hash", sa.String(255), True, None),
        ("otp_expires_at", sa.DateTime(timezone=True), True, None),
        ("otp_attempts", sa.Integer, False, 0),
        ("otp_used", sa.Boolean, False, False),
        ("locked_until", sa.DateTime(timezone=True), True, None),
        ("failed_login_attempts", sa.Integer, False, 0),
        ("refresh_token_hash", sa.String(255), True, None),
        ("last_login_at", sa.DateTime(timezone=True), True, None),
        ("last_login_ip", sa.String(45), True, None),
    ]
    for col_name, col_type, nullable, server_default in operator_cols:
        if not _col_exists("users", col_name):
            if server_default is not None:
                op.add_column("users", sa.Column(col_name, col_type, nullable=nullable, server_default=str(server_default)))
            else:
                op.add_column("users", sa.Column(col_name, col_type, nullable=nullable))

    # ── doctor_profiles ───────────────────────────────────────────────────────
    if _table_exists("doctor_profiles"):
        doctor_cols = [
            ("hospital_name", sa.String(200), True),
            ("contact_phone", sa.String(20), True),
            ("is_active", sa.Boolean, False),
            ("activated_at", sa.DateTime(timezone=True), True),
            ("deactivated_at", sa.DateTime(timezone=True), True),
            ("deactivation_reason", sa.Text, True),
        ]
        for col_name, col_type, nullable in doctor_cols:
            if not _col_exists("doctor_profiles", col_name):
                op.add_column("doctor_profiles", sa.Column(col_name, col_type, nullable=nullable))


def downgrade() -> None:
    # Minimal downgrade — do not drop tables (could lose data)
    pass
