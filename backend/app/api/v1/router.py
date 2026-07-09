"""API v1 main router — aggregates all sub-routers."""
from fastapi import APIRouter

from app.api.v1 import auth, otp, admin_auth, shop_auth
from app.api.v1.consumer.router import router as consumer_router
from app.api.v1.admin import router as admin_router
from app.api.v1.operator import router as operator_router

api_router = APIRouter()

# Auth routes (consumer portal)
api_router.include_router(auth.router)
api_router.include_router(otp.router)

# Portal-specific auth routes
api_router.include_router(admin_auth.router)
api_router.include_router(shop_auth.router)

# Consumer module
api_router.include_router(consumer_router, prefix="/consumer")

# Admin module
api_router.include_router(admin_router)

# Shop Operator module
api_router.include_router(operator_router)
