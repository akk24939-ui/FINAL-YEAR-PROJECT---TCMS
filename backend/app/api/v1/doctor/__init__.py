"""Doctor module API router."""
from fastapi import APIRouter

from app.api.v1.doctor import dashboard, patients, restrictions

router = APIRouter(prefix="/doctor", tags=["Doctor"])

router.include_router(dashboard.router)
router.include_router(patients.router)
router.include_router(restrictions.router)
