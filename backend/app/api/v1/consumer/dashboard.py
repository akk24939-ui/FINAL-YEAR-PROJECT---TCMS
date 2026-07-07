"""Consumer dashboard endpoint — full consumption summary + chart data."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Consumer Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Return full dashboard data for the authenticated consumer.

    Includes:
    - Consumption summary cards: today / this week / this month
      (consumed standard drinks, limit, percent used, traffic-light status)
    - 7-day daily consumption line chart data
    - 4-week weekly consumption bar chart data
    - Alert type + message if limit exceeded or approaching
    - Profile summary (name, Aadhaar masked, member since, teetotaler flag)

    Standard drink equivalents:
      Beer 330 ml = 1 SD | Wine 150 ml = 1 SD | Spirits 40 ml = 1 SD

    All timestamps in UTC ISO-8601.
    """
    try:
        return dashboard_service.get_dashboard(user=current_user, db=db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dashboard error: {str(exc)}",
        ) from exc
