from pydantic import BaseModel, Field
from datetime import datetime
import uuid
from decimal import Decimal


class PurchaseCreate(BaseModel):
    consumer_qr_token: str
    product_name: str = Field(..., min_length=1)
    quantity_ml: int = Field(..., ge=1)
    price: Decimal = Field(..., ge=0)
    product_id: uuid.UUID | None = None
    notes: str | None = None


class PurchaseResponse(BaseModel):
    id: uuid.UUID
    consumer_id: uuid.UUID
    shop_id: uuid.UUID
    product_name: str
    quantity_ml: int
    price: Decimal
    purchased_at: datetime

    model_config = {"from_attributes": True}


class PurchaseHistoryResponse(BaseModel):
    purchases: list[PurchaseResponse]
    total_count: int
    total_ml: int
    total_spent: Decimal
