"""Auth endpoints — login, logout, token refresh.

Rate limiting:
  - POST /login  : 10 requests per hour per IP
  - POST /logout : no limit (auth required)
  - POST /refresh: no limit (cookie required)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from slowapi import _rate_limit_exceeded_handler  # noqa: F401 (re-exported by app)
from slowapi.util import get_remote_address

from app.core.dependencies import get_client_ip, get_current_user
from app.core.limiter import limiter
from app.models.user import User
from app.schemas.auth import CookieTokenResponse, LoginRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=CookieTokenResponse)
@limiter.limit("10/hour")
def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    ip: str = Depends(get_client_ip),
    db=Depends(__import__("app.core.database", fromlist=["get_db"]).get_db),
):
    """Authenticate consumer by mobile number or Aadhaar last-4.

    On success: returns access token in response body + sets httpOnly refresh cookie.
    On failure: generic 401 (never reveals which field was wrong).
    """
    return auth_service.login_consumer(
        identifier=body.identifier,
        password=body.password,
        response=response,
        db=db,
        ip=ip,
    )


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db=Depends(__import__("app.core.database", fromlist=["get_db"]).get_db),
):
    """Sign out the current user — revokes server-side refresh token and clears cookie."""
    auth_service.logout(
        request=request,
        response=response,
        db=db,
        current_user=current_user,
    )


@router.post("/refresh", response_model=CookieTokenResponse)
def refresh(
    request: Request,
    response: Response,
    db=Depends(__import__("app.core.database", fromlist=["get_db"]).get_db),
):
    """Exchange a valid httpOnly refresh cookie for a new access + refresh token pair."""
    return auth_service.refresh_tokens(
        request=request,
        response=response,
        db=db,
    )
