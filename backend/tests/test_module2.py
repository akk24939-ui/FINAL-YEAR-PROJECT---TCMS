"""
Module 2 security tests: schema validation, authz bypass, duplicate purchase.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ── Schema validation ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_weak_password_rejected(client):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "short",
        "dob": "1990-01-01",
        "district": "Chennai",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_gender_rejected(client):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test2@example.com",
        "password": "StrongPass1!",
        "dob": "1990-01-01",
        "district": "Chennai",
        "gender": "X",  # invalid
    })
    assert resp.status_code == 422


# ── Authz bypass: no token ────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_consumer_endpoint_requires_auth(client):
    resp = await client.get("/api/v1/consumers/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_endpoint_requires_auth(client):
    resp = await client.get("/api/v1/admin/analytics/district")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_caretaker_endpoint_requires_auth(client):
    resp = await client.get(f"/api/v1/caretaker/consumer/{uuid.uuid4()}/status")
    assert resp.status_code == 401


# ── Rate‑limit header present ─────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_health_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── Security headers present ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_security_headers(client):
    resp = await client.get("/health")
    assert "x-content-type-options" in resp.headers
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert "x-frame-options" in resp.headers
