"""One-shot script: reset a consumer's password by Aadhaar number.

Usage:
    cd backend
    python scripts/reset_consumer_password.py 379580354372 NewPass@1234

The script decrypts stored Aadhaar values to find the matching consumer,
then hashes and stores the new password.
"""
import asyncio
import sys

sys.path.insert(0, ".")


async def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python scripts/reset_consumer_password.py <aadhaar_12digit> <new_password>")
        sys.exit(1)

    target_aadhaar = sys.argv[1].strip()
    new_password = sys.argv[2].strip()

    if len(target_aadhaar) != 12 or not target_aadhaar.isdigit():
        print("ERROR: Aadhaar must be exactly 12 digits.")
        sys.exit(1)

    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.security import decrypt_aadhaar, hash_password
    from app.models.consumer_profile import ConsumerProfile
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        profiles_result = await db.execute(
            select(ConsumerProfile).where(ConsumerProfile.aadhaar_encrypted.isnot(None))
        )
        matched_user_id = None
        for profile in profiles_result.scalars().all():
            try:
                raw = decrypt_aadhaar(profile.aadhaar_encrypted)
                if raw == target_aadhaar:
                    matched_user_id = profile.user_id
                    break
            except Exception:
                continue

        if not matched_user_id:
            print(f"ERROR: No consumer found with Aadhaar ending in ...{target_aadhaar[-4:]}.")
            sys.exit(1)

        user_result = await db.execute(select(User).where(User.id == matched_user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            print("ERROR: Consumer profile found but User record missing.")
            sys.exit(1)

        user.password_hash = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        user.token_version = (user.token_version or 0) + 1
        await db.commit()

        print(f"✅ Password reset for user: {user.full_name} ({str(user.id)[:8]}...)")
        print(f"   Mobile : {user.mobile_number}")
        print(f"   New pw : {new_password}")
        print("   You can now log in with your mobile number or Aadhaar.")


if __name__ == "__main__":
    asyncio.run(main())
