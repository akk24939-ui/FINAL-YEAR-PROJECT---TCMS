"""Operator product catalogue endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.services import operator_service

router = APIRouter()


@router.get("/products", summary="Get TASMAC product catalogue for this shop")
def get_products(
    current_user: User = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
):
    return {"products": operator_service.get_products(db)}
