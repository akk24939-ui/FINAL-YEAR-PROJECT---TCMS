from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import create_tables
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    create_tables()
    yield
    # Shutdown: cleanup (if needed)


app = FastAPI(
    title="Smart TASMAC API",
    description="""
## Smart TASMAC — Consumer Regulation System
**Tamil Nadu State Marketing Corporation Ltd.**
Prohibition & Excise Department, Government of Tamil Nadu

TASMAC HQ: No. 800, Anna Salai, Chennai — 600 002

### Features
- Consumer registration with mock Aadhaar verification
- Self-limit setting (daily/weekly/monthly)
- QR code consumer identity
- Teetotaler mode
- Purchase recording with limit enforcement
- Government analytics dashboard
- Doctor health trends (anonymized)
- Caretaker monitoring with consent

> This is an educational demonstration platform. Uses mock Aadhaar data.
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(api_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": "Smart TASMAC API",
        "version": settings.APP_VERSION,
        "authority": "Tamil Nadu State Marketing Corporation Ltd.",
        "hq": "No. 800, Anna Salai, Chennai — 600 002",
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to Smart TASMAC API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "thirukkural": "களித்தறியேன் என்பது கைவிடுக — நெஞ்சத்து வளர்த்தது வாய்க்கும் மதி.",
        "kural_english": "A mind that rejects intoxication grows in wisdom.",
        "kural_ref": "Thirukkural 922 — Chapter 93: கள்ளுண்ணாமை",
    }
