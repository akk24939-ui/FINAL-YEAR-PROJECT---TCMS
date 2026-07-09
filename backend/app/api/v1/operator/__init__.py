"""Operator portal API router."""
from fastapi import APIRouter
from app.api.v1.operator import dashboard, purchases, consumer_lookup, products

router = APIRouter(prefix="/operator", tags=["Shop Operator"])

router.include_router(dashboard.router)
router.include_router(purchases.router)
router.include_router(consumer_lookup.router)
router.include_router(products.router)
