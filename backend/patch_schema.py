"""
Quick schema patcher -- adds ONLY the missing columns introduced in the QR/Identity refactor.
Safe to run multiple times (uses IF NOT EXISTS everywhere).

Usage:
  cd "a:\\FINAL YEAR PROJECT TASMAC\\backend"
  python patch_schema.py
"""
import asyncio, os, sys

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)

from dotenv import load_dotenv
load_dotenv(os.path.join(_here, ".env"))

import asyncpg

PATCH_SQL = [
    # -- consumers table (ConsumerProfile model) ------------------------------------
    ("consumers.aadhaar_reference_id",
     "ALTER TABLE consumers ADD COLUMN IF NOT EXISTS aadhaar_reference_id VARCHAR(64)"),

    ("consumers.aadhaar_last4",
     "ALTER TABLE consumers ADD COLUMN IF NOT EXISTS aadhaar_last4 VARCHAR(4)"),

    ("consumers.aadhaar_reference_id unique index",
     """CREATE UNIQUE INDEX IF NOT EXISTS uq_consumers_aadhaar_ref
        ON consumers (aadhaar_reference_id)
        WHERE aadhaar_reference_id IS NOT NULL"""),

    # -- qr_codes table -------------------------------------------------------------
    ("qr_codes.consumer_reference_id",
     "ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS consumer_reference_id VARCHAR(64)"),

    ("qr_codes.consumer_reference_id index",
     "CREATE INDEX IF NOT EXISTS ix_qr_codes_consumer_ref ON qr_codes (consumer_reference_id)"),

    ("qr_codes.is_revoked",
     "ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE"),

    ("qr_codes.revoked_at",
     "ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE"),
]

ENUM_VALUES = ["qr_scan_success", "qr_scan_fail", "qr_revoked", "qr_regenerated"]


async def main():
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("ERROR: DATABASE_URL not set in .env"); return

    # asyncpg uses plain postgresql:// scheme
    dsn_plain = dsn.replace("postgresql+asyncpg://", "postgresql://")

    print("Connecting...")
    try:
        conn = await asyncpg.connect(dsn_plain)
    except Exception as e:
        print(f"ERROR: Cannot connect: {e}"); return

    print("Connected. Applying patches...\n")
    ok = fail = 0

    for name, sql in PATCH_SQL:
        try:
            await conn.execute(sql)
            print(f"  [OK]   {name}")
            ok += 1
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")
            fail += 1

    # Enum values (fail silently if already added)
    for val in ENUM_VALUES:
        try:
            await conn.execute(f"""
                DO $$ BEGIN
                    ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{val}';
                EXCEPTION WHEN others THEN NULL; END $$;
            """)
            print(f"  [OK]   audit enum: {val}")
        except Exception as e:
            print(f"  [WARN] audit enum {val}: {e}")

    await conn.close()
    if fail == 0:
        print(f"\nAll done! {ok} patches applied successfully.")
    else:
        print(f"\nDone with {fail} failure(s). {ok} patches applied.")


asyncio.run(main())
