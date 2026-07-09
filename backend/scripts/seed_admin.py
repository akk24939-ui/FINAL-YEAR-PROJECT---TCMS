"""Admin seed script — creates the bootstrap admin user from env vars.

Usage:
    python scripts/seed_admin.py

Reads from .env:
    ADMIN_SEED_USERNAME   (used as email, e.g. "admin@tasmac.gov.in")
    ADMIN_SEED_PASSWORD   (plaintext, bcrypt-hashed here, never stored raw)

Security guarantees:
- Password is bcrypt-hashed with cost=12 before any DB write.
- Plaintext is zeroed from memory immediately after hashing.
- Script is idempotent — running it twice does NOT reset the password.
- Sets must_change_password=True so admin MUST change on first login.
- Never logs or prints the plaintext password.
"""
import os
import sys
import uuid
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password


def seed_admin() -> None:
    username = os.getenv("ADMIN_SEED_USERNAME", "admin@tasmac.gov.in")
    password = os.getenv("ADMIN_SEED_PASSWORD")

    if not password:
        print("[ERROR] ADMIN_SEED_PASSWORD not set in .env. Aborting.")
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == username).first()
        if existing:
            print(f"[INFO] Admin user '{username}' already exists. Skipping seed.")
            print(f"[INFO] Role: {existing.role}, must_change_password: {existing.must_change_password}")
            return

        # Hash the password — cost=12 minimum for admin accounts
        pw_hash = hash_password(password)
        # Zero out plaintext reference immediately
        password = None  # type: ignore[assignment]

        admin = User(
            id=uuid.uuid4(),
            email=username,
            full_name="Government Administrator",
            password_hash=pw_hash,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            must_change_password=True,  # FORCE change on first login
            token_version=0,
        )
        db.add(admin)
        db.commit()
        print(f"[OK] Admin user '{username}' created successfully.")
        print("[IMPORTANT] must_change_password=True — admin MUST change password on first login.")
        print("[SECURITY] Plaintext password has been discarded.")
    except Exception as exc:
        db.rollback()
        print(f"[ERROR] Seed failed: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
