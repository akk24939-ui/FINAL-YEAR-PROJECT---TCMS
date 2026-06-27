# Smart TASMAC — Consumer Regulation System
## Tamil Nadu State Marketing Corporation Ltd.

> **கள்ளுண்ணாமை — Chapter 93, Thirukkural 922**
> *"களித்தறியேன் என்பது கைவிடுக — நெஞ்சத்து வளர்த்தது வாய்க்கும் மதி."*
> — Thiruvalluvar

---

## 🚀 Quick Start

### Option A — Docker (Recommended, one click)
```bash
# Just run:
START_TASMAC.bat
# Choose option [1] Docker Mode
```

### Option B — Local (Python + Node.js)
```bash
# 1. Setup database first (if PostgreSQL installed):
SETUP_DATABASE.bat

# 2. Then start everything:
START_TASMAC.bat
# Choose option [2] Local Mode
```

---

## 📋 Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.12+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| PostgreSQL | 15+ | https://postgresql.org (or use Docker) |
| Docker Desktop | Latest | https://docker.com (optional) |

---

## 🌐 Application URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

---

## 👥 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tasmac.gov.in | Admin@1234 |
| Consumer | consumer@test.com | Test@1234 |
| Shop Operator | operator@test.com | Test@1234 |
| Doctor | doctor@test.com | Test@1234 |
| Caretaker | caretaker@test.com | Test@1234 |

---

## 🏛️ About

**Smart TASMAC** is an initiative by the **Prohibition & Excise Department, Government of Tamil Nadu**, to bring transparency, safety, and consumer empowerment to alcohol retail.

- **Authority**: Tamil Nadu State Marketing Corporation Ltd (TASMAC)
- **HQ**: No. 800, Anna Salai, Chennai — 600 002
- **Outlets**: 6,860+ across 38 districts
- **Legal drinking age**: 21+

> ⚠️ **Educational Platform**: Uses mock Aadhaar data. Not affiliated with actual Aadhaar services.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| State | Zustand, TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | FastAPI, Python 3.12+ |
| Database | PostgreSQL 15+ |
| ORM | SQLAlchemy 2.0 + Alembic |
| Auth | JWT (python-jose) + bcrypt |
| PDF | WeasyPrint + Pandas |
| QR | qrcode + html5-qrcode |
| DevOps | Docker, Docker Compose, GitHub Actions |

---

## 📁 Project Structure

```
FINAL YEAR PROJECT TASMAC/
├── START_TASMAC.bat          ← 🚀 MAIN LAUNCHER
├── SETUP_DATABASE.bat        ← 🐘 Database setup (local mode)
├── backend/                  ← FastAPI Python backend
├── frontend/                 ← React 19 + Vite frontend
├── docker/                   ← Docker Compose + Nginx
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── init.sql              ← DB schema + seed data
└── README.md
```

---

## 👤 User Roles

1. **Consumer** — Track purchases, set limits, QR profile, teetotaler mode
2. **Shop Operator** — Scan consumer QR, record sales, enforce limits
3. **Government Admin** — District analytics, revenue reports, policy insights
4. **Doctor** — Anonymous health trends, addiction risk analytics
5. **Caretaker** — Monitor linked consumer with consent, receive alerts

---

*Smart TASMAC © 2025 Tamil Nadu State Marketing Corporation Ltd. | Prohibition & Excise Department, Government of Tamil Nadu*
