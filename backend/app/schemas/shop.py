from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class ShopCreate(BaseModel):
    shop_code: str = Field(..., min_length=3)
    name: str = Field(..., min_length=2)
    address: str
    district: str
    license_number: str | None = None


class ShopResponse(BaseModel):
    id: uuid.UUID
    shop_code: str
    name: str
    address: str
    district: str
    is_active: bool
    operator_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ShopListResponse(BaseModel):
    shops: list[ShopResponse]
    total: int
