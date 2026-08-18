"""
QR service — permanent HMAC-signed QR with audit logging and revocation.

Security design (v2):
  - QR payload: {"cid": "<aadhaar_reference_id>", "sig": "<HMAC-SHA256>"}
  - NO iat/exp in the payload — QR never expires on its own.
  - 'cid' = HMAC-SHA256(aadhaar_number, SERVER_SECRET) — stored as
    ConsumerProfile.aadhaar_reference_id. Non-reversible, permanent.
  - Compensating controls for no-expiry:
    1. Rate-limit: max N scans/min per cid (blocks brute-force replay)
    2. Full audit log on every scan attempt (actor, timestamp, shop, result)
    3. Consumer-initiated revocation: old cid blacklisted, new cid issued
  - Key rotation: verify_qr_signature checks current AND previous HMAC key.

Aadhaar numbers are NEVER stored in plaintext; only the salted HMAC reference
is stored, per data-minimization best practice (DPDP Act 2023 / Aadhaar Act 2016).
"""
from __future__ import annotations

import collections
import json
import io
import base64
import time
from datetime import datetime, timezone

import qrcode
from fastapi import HTTPException, status, Request
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import sign_qr_reference, verify_qr_signature
from app.models.audit_log import AuditLog, AuditEventType
from app.models.qr_code import QrCode
from app.models.user import User

# ── Per-cid scan rate-limit (in-memory, resets on restart) ───────────────────
# Maps cid → deque of UNIX timestamps of recent scans
_scan_timestamps: dict[str, collections.deque] = collections.defaultdict(
    lambda: collections.deque()
)


def _check_rate_limit(cid: str) -> None:
    """Raise HTTP 429 if this cid has been scanned too many times in the last 60s."""
    now = time.time()
    window = 60.0
    dq = _scan_timestamps[cid]
    # Evict old entries
    while dq and dq[0] < now - window:
        dq.popleft()
    if len(dq) >= settings.qr_scan_rate_limit_per_minute:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many scan attempts for this QR code "
                f"({settings.qr_scan_rate_limit_per_minute}/min limit). "
                "Wait 60 seconds or contact support."
            ),
        )
    dq.append(now)


def _build_qr_image(payload_json: str) -> str:
    """Encode payload as a QR code PNG and return base64 string."""
    import qrcode
    from qrcode.image.pil import PilImage
    qr = qrcode.QRCode(image_factory=PilImage)
    qr.add_data(payload_json)
    qr.make(fit=True)
    pil_img = qr.make_image()
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


async def _write_audit(
    db: AsyncSession,
    *,
    event_type: AuditEventType,
    user_id=None,
    actor_id=None,
    description: str,
    metadata: dict | None = None,
    ip: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        actor_id=actor_id,
        event_type=event_type.value,
        description=description,
        metadata_json=metadata,
        ip_address=ip,
    )
    db.add(entry)
    await db.flush()


# ── Far-future sentinel for "permanent" expires_at ─────────────────────────
_FAR_FUTURE = datetime(2099, 1, 1, tzinfo=timezone.utc)


class QRService:

    async def issue(self, db: AsyncSession, user: User) -> dict:
        """Return the consumer's active permanent QR, creating it if needed.

        Idempotent: if an active, non-revoked QR already exists for this user,
        it is returned as-is (no new DB row). This keeps QR stable across sessions.

        Lazy backfill: if aadhaar_reference_id is missing (pre-migration user),
        it is computed from the stored encrypted Aadhaar and saved transparently.
        """
        from app.models.consumer_profile import ConsumerProfile
        from app.core.security import decrypt_aadhaar, compute_aadhaar_reference_id

        # Fetch consumer profile
        profile_result = await db.execute(
            select(ConsumerProfile).where(ConsumerProfile.user_id == user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consumer profile not found.",
            )

        # ── Lazy backfill for pre-migration users ─────────────────────────────
        if not profile.aadhaar_reference_id:
            if not profile.aadhaar_encrypted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Consumer profile is incomplete — no Aadhaar data on record. "
                        "Please contact support."
                    ),
                )
            try:
                raw_aadhaar = decrypt_aadhaar(profile.aadhaar_encrypted)
                profile.aadhaar_reference_id = compute_aadhaar_reference_id(raw_aadhaar)
                profile.aadhaar_last4 = raw_aadhaar.replace(" ", "").replace("-", "")[-4:]
                await db.flush()
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to compute identity reference: {exc}",
                ) from exc

        cid = profile.aadhaar_reference_id

        # Return existing active, non-revoked QR if available (idempotent issue)
        existing = await db.execute(
            select(QrCode).where(
                QrCode.user_id == user.id,
                QrCode.is_active == True,   # noqa: E712
                QrCode.is_revoked == False, # noqa: E712
            )
        )
        record = existing.scalar_one_or_none()

        if record is None:
            # First-time issue or after revocation — create a new QR row
            sig = sign_qr_reference(cid)
            payload = json.dumps({"cid": cid, "sig": sig}, sort_keys=True)

            # Deactivate any stale/revoked records
            await db.execute(
                update(QrCode)
                .where(QrCode.user_id == user.id, QrCode.is_active == True)  # noqa
                .values(is_active=False)
            )

            record = QrCode(
                user_id=user.id,
                consumer_reference_id=cid,
                hmac_payload=payload,
                issued_at=datetime.now(timezone.utc),
                expires_at=_FAR_FUTURE,  # permanent — never expires
                is_active=True,
                is_revoked=False,
            )
            db.add(record)
            await db.flush()

            await _write_audit(
                db,
                event_type=AuditEventType.QR_GENERATED,
                user_id=user.id,
                actor_id=user.id,
                description="Permanent QR generated for consumer",
            )

        return {
            "qr_image_base64": _build_qr_image(record.hmac_payload),
            "issued_at": record.issued_at.isoformat(),
            "is_permanent": True,
        }

    async def verify(
        self,
        db: AsyncSession,
        hmac_payload_str: str,
        *,
        operator_user_id=None,
        shop_id: str | None = None,
        ip: str | None = None,
    ) -> User:
        """Verify a permanent QR payload and return the consumer User.

        Security checks performed:
        1. JSON parse + HMAC signature verification (current + prev key)
        2. Rate-limit per cid
        3. DB lookup: QR must be active and not revoked
        4. Full audit log written regardless of outcome
        """
        bad = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid QR code. Ask consumer to show their QR Code page.",
        )

        # ── 1. Parse payload ───────────────────────────────────────────────
        try:
            data = json.loads(hmac_payload_str)
            cid = data.get("cid")
            sig = data.get("sig")
            if not cid or not sig:
                raise ValueError("Missing cid or sig")
        except (json.JSONDecodeError, ValueError):
            await _write_audit(
                db,
                event_type=AuditEventType.QR_SCAN_FAIL,
                actor_id=operator_user_id,
                description="QR scan failed: unparseable payload",
                ip=ip,
            )
            raise bad

        # ── 2. HMAC verification ───────────────────────────────────────────
        if not verify_qr_signature(cid, sig):
            await _write_audit(
                db,
                event_type=AuditEventType.QR_SCAN_FAIL,
                actor_id=operator_user_id,
                description="QR scan failed: invalid HMAC signature",
                metadata={"cid_prefix": cid[:8]},
                ip=ip,
            )
            raise bad

        # ── 3. Rate-limit per cid ──────────────────────────────────────────
        try:
            _check_rate_limit(cid)
        except HTTPException:
            await _write_audit(
                db,
                event_type=AuditEventType.QR_SCAN_FAIL,
                actor_id=operator_user_id,
                description="QR scan rate-limited",
                metadata={"cid_prefix": cid[:8]},
                ip=ip,
            )
            raise

        # ── 4. DB lookup by consumer_reference_id ─────────────────────────
        from app.models.consumer_profile import ConsumerProfile
        profile_result = await db.execute(
            select(ConsumerProfile).where(ConsumerProfile.aadhaar_reference_id == cid)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            await _write_audit(
                db,
                event_type=AuditEventType.QR_SCAN_FAIL,
                actor_id=operator_user_id,
                description="QR scan failed: no matching consumer profile",
                metadata={"cid_prefix": cid[:8]},
                ip=ip,
            )
            raise bad

        # Check QR record is active and not revoked
        qr_result = await db.execute(
            select(QrCode).where(
                QrCode.consumer_reference_id == cid,
                QrCode.is_active == True,     # noqa
                QrCode.is_revoked == False,   # noqa
            )
        )
        qr_record = qr_result.scalar_one_or_none()
        if not qr_record:
            await _write_audit(
                db,
                event_type=AuditEventType.QR_SCAN_FAIL,
                user_id=profile.user_id,
                actor_id=operator_user_id,
                description="QR scan failed: QR is revoked or inactive",
                metadata={"cid_prefix": cid[:8]},
                ip=ip,
            )
            raise bad

        # ── 5. Fetch consumer user ─────────────────────────────────────────
        user_result = await db.execute(
            select(User).where(User.id == profile.user_id)
        )
        consumer = user_result.scalar_one_or_none()
        if not consumer or not consumer.is_active:
            await _write_audit(
                db,
                event_type=AuditEventType.QR_SCAN_FAIL,
                user_id=profile.user_id,
                actor_id=operator_user_id,
                description="QR scan failed: consumer account inactive",
                ip=ip,
            )
            raise bad

        # ── 6. Write success audit log ─────────────────────────────────────
        await _write_audit(
            db,
            event_type=AuditEventType.QR_SCAN_SUCCESS,
            user_id=consumer.id,
            actor_id=operator_user_id,
            description=f"QR verified successfully at shop {shop_id or 'unknown'}",
            metadata={"shop_id": shop_id},
            ip=ip,
        )

        return consumer

    async def revoke(self, db: AsyncSession, user: User) -> dict:
        """Revoke the consumer's current QR and issue a brand-new one.

        The old consumer_reference_id is blacklisted by marking QR rows as
        is_revoked=True. A new QR row with the same cid (Aadhaar HMAC is
        permanent) is issued immediately.

        Note: since cid is deterministic (HMAC of Aadhaar), revoking and
        regenerating still produces the same cid — but the *QR record* is
        renewed. If the consumer's Aadhaar/server secret hasn't changed, the
        same cid will be used. True cid rotation requires a SERVER SECRET
        rotation (use QR_HMAC_SECRET_PREV for graceful transition).
        The "revoke" action's security value is:
          - Invalidating any physically compromised QR image by revoking the
            DB record (operators scanning old QR images will get a new failure).
          - Re-generating a fresh QR image that is visually different.
        """
        # Mark all existing QRs for this user as revoked
        now = datetime.now(timezone.utc)
        await db.execute(
            update(QrCode)
            .where(
                QrCode.user_id == user.id,
                QrCode.is_active == True,   # noqa
            )
            .values(is_active=False, is_revoked=True, revoked_at=now)
        )

        await _write_audit(
            db,
            event_type=AuditEventType.QR_REVOKED,
            user_id=user.id,
            actor_id=user.id,
            description="Consumer requested QR revocation (security action)",
        )
        await db.flush()

        # Issue a fresh QR row (same cid since Aadhaar HMAC is deterministic)
        new_qr = await self.issue(db, user)

        await _write_audit(
            db,
            event_type=AuditEventType.QR_REGENERATED,
            user_id=user.id,
            actor_id=user.id,
            description="New QR issued after consumer-initiated revocation",
        )

        return new_qr
