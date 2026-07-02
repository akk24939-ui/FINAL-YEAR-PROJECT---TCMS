"""Image service — MIME validation and EXIF stripping.

Security notes:
- MIME type is detected from magic bytes, NOT from the Content-Type header or
  file extension, which can be spoofed.
- EXIF stripping is done by re-encoding through Pillow, which discards all
  metadata (GPS, camera model, etc.) from the resulting JPEG.
- Nothing is written to disk here; all operations happen on in-memory bytes.
"""
from __future__ import annotations

import io
from typing import Optional

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

# Magic-byte signatures for allowed image formats
_MAGIC_SIGNATURES: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG",
    "image/webp": b"RIFF",   # first 4 bytes; full check includes bytes 8-12
    "application/pdf": b"%PDF",
}


def _detect_mime(file_bytes: bytes) -> Optional[str]:
    """Detect MIME type from magic bytes.  Returns None if unknown."""
    for mime, magic in _MAGIC_SIGNATURES.items():
        if file_bytes[: len(magic)] == magic:
            # Extra check for WebP: bytes 8-12 must be b'WEBP'
            if mime == "image/webp" and file_bytes[8:12] != b"WEBP":
                continue
            return mime
    return None


def validate_mime(file_bytes: bytes, allowed: list[str]) -> str:
    """Detect MIME type from magic bytes and confirm it is in the allowed list.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        allowed: List of accepted MIME strings, e.g. ['image/jpeg', 'image/png'].

    Returns:
        Detected MIME type string.

    Raises:
        HTTPException 415: If MIME is unknown or not in *allowed*.
    """
    detected = _detect_mime(file_bytes)
    if detected is None or detected not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type. "
                f"Allowed types: {', '.join(allowed)}"
            ),
        )
    return detected


def strip_exif_and_reencode(file_bytes: bytes) -> bytes:
    """Open an image from bytes, discard all EXIF metadata, and re-encode as JPEG.

    The re-encoding through Pillow effectively strips all metadata because
    Pillow does not copy EXIF/XMP/IPTC blocks when saving to a new buffer.

    Args:
        file_bytes: Raw bytes of the source image.

    Returns:
        JPEG-encoded bytes with no metadata.

    Raises:
        HTTPException 422: If the bytes cannot be decoded as an image.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        # Convert palette/RGBA modes to RGB so JPEG encoding succeeds
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=85, optimize=True)
        return output.getvalue()
    except UnidentifiedImageError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is not a valid image",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image processing failed: {exc}",
        )
