"""0003_admin_module — Admin module schema additions.

Adds:
  - users: must_change_password, token_version, pin_hash, pin_failed_attempts,
           pin_locked_until, last_pin_rotation columns
  - system_config table
  - doctor_profiles table
  - shops: operator_name, operator_phone, suspended_at, suspension_reason,
           suspended_by, pin_rotation_due_at columns
  - audit_logs: actor_id column
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── users table additions ──────────────────────────────────────────────────
    existing_user_cols = [c["name"] for c in inspector.get_columns("users")]

    if "must_change_password" not in existing_user_cols:
        op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"))
    if "token_version" not in existing_user_cols:
        op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    if "pin_hash" not in existing_user_cols:
        op.add_column("users", sa.Column("pin_hash", sa.String(255), nullable=True))
    if "pin_failed_attempts" not in existing_user_cols:
        op.add_column("users", sa.Column("pin_failed_attempts", sa.Integer(), nullable=False, server_default="0"))
    if "pin_locked_until" not in existing_user_cols:
        op.add_column("users", sa.Column("pin_locked_until", sa.DateTime(timezone=True), nullable=True))
    if "last_pin_rotation" not in existing_user_cols:
        op.add_column("users", sa.Column("last_pin_rotation", sa.DateTime(timezone=True), nullable=True))

    # ── shops table additions ─────────────────────────────────────────────────
    if "shops" in existing_tables:
        existing_shop_cols = [c["name"] for c in inspector.get_columns("shops")]
        if "operator_name" not in existing_shop_cols:
            op.add_column("shops", sa.Column("operator_name", sa.String(200), nullable=True))
        if "operator_phone" not in existing_shop_cols:
            op.add_column("shops", sa.Column("operator_phone", sa.String(20), nullable=True))
        if "suspended_at" not in existing_shop_cols:
            op.add_column("shops", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
        if "suspension_reason" not in existing_shop_cols:
            op.add_column("shops", sa.Column("suspension_reason", sa.String(500), nullable=True))
        if "suspended_by" not in existing_shop_cols:
            op.add_column("shops", sa.Column("suspended_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
        if "pin_rotation_due_at" not in existing_shop_cols:
            op.add_column("shops", sa.Column("pin_rotation_due_at", sa.DateTime(timezone=True), nullable=True))

    # ── audit_logs table additions ────────────────────────────────────────────
    if "audit_logs" in existing_tables:
        existing_audit_cols = [c["name"] for c in inspector.get_columns("audit_logs")]
        if "actor_id" not in existing_audit_cols:
            op.add_column("audit_logs", sa.Column(
                "actor_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ))
            op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])

    # ── system_config table ───────────────────────────────────────────────────
    if "system_config" not in existing_tables:
        op.create_table(
            "system_config",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("key", sa.String(100), nullable=False, unique=True),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_system_config_key", "system_config", ["key"])

        # Seed default global limits
        op.execute(sa.text("""
            INSERT INTO system_config (id, key, value, description)
            VALUES
              (gen_random_uuid(), 'global_daily_limit_sd',   '4.0',   'Maximum standard drinks per day for all consumers'),
              (gen_random_uuid(), 'global_weekly_limit_sd',  '14.0',  'Maximum standard drinks per week for all consumers'),
              (gen_random_uuid(), 'global_monthly_limit_sd', '40.0',  'Maximum standard drinks per month for all consumers')
        """))

    # ── doctor_profiles table ─────────────────────────────────────────────────
    if "doctor_profiles" not in existing_tables:
        op.create_table(
            "doctor_profiles",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("medical_reg_number", sa.String(50), nullable=False, unique=True),
            sa.Column("specialization", sa.String(200), nullable=True),
            sa.Column("contact_phone", sa.String(20), nullable=True),
            sa.Column("hospital_name", sa.String(200), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("activated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deactivation_reason", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_doctor_profiles_user_id", "doctor_profiles", ["user_id"])


def downgrade() -> None:
    op.drop_table("doctor_profiles")
    op.drop_table("system_config")
    for col in ["actor_id"]:
        op.drop_column("audit_logs", col)
    for col in ["operator_name", "operator_phone", "suspended_at", "suspension_reason", "suspended_by", "pin_rotation_due_at"]:
        op.drop_column("shops", col)
    for col in ["must_change_password", "token_version", "pin_hash", "pin_failed_attempts", "pin_locked_until", "last_pin_rotation"]:
        op.drop_column("users", col)
