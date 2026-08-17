"""
Database seeder: inserts roles, sample products, and demo accounts for testing.
Run: python seed.py
"""
import asyncio
import uuid
from datetime import date, datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import get_settings
from app.core.security import hash_password
from app.models.models import Base, Consumer, Product, Role, Shop, User

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


ROLES = ["consumer", "shop_operator", "gov_admin", "doctor", "caretaker"]

PRODUCTS = [
    {"name": "King Fisher Beer 650ml", "category": "Beer",    "volume_ml": 650,  "standard_drink_equiv": 1.8, "price": 120},
    {"name": "Old Monk Rum 180ml",     "category": "Spirits", "volume_ml": 180,  "standard_drink_equiv": 2.0, "price": 90},
    {"name": "Royal Stag Whisky 375ml","category": "Spirits", "volume_ml": 375,  "standard_drink_equiv": 4.2, "price": 350},
    {"name": "Sula Cabernet 750ml",    "category": "Wine",    "volume_ml": 750,  "standard_drink_equiv": 5.0, "price": 700},
    {"name": "Haywards 5000 500ml",    "category": "Beer",    "volume_ml": 500,  "standard_drink_equiv": 1.4, "price": 85},
]

DEMO_USERS = [
    {"email": "consumer@tasmac.dev",  "role": "consumer",      "district": "Chennai"},
    {"email": "operator@tasmac.dev",  "role": "shop_operator", "district": "Chennai"},
    {"email": "admin@tasmac.dev",     "role": "gov_admin",     "district": "Chennai"},
    {"email": "doctor@tasmac.dev",    "role": "doctor",        "district": "Chennai"},
    {"email": "caretaker@tasmac.dev", "role": "caretaker",     "district": "Chennai"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # Roles
        role_map: dict[str, Role] = {}
        for rname in ROLES:
            role = Role(name=rname)
            db.add(role)
            role_map[rname] = role
        await db.flush()

        # Products
        for p in PRODUCTS:
            db.add(Product(**p))
        await db.flush()

        # Demo Users
        for u in DEMO_USERS:
            role = role_map[u["role"]]
            user = User(email=u["email"], password_hash=hash_password("Demo@1234"), role_id=role.id)
            db.add(user)
            await db.flush()

            if u["role"] == "consumer":
                consumer = Consumer(user_id=user.id, dob=date(1990, 5, 15), gender="M", district=u["district"])
                db.add(consumer)
            elif u["role"] == "shop_operator":
                shop = Shop(name="TASMAC Chennai Central", district="Chennai", license_no="TN-CHN-001", operator_user_id=user.id)
                db.add(shop)

        await db.commit()
        print("Seed complete. Demo password for all accounts: Demo@1234")


if __name__ == "__main__":
    asyncio.run(seed())
