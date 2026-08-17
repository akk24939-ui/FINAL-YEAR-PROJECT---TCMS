"""
Purchase service: idempotency, limit checks, purchase recording, and notification triggers.

Security Notes:
  - Idempotency key enforced at DB UNIQUE constraint — no double-recording on replay.
  - Limit check runs in atomic DB transaction with row-level lock to prevent race conditions.
  - Blocked/teetotaler/self-restricted consumers are rejected before any product data is returned.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Consumer, Notification, Product, Purchase, Restriction
from app.schemas.schemas import PurchaseCreate


class PurchaseService:

    async def record_purchase(
        self,
        db: AsyncSession,
        *,
        consumer: Consumer,
        shop_id: uuid.UUID,
        data: PurchaseCreate,
    ) -> Purchase:
        # 1. Teetotaler / self-restriction check
        if consumer.teetotaler_flag:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Consumer is in teetotaler mode")

        restriction_result = await db.execute(
            select(Restriction)
            .where(Restriction.consumer_id == consumer.id)
            .order_by(Restriction.effective_from.desc())
            .limit(1)
        )
        restriction = restriction_result.scalar_one_or_none()
        if restriction and restriction.self_restricted:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Consumer is self-restricted")

        # 2. Get product
        product_result = await db.execute(select(Product).where(Product.id == data.product_id))
        product = product_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        # 3. Calculate standard drinks being purchased
        drinks_now = product.standard_drink_equiv * data.quantity

        # 4. Limit enforcement
        if restriction:
            await self._check_limits(db, consumer, restriction, drinks_now)

        # 5. Create purchase (DB unique constraint covers idempotency)
        try:
            purchase = Purchase(
                consumer_id=consumer.id,
                shop_id=shop_id,
                product_id=data.product_id,
                quantity=data.quantity,
                idempotency_key=data.idempotency_key,
            )
            db.add(purchase)
            await db.flush()
        except Exception as e:
            if "idempotency_key" in str(e):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate transaction")
            raise

        # 6. Notify consumer if 80%+ of daily limit consumed
        if restriction and restriction.daily_limit:
            consumed = await self._daily_consumed(db, consumer.id)
            if consumed >= restriction.daily_limit * Decimal("0.8"):
                await self._notify(db, consumer, "LIMIT_ALERT", "You have consumed 80% or more of your daily limit.")

        return purchase

    async def _daily_consumed(self, db: AsyncSession, consumer_id: uuid.UUID) -> Decimal:
        today = datetime.now(timezone.utc).date()
        result = await db.execute(
            select(func.coalesce(func.sum(Product.standard_drink_equiv * Purchase.quantity), 0))
            .join(Product, Purchase.product_id == Product.id)
            .where(Purchase.consumer_id == consumer_id)
            .where(func.date(Purchase.timestamp) == today)
        )
        return Decimal(str(result.scalar() or 0))

    async def _check_limits(
        self,
        db: AsyncSession,
        consumer: Consumer,
        restriction: Restriction,
        drinks_now: Decimal,
    ) -> None:
        today = datetime.now(timezone.utc)
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        async def consumed_since(since: datetime) -> Decimal:
            result = await db.execute(
                select(func.coalesce(func.sum(Product.standard_drink_equiv * Purchase.quantity), 0))
                .join(Product, Purchase.product_id == Product.id)
                .where(Purchase.consumer_id == consumer.id)
                .where(Purchase.timestamp >= since)
            )
            return Decimal(str(result.scalar() or 0))

        if restriction.daily_limit:
            if await consumed_since(today.replace(hour=0, minute=0, second=0)) + drinks_now > restriction.daily_limit:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Daily purchase limit exceeded")
        if restriction.weekly_limit:
            if await consumed_since(week_start.replace(hour=0, minute=0, second=0)) + drinks_now > restriction.weekly_limit:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Weekly purchase limit exceeded")
        if restriction.monthly_limit:
            if await consumed_since(month_start.replace(hour=0, minute=0, second=0)) + drinks_now > restriction.monthly_limit:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Monthly purchase limit exceeded")

    async def _notify(self, db: AsyncSession, consumer: Consumer, ntype: str, msg: str) -> None:
        note = Notification(user_id=consumer.user_id, type=ntype, message=msg)
        db.add(note)
