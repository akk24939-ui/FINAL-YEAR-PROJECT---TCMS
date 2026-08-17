"""
FastAPI application factory.

Security Notes:
  - Security headers applied globally via middleware.
  - CORS restricted to FRONTEND_ORIGIN.
  - Rate limiter registered on app state.
  - OpenAPI docs disabled in production.
  - Generic exception handler prevents stack traces leaking to clients.
  - APScheduler runs the Power BI export job every 4 hours (off main request path).
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.middleware import SecurityHeadersMiddleware, RequestIDMiddleware, cors_origins
from app.api.v1.router import api_router

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)


def create_app() -> FastAPI:
    _docs = None if settings.environment == "production" else "/docs"
    _redoc = None if settings.environment == "production" else "/redoc"

    app = FastAPI(
        title="Smart TASMAC Consumer Regulation System",
        version="1.0.0",
        docs_url=_docs,
        redoc_url=_redoc,
        openapi_url="/api/v1/openapi.json" if settings.environment != "production" else None,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Consumer-ID", "X-Access-Token"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_router, prefix="/api/v1")

    # ── APScheduler: Power BI export job (every 4 hours) ─────────────────────
    # Import here to avoid circular dependencies and keep startup light.
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from app.core.database import AsyncSessionLocal
        from app.services.report_exporter import export_all_views

        scheduler = AsyncIOScheduler()

        async def _run_export() -> None:
            """Scheduled Power BI export — runs against a fresh DB session."""
            async with AsyncSessionLocal() as db:
                try:
                    await export_all_views(db)
                except Exception as exc:  # noqa: BLE001
                    # Log but don't crash the scheduler
                    print(f"[scheduler] Power BI export failed: {exc}")

        scheduler.add_job(
            _run_export,
            trigger=IntervalTrigger(hours=4),
            id="powerbi_export",
            replace_existing=True,
            max_instances=1,
        )

        @app.on_event("startup")
        async def start_scheduler() -> None:
            scheduler.start()

        @app.on_event("shutdown")
        async def stop_scheduler() -> None:
            scheduler.shutdown(wait=False)

    except ImportError:
        # APScheduler not installed — Power BI scheduled export disabled.
        # Install with: pip install apscheduler
        print("[startup] WARNING: apscheduler not installed — Power BI export disabled")

    # ── Generic error handler (no stack traces to client) ─────────────────────
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
