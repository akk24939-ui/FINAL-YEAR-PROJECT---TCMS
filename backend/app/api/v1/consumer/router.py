"""Consumer API router — aggregates all consumer sub-routers."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.consumer import (
    limits,
    notifications,
    pdf,
    profile,
    purchases,
    qr,
    register,
    teetotaler,
)

router = APIRouter(tags=["Consumer"])

# Registration (no auth required — user is not logged in yet)
router.include_router(register.router)

# Authenticated consumer sub-routers
router.include_router(profile.router)
router.include_router(limits.router)
router.include_router(teetotaler.router)
router.include_router(purchases.router)
router.include_router(qr.router)
router.include_router(pdf.router)
router.include_router(notifications.router)
