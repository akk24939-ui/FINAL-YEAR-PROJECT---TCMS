"""Admin API router — aggregates all admin sub-routes."""
from fastapi import APIRouter
from app.api.v1.admin import overview, shops, doctors, consumers, config, audit, reports

router = APIRouter(prefix="/admin", tags=["Admin"])

router.include_router(overview.router)
router.include_router(shops.router)
router.include_router(doctors.router)
router.include_router(consumers.router)
router.include_router(config.router)
router.include_router(audit.router)
router.include_router(reports.router)
