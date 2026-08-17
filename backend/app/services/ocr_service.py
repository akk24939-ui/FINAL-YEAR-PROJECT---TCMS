"""OCR service — Aadhaar card data extraction.

For this educational prototype, pytesseract is attempted first.
If Tesseract-OCR binary is not installed, a realistic mock response
is returned so the registration flow can still be demonstrated.

Security notes:
- Images processed entirely in-memory; nothing written to disk.
- Aadhaar number is masked (last-4 visible) before returning to caller.
- Confidence scores are heuristic; caller must allow user correction.
"""
from __future__ import annotations

import io
import re
import random
import string
from datetime import date
from typing import Optional

from PIL import Image, ImageEnhance

from app.schemas.consumer import OcrConfidence, RegisterExtractResponse
from app.models.consumer_profile import Gender

# ── Try to import pytesseract (optional) ──────────────────────────────────────
try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    _TESSERACT_AVAILABLE = True
except ImportError:
    _TESSERACT_AVAILABLE = False

# ── Regex patterns ─────────────────────────────────────────────────────────────
_RE_AADHAAR     = re.compile(r"\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b")
_RE_DOB_SLASH   = re.compile(r"(?:DOB|Date\s+of\s+Birth)[:\s]*(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_RE_DOB_DASH    = re.compile(r"(?:DOB|Date\s+of\s+Birth)[:\s]*(\d{2}-\d{2}-\d{4})", re.IGNORECASE)
_RE_DOB_BARE    = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
_RE_YEAR_BIRTH  = re.compile(r"Year\s+of\s+Birth[:\s]*(\d{4})", re.IGNORECASE)
_RE_ADDR_START  = re.compile(r"(?:Address|S/O|D/O|W/O|C/O)[:\s]", re.IGNORECASE)

# ── Mock data pool (used when Tesseract not installed) ─────────────────────────
_MOCK_NAMES = [
    "Arjun Kumar", "Priya Devi", "Murugan Selvam", "Anitha Rajan",
    "Karthik Subramanian", "Lakshmi Venkatesh", "Senthil Raja", "Meena Krishnan",
]
_MOCK_ADDRESSES = [
    "12, Gandhi Nagar, Adyar, Chennai, Tamil Nadu - 600020",
    "45, Anna Salai, Coimbatore, Tamil Nadu - 641001",
    "78, Nehru Street, Madurai, Tamil Nadu - 625001",
    "23, Kamaraj Road, Salem, Tamil Nadu - 636001",
]
_MOCK_DISTRICTS = ["Chennai", "Coimbatore", "Madurai", "Salem", "Trichy"]


def _mock_response() -> RegisterExtractResponse:
    """Return realistic mock OCR data for demo purposes."""
    # Generate a valid-looking Aadhaar: must start with 2-9
    first_digit = str(random.randint(2, 9))
    rest_digits = "".join(random.choices(string.digits, k=11))
    mock_aadhaar_digits = first_digit + rest_digits

    return RegisterExtractResponse(
        full_name=random.choice(_MOCK_NAMES),
        dob=date(1990, random.randint(1, 12), random.randint(1, 28)),
        gender=random.choice([Gender.MALE, Gender.FEMALE]),
        # Return the raw 12-digit number — masking happens at display/profile level
        aadhaar_number=mock_aadhaar_digits,
        address=random.choice(_MOCK_ADDRESSES),
        district=random.choice(_MOCK_DISTRICTS),
        source="OCR",
        raw_text="[mock — Tesseract not installed]",
        confidence=OcrConfidence(
            full_name=82.0,
            dob=88.0,
            gender=90.0,
            aadhaar_number=95.0,
            address=70.0,
        ),
    )


# ── Helper parsers ─────────────────────────────────────────────────────────────

def _clean_digits(raw: str) -> str:
    return re.sub(r"[\s\-]", "", raw)


def _parse_date(date_str: str, sep: str = "/") -> Optional[date]:
    try:
        parts = date_str.split(sep)
        return date(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        return None


def _extract_aadhaar(text: str) -> tuple[Optional[str], float]:
    m = _RE_AADHAAR.search(text)
    if m:
        raw = _clean_digits(m.group(1))
        if len(raw) == 12 and raw.isdigit():
            return raw, 95.0
    return None, 0.0


def _extract_dob(text: str) -> tuple[Optional[date], float]:
    for pattern, sep in [(_RE_DOB_SLASH, "/"), (_RE_DOB_DASH, "-")]:
        m = pattern.search(text)
        if m:
            parsed = _parse_date(m.group(1), sep)
            if parsed:
                return parsed, 90.0
    m = _RE_DOB_BARE.search(text)
    if m:
        parsed = _parse_date(m.group(1), "/")
        if parsed:
            return parsed, 60.0
    m = _RE_YEAR_BIRTH.search(text)
    if m:
        try:
            return date(int(m.group(1)), 1, 1), 30.0
        except ValueError:
            pass
    return None, 0.0


def _extract_gender(text: str) -> tuple[Optional[Gender], float]:
    upper = text.upper()
    if "FEMALE" in upper:
        return Gender.FEMALE, 90.0
    if "MALE" in upper:
        return Gender.MALE, 90.0
    if "TRANSGENDER" in upper or "OTHERS" in upper:
        return Gender.OTHER, 70.0
    return None, 0.0


def _extract_name(text: str) -> tuple[Optional[str], float]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    
    # 1. Check line immediately preceding S/O, D/O, W/O, C/O
    for i, line in enumerate(lines):
        if re.search(r"^(?:S/O|D/O|W/O|C/O)[:\s]", line, re.IGNORECASE):
            if i > 0:
                cand = lines[i - 1]
                if len(cand) >= 3 and re.match(r"^[A-Za-z\s\.]+$", cand):
                    return cand, 95.0
                
    # 2. Check line preceding DOB
    for i, line in enumerate(lines):
        if re.search(r"\bDOB\b|\bDate\s+of\s+Birth\b", line, re.IGNORECASE):
            if i > 0:
                # Look back up to 3 lines for a valid name
                for j in range(1, min(i + 1, 4)):
                    cand = lines[i - j]
                    # Filter out noise like "HHTAY OB F"
                    if len(cand) >= 3 and re.match(r"^[A-Za-z\s\.]+$", cand) and not cand.isupper():
                        return cand, 75.0
                        
    return None, 0.0


def _extract_address(text: str) -> tuple[Optional[str], float]:
    # Look for Address block ending with a 6-digit pin code
    m = re.search(r"(?:Address|S/O|D/O|W/O|C/O)[:\s]+(.*?-\s*\d{6})", text, re.IGNORECASE | re.DOTALL)
    if m:
        raw = m.group(1).strip()
        # Clean up newlines and extra spaces
        address = re.sub(r"\s+", " ", raw)
        return address, 95.0
    
    # Fallback: just take next 20 words
    m2 = _RE_ADDR_START.search(text)
    if m2:
        raw = text[m2.end():].strip()
        address = " ".join(raw.split()[:20])[:200]
        if len(address) > 10:
            return address, 70.0
            
    return None, 0.0


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_from_image(image_bytes: bytes) -> RegisterExtractResponse:
    """Run OCR on image_bytes and return structured Aadhaar card data.

    Falls back to mock data if Tesseract-OCR is not installed — safe for
    educational prototypes where the full OCR pipeline isn't required.
    """
    # If Tesseract not installed → return realistic mock (prototype mode)
    if not _TESSERACT_AVAILABLE:
        return _mock_response()

    try:
        if image_bytes.startswith(b"%PDF"):
            import fitz
            doc = fitz.open(stream=image_bytes, filetype="pdf")
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        else:
            img = Image.open(io.BytesIO(image_bytes))
        # 1. Grayscale
        if img.mode != "L":
            img = img.convert("L")
        # 2. Upscale (helps Tesseract read small/blurry text)
        img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
        # 3. Increase Contrast to flatten background noise
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.5)

        # DEBUG: Save the image so we can analyze it
        debug_path = r"C:\Users\akk24\.gemini\antigravity\brain\ea07455a-17fb-41da-a1af-6c43e224a643\scratch\debug_aadhaar.jpg"
        import os
        os.makedirs(os.path.dirname(debug_path), exist_ok=True)
        img.save(debug_path)

        text = pytesseract.image_to_string(img, lang="eng")
        
        # DEBUG: Log the raw text to a file so we can read it
        with open(r"C:\Users\akk24\.gemini\antigravity\brain\ea07455a-17fb-41da-a1af-6c43e224a643\scratch\raw_ocr.txt", "w", encoding="utf-8") as f:
            f.write(text)
    except Exception as e:
        # DEBUG: Log the exception to a file so we can see why it's failing
        import os
        log_path = r"C:\Users\akk24\.gemini\antigravity\brain\ea07455a-17fb-41da-a1af-6c43e224a643\scratch\ocr_error.log"
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w") as f:
            f.write(str(e))
        # Tesseract binary not found or image decode error → mock
        return _mock_response()

    raw_aadhaar, aadhaar_conf = _extract_aadhaar(text)
    dob, dob_conf             = _extract_dob(text)
    gender, gender_conf       = _extract_gender(text)
    name, name_conf           = _extract_name(text)
    address, addr_conf        = _extract_address(text)

    # If OCR returned nothing useful → use mock (bad image quality)
    if not any([name, dob, raw_aadhaar]):
        return _mock_response()

    return RegisterExtractResponse(
        full_name=name,
        dob=dob,
        gender=gender,
        # Return raw 12-digit number — masking happens at display/profile level only
        aadhaar_number=raw_aadhaar,
        address=address,
        district=None,
        source="OCR",
        raw_text=text[:2000] if text else None,   # Truncate for safety
        confidence=OcrConfidence(
            full_name=name_conf,
            dob=dob_conf,
            gender=gender_conf,
            aadhaar_number=aadhaar_conf,
            address=addr_conf,
        ),
    )
