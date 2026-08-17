"""Consumer teetotaler toggle endpoint."""
from fastapi import APIRouter, Depends, Body, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.services.consumer_service import toggle_teetotaler
from app.schemas.consumer import ConsumerProfileResponse

router = APIRouter(prefix="/teetotaler", tags=["Consumer - Teetotaler"])


@router.post("/enable", response_model=ConsumerProfileResponse)
async def enable_teetotaler(
    confirm: bool = Body(..., embed=True,
                         description="Must be True to confirm this action"),
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Enable teetotaler mode. This blocks ALL purchases at the server level."""
    if not confirm:
        raise HTTPException(status_code=400,
                            detail="Set confirm=true to enable teetotaler mode")
    return await toggle_teetotaler(current_user, enabled=True, db=db)


@router.post("/disable", response_model=ConsumerProfileResponse)
async def disable_teetotaler(
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Disable teetotaler mode."""
    return await toggle_teetotaler(current_user, enabled=False, db=db)
