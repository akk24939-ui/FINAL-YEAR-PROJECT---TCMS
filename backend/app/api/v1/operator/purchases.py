"""Operator purchase recording and shop history."""
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role, get_client_ip
from app.models.user import User
from app.services import operator_service

router = APIRouter()


class RecordPurchaseRequest(BaseModel):
    consumer_user_id: str = Field(..., description="Consumer user UUID from QR lookup")
    product_name: str = Field(..., min_length=1, max_length=200)
    quantity_ml: int = Field(..., ge=30, le=5000)
    price: float = Field(..., ge=0)
    alcohol_pct: float = Field(5.0, ge=0, le=100, description="Alcohol percentage of the product")
    product_id: Optional[str] = None
    notes: Optional[str] = None


@router.post("/purchases", summary="Record a purchase (verifies limits, blocks if exceeded)")
def record_purchase(
    body: RecordPurchaseRequest,
    current_user: User = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
):
    return operator_service.record_purchase(
        consumer_user_id=body.consumer_user_id,
        product_name=body.product_name,
        quantity_ml=body.quantity_ml,
        price=body.price,
        alcohol_pct=body.alcohol_pct,
        operator=current_user,
        db=db,
        product_id=body.product_id,
        notes=body.notes,
    )


@router.get("/purchases", summary="Shop purchase history (operator's shop only)")
def get_shop_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    date_filter: Optional[date] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    current_user: User = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
):
    return operator_service.get_shop_history(
        operator=current_user,
        db=db,
        skip=skip,
        limit=limit,
        date_filter=date_filter,
    )
