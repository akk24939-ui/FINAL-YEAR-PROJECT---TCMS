from fastapi import APIRouter
from app.api.v1 import auth, consumers, purchases, admin
from app.api.v1.caretaker import router as caretaker_router, router_doctor

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(consumers.router)
api_router.include_router(purchases.router)
api_router.include_router(admin.router)
api_router.include_router(caretaker_router)
api_router.include_router(router_doctor)
