import random
import re
import hashlib
from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_mock_aadhaar() -> str:
    """Generate a realistic 12-digit mock Aadhaar number."""
    first = random.randint(2, 9)  # Aadhaar never starts with 0 or 1
    rest = [random.randint(0, 9) for _ in range(11)]
    return str(first) + "".join(map(str, rest))


def validate_aadhaar_format(number: str) -> bool:
    """Validate Aadhaar is 12 digits, not starting with 0 or 1."""
    if not number:
        return False
    cleaned = re.sub(r"\s|-", "", number)
    if not re.match(r"^[2-9]\d{11}$", cleaned):
        return False
    return True


def hash_aadhaar(number: str) -> str:
    """Hash Aadhaar number using bcrypt for secure storage."""
    cleaned = re.sub(r"\s|-", "", number)
    return _pwd_context.hash(cleaned)


def verify_aadhaar(number: str, hashed: str) -> bool:
    cleaned = re.sub(r"\s|-", "", number)
    return _pwd_context.verify(cleaned, hashed)
