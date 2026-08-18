"""
Migration: Permanent QR & Aadhaar Reference ID

This script adds new columns for the v2 permanent QR system:

  consumers table:
    - aadhaar_reference_id VARCHAR(64) UNIQUE  — HMAC-SHA256 of Aadhaar (permanent cid)
    - aadhaar_last4        VARCHAR(4)          — last 4 digits for display only

  qr_codes table:
    - consumer_reference_id VARCHAR(64)        — cid stored in each QR row (indexed)
    - is_revoked            BOOLEAN            — blacklist flag
    - revoked_at            TIMESTAMP WITH TZ  — when was it revoked

  audit_log event_type enum:
    - qr_scan_success
    - qr_scan_fail
    - qr_revoked
    - qr_regenerated

After running schema migration run `backfill_existing_consumers()` to populate
aadhaar_reference_id for existing rows (requires QR_HMAC_SECRET set in .env).

Run:
  cd backend
  python migration_qr_permanent.py
"""
import asyncio
import os
import sys

# ── Ensure project root is on path ──────────────────────────────────────────
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)

from dotenv import load_dotenv
load_dotenv(os.path.join(_here, ".env"))

import asyncpg


async def run_migration() -> None:
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("[ERROR] DATABASE_URL not set in .env"); return

    # asyncpg needs postgresql:// not postgresql+asyncpg://
    dsn_plain = dsn.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to database…")
    conn = await asyncpg.connect(dsn_plain)
    print("Connected. Applying schema changes…\n")

    try:
        # ── 1. consumers: add aadhaar_reference_id ──────────────────────────
        print("[1/6] Adding consumers.aadhaar_reference_id …")
        await conn.execute("""
            ALTER TABLE consumers
            ADD COLUMN IF NOT EXISTS aadhaar_reference_id VARCHAR(64);
        """)
        print("[2/6] Adding UNIQUE index on consumers.aadhaar_reference_id …")
        # Use CREATE UNIQUE INDEX IF NOT EXISTS to avoid errors on re-run
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_consumers_aadhaar_ref
            ON consumers (aadhaar_reference_id)
            WHERE aadhaar_reference_id IS NOT NULL;
        """)

        print("[3/6] Adding consumers.aadhaar_last4 …")
        await conn.execute("""
            ALTER TABLE consumers
            ADD COLUMN IF NOT EXISTS aadhaar_last4 VARCHAR(4);
        """)

        # ── 2. qr_codes: add v2 columns ─────────────────────────────────────
        print("[4/6] Adding qr_codes.consumer_reference_id …")
        await conn.execute("""
            ALTER TABLE qr_codes
            ADD COLUMN IF NOT EXISTS consumer_reference_id VARCHAR(64);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_qr_codes_consumer_ref
            ON qr_codes (consumer_reference_id);
        """)

        print("[5/6] Adding qr_codes.is_revoked / revoked_at …")
        await conn.execute("""
            ALTER TABLE qr_codes
            ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE;
        """)
        await conn.execute("""
            ALTER TABLE qr_codes
            ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
        """)

        # ── 3. audit_log event_type enum: add new values ─────────────────────
        print("[6/6] Adding new audit event_type enum values …")
        for val in ("qr_scan_success", "qr_scan_fail", "qr_revoked", "qr_regenerated"):
            # ALTER TYPE … ADD VALUE is idempotent with IF NOT EXISTS (Postgres 9.6+)
            await conn.execute(f"""
                DO $$ BEGIN
                    ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{val}';
                EXCEPTION WHEN others THEN NULL; END $$;
            """)

        print("\n✅ Schema migration complete.")
        print("\nNow run backfill to populate aadhaar_reference_id for existing consumers:")
        print("  python migration_qr_permanent.py --backfill\n")

        # ── 4. Backfill if requested ─────────────────────────────────────────
        if "--backfill" in sys.argv:
            await backfill_existing_consumers(conn)

    finally:
        await conn.close()


async def backfill_existing_consumers(conn) -> None:
    """
    Backfill aadhaar_reference_id for existing consumer rows.
    Requires QR_HMAC_SECRET to be set (same value as in .env).
    Will also set expires_at = '2099-01-01' on existing qr_codes rows.
    """
    import hashlib, hmac as _hmac
    from cryptography.fernet import Fernet

    secret = os.environ.get("QR_HMAC_SECRET", "")
    fernet_key = os.environ.get("FIELD_ENCRYPTION_KEY", "")
    if not secret or not fernet_key:
        print("[SKIP] QR_HMAC_SECRET or FIELD_ENCRYPTION_KEY not set — skipping backfill")
        return

    fernet = Fernet(fernet_key.encode())

    rows = await conn.fetch(
        "SELECT id, aadhaar_encrypted FROM consumers WHERE aadhaar_encrypted IS NOT NULL AND aadhaar_reference_id IS NULL"
    )
    print(f"\nBackfilling {len(rows)} consumer rows…")
    ok = skip = 0
    for row in rows:
        try:
            aadhaar = fernet.decrypt(row["aadhaar_encrypted"].encode()).decode()
            digits = aadhaar.replace(" ", "").replace("-", "")
            ref_id = _hmac.new(secret.encode(), digits.encode(), hashlib.sha256).hexdigest()
            last4 = digits[-4:]
            await conn.execute(
                "UPDATE consumers SET aadhaar_reference_id = $1, aadhaar_last4 = $2 WHERE id = $3",
                ref_id, last4, row["id"],
            )
            ok += 1
        except Exception as e:
            print(f"  [WARN] Could not backfill consumer {row['id']}: {e}")
            skip += 1

    print(f"Backfill done: {ok} updated, {skip} skipped.\n")

    # Backfill qr_codes: set is_revoked=False (default) and expires_at far-future for active rows
    print("Updating existing qr_codes expires_at to 2099 (permanent)…")
    result = await conn.execute(
        "UPDATE qr_codes SET expires_at = '2099-01-01 00:00:00+00' WHERE is_active = TRUE AND is_revoked IS NULL OR is_revoked = FALSE"
    )
    print(f"  {result} rows updated.\n")
    print("✅ Backfill complete.")


if __name__ == "__main__":
    asyncio.run(run_migration())
