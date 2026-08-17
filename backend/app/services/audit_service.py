"""
Audit service: writes to audit_logs table (append-only).
Security Notes:
  - PII is never logged — only actor_id, action, table name, row ID, and IP.
  - Service is injected as a dependency so every endpoint can call it uniformly.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog


class AuditService:
    def __init__(self, ip_address: str | None = None):
        self.ip_address = ip_address

    async def log(
        self,
        db: AsyncSession,
        *,
        actor_user_id: uuid.UUID | None,
        action: str,
        target_table: str,
        target_id: uuid.UUID | None = None,
    ) -> None:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target_table=target_table,
            target_id=target_id,
            ip_address=self.ip_address,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(entry)
        # flush only — caller's session.commit() persists it
        await db.flush()
