"""Caretaker router — consent-gated consumer status view."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import Consent, Consumer, Restriction, User
from app.services.audit_service import AuditService

router = APIRouter(prefix="/caretaker", tags=["caretaker"])


@router.get("/consumer/{consumer_id}/status")
async def consumer_status(
    consumer_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("caretaker")),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns limited consumer status ONLY if an active consent exists.
    Security: consent check is enforced at DB layer — no frontend flag trusted.
    """
    # Verify active consent
    consent_result = await db.execute(
        select(Consent).where(
            Consent.consumer_id == consumer_id,
            Consent.caretaker_user_id == current_user.id,
            Consent.revoked_at == None,  # noqa
        )
    )
    consent = consent_result.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=403, detail="No active consent for this consumer")

    # Return minimal status — no purchase details
    consumer_result = await db.execute(select(Consumer).where(Consumer.id == consumer_id))
    consumer = consumer_result.scalar_one_or_none()
    if not consumer:
        raise HTTPException(status_code=404, detail="Consumer not found")

    restriction_result = await db.execute(
        select(Restriction).where(Restriction.consumer_id == consumer_id)
        .order_by(Restriction.effective_from.desc()).limit(1)
    )
    restriction = restriction_result.scalar_one_or_none()

    await AuditService(request.client.host).log(
        db, actor_user_id=current_user.id,
        action="READ", target_table="consumers", target_id=consumer_id
    )

    return {
        "consumer_id": consumer_id,
        "district": consumer.district,
        "teetotaler_flag": consumer.teetotaler_flag,
        "self_restricted": restriction.self_restricted if restriction else False,
        "consent_scope": consent.scope,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }
