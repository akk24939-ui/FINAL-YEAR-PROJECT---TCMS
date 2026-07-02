"""Consumer Module — initial migration.

Creates:
  - roles
  - user_roles
  - users         (full column set including OTP / lockout / refresh-token)
  - consumers     (ConsumerProfile with Fernet-encrypted Aadhaar)
  - restrictions  (SelfRestriction with cooling-off fields)
  - notifications
  - qr_codes
  - audit_logs    (append-only, JSONB metadata)

Also seeds the 5 canonical role rows.

Revision ID: a1b2c3d4e5f6
Revises: (none — first migration)
Create Date: 2025-06-30 05:30:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. roles ──────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)

    # Seed the 5 canonical roles
    op.execute(
        """
        INSERT INTO roles (id, name, description) VALUES
          (gen_random_uuid(), 'CONSUMER',  'Retail alcohol consumer who tracks purchase limits'),
          (gen_random_uuid(), 'OPERATOR',  'TASMAC shop operator who records sales'),
          (gen_random_uuid(), 'ADMIN',     'Government administrator with district analytics access'),
          (gen_random_uuid(), 'DOCTOR',    'Medical professional with anonymised health data access'),
          (gen_random_uuid(), 'CARETAKER', 'Consented caretaker who monitors a linked consumer')
        ON CONFLICT DO NOTHING;
        """
    )

    # ── 2. users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("mobile_number", sa.String(15), nullable=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "CONSUMER", "OPERATOR", "ADMIN", "DOCTOR", "CARETAKER",
                name="userrole",
            ),
            nullable=False,
            server_default="CONSUMER",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        # OTP fields
        sa.Column("otp_hash", sa.String(255), nullable=True),
        sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("otp_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("otp_used", sa.Boolean, nullable=False, server_default="false"),
        # Lockout
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "failed_login_attempts", sa.Integer, nullable=False, server_default="0"
        ),
        # Refresh token (hashed)
        sa.Column("refresh_token_hash", sa.String(255), nullable=True),
        # Audit
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_ip", sa.String(45), nullable=True),
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
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_mobile_number", "users", ["mobile_number"], unique=True)

    # ── 3. user_roles ─────────────────────────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"])

    # ── 4. consumers (ConsumerProfile) ────────────────────────────────────────
    op.create_table(
        "consumers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("aadhaar_encrypted", sa.Text, nullable=True),
        sa.Column("dob", sa.Date, nullable=True),
        sa.Column(
            "gender",
            sa.Enum(
                "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY",
                name="gender",
            ),
            nullable=True,
        ),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("photo_path", sa.String(512), nullable=True),
        sa.Column(
            "beverage_preference",
            sa.Enum(
                "BEER", "WINE", "SPIRITS", "MIXED", "NONE",
                name="beveragepreference",
            ),
            nullable=False,
            server_default="NONE",
        ),
        sa.Column(
            "is_teetotaler", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("teetotaler_set_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_consumers_user_id", "consumers", ["user_id"], unique=True)

    # ── 5. restrictions (SelfRestriction) ─────────────────────────────────────
    op.create_table(
        "restrictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "consumer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("consumers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Active limits (standard drinks)
        sa.Column("daily_limit_sd", sa.Float, nullable=False, server_default="2.0"),
        sa.Column("weekly_limit_sd", sa.Float, nullable=False, server_default="14.0"),
        sa.Column("monthly_limit_sd", sa.Float, nullable=False, server_default="56.0"),
        # Pending increase (cooling-off)
        sa.Column("pending_daily_limit_sd", sa.Float, nullable=True),
        sa.Column("pending_weekly_limit_sd", sa.Float, nullable=True),
        sa.Column("pending_monthly_limit_sd", sa.Float, nullable=True),
        sa.Column("lock_requested_at", sa.DateTime(timezone=True), nullable=True),
        # Self-restriction lock
        sa.Column("is_locked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lock_reason", sa.String(500), nullable=True),
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
    op.create_index("ix_restrictions_user_id", "restrictions", ["user_id"], unique=True)
    op.create_index("ix_restrictions_consumer_id", "restrictions", ["consumer_id"], unique=True)

    # ── 6. notifications ──────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "notification_type",
            sa.Enum("INFO", "WARN", "DANGER", "SUCCESS", name="notificationtype"),
            nullable=False,
            server_default="INFO",
        ),
        sa.Column(
            "category",
            sa.Enum(
                "LIMIT_WARNING", "LIMIT_EXCEEDED", "TEETOTALER",
                "SELF_RESTRICTION", "SYSTEM",
                name="notificationcategory",
            ),
            nullable=False,
            server_default="SYSTEM",
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    # ── 7. qr_codes ───────────────────────────────────────────────────────────
    op.create_table(
        "qr_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hmac_payload", sa.Text, nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("requested_from_ip", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_qr_codes_user_id", "qr_codes", ["user_id"])
    op.create_index("ix_qr_codes_expires_at", "qr_codes", ["expires_at"])

    # ── 8. audit_logs ─────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "event_type",
            sa.Enum(
                "consumer_registered", "login_success", "login_failed",
                "otp_sent", "otp_verified", "account_locked", "logout",
                "limit_changed", "limit_increase_requested",
                "limit_increase_confirmed", "teetotaler_enabled",
                "teetotaler_disabled", "self_restriction_locked",
                "self_restriction_unlocked", "qr_generated", "pdf_downloaded",
                "photo_uploaded", "profile_updated", "token_refreshed",
                name="auditeventtype",
            ),
            nullable=False,
        ),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("session_id", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_event_type", "audit_logs", ["event_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    # Drop in reverse FK-dependency order
    op.drop_table("audit_logs")
    op.drop_table("qr_codes")
    op.drop_table("notifications")
    op.drop_table("restrictions")
    op.drop_table("consumers")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("roles")

    # Drop custom enum types
    op.execute("DROP TYPE IF EXISTS auditeventtype")
    op.execute("DROP TYPE IF EXISTS notificationcategory")
    op.execute("DROP TYPE IF EXISTS notificationtype")
    op.execute("DROP TYPE IF EXISTS beveragepreference")
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS userrole")
