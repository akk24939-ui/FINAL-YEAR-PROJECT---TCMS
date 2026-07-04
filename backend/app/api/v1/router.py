"""API v1 main router — aggregates all sub-routers."""
from fastapi import APIRouter

from app.api.v1 import auth, otp
from app.api.v1.consumer.router import router as consumer_router

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(otp.router)
api_router.include_router(consumer_router, prefix="/consumer")
