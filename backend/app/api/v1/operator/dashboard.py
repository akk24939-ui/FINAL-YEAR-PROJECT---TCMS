"""Operator dashboard endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.services import operator_service

router = APIRouter()


@router.get("/dashboard", summary="Shop operator dashboard — today's stats and recent transactions")
def get_dashboard(
    current_user: User = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
):
    return operator_service.get_operator_dashboard(current_user, db)
