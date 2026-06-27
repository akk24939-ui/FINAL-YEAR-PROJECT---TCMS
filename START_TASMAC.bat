@echo off
title Smart TASMAC - Consumer Regulation System
color 0A

REM ============================================================
REM  SMART TASMAC — Consumer Regulation System
REM  Tamil Nadu State Marketing Corporation Ltd.
REM  Prohibition ^& Excise Department, Government of Tamil Nadu
REM  TASMAC HQ: No. 800, Anna Salai, Chennai — 600 002
REM ============================================================

echo.
echo  ████████╗ █████╗ ███████╗███╗   ███╗ █████╗  ██████╗
echo  ╚══██╔══╝██╔══██╗██╔════╝████╗ ████║██╔══██╗██╔════╝
echo     ██║   ███████║███████╗██╔████╔██║███████║██║
echo     ██║   ██╔══██║╚════██║██║╚██╔╝██║██╔══██║██║
echo     ██║   ██║  ██║███████║██║ ╚═╝ ██║██║  ██║╚██████╗
echo     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝
echo.
echo  Smart TASMAC — நுகர்வோர் கட்டுப்பாட்டு அமைப்பு
echo  Government of Tamil Nadu ^| Prohibition ^& Excise Department
echo  ================================================================
echo.

REM ─── Check for required tools ────────────────────────────────────────────────
echo [1/7] Checking prerequisites...
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found! Install Python 3.12+ from https://python.org
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYTHON_VERSION=%%v
echo  [OK] Python %PYTHON_VERSION% found

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found! Install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=1" %%v in ('node --version 2^>^&1') do set NODE_VERSION=%%v
echo  [OK] Node.js %NODE_VERSION% found

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm not found!
    pause
    exit /b 1
)
echo  [OK] npm found

REM Check for PostgreSQL (optional - Docker alternative)
where pg_isready >nul 2>&1
if %errorlevel% equ 0 (
    set POSTGRES_AVAILABLE=1
    echo  [OK] PostgreSQL client found
) else (
    set POSTGRES_AVAILABLE=0
    echo  [WARN] PostgreSQL client not in PATH - Will use Docker if available
)

where docker >nul 2>&1
if %errorlevel% equ 0 (
    set DOCKER_AVAILABLE=1
    echo  [OK] Docker found
) else (
    set DOCKER_AVAILABLE=0
    echo  [WARN] Docker not found - Will run services directly
)

echo.

REM ─── Set working directory ────────────────────────────────────────────────────
set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"
set "DOCKER_DIR=%PROJECT_ROOT%docker"

echo [2/7] Setting up environment files...
echo.

REM Create backend .env if not exists
if not exist "%BACKEND_DIR%\.env" (
    if exist "%BACKEND_DIR%\.env.example" (
        copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
        echo  [OK] Created backend\.env from template
    ) else (
        echo DATABASE_URL=postgresql://tasmac_user:tasmac_pass@localhost:5432/tasmac_db> "%BACKEND_DIR%\.env"
        echo SECRET_KEY=tasmac-super-secret-jwt-key-2025-tamil-nadu-govt>> "%BACKEND_DIR%\.env"
        echo ALGORITHM=HS256>> "%BACKEND_DIR%\.env"
        echo ACCESS_TOKEN_EXPIRE_MINUTES=30>> "%BACKEND_DIR%\.env"
        echo REFRESH_TOKEN_EXPIRE_DAYS=7>> "%BACKEND_DIR%\.env"
        echo ENVIRONMENT=development>> "%BACKEND_DIR%\.env"
        echo  [OK] Created backend\.env with defaults
    )
) else (
    echo  [OK] backend\.env already exists
)

REM Create frontend .env if not exists
if not exist "%FRONTEND_DIR%\.env" (
    if exist "%FRONTEND_DIR%\.env.example" (
        copy "%FRONTEND_DIR%\.env.example" "%FRONTEND_DIR%\.env" >nul
        echo  [OK] Created frontend\.env from template
    ) else (
        echo VITE_API_URL=http://localhost:8000> "%FRONTEND_DIR%\.env"
        echo  [OK] Created frontend\.env with defaults
    )
) else (
    echo  [OK] frontend\.env already exists
)

echo.

REM ─── Choose run mode ──────────────────────────────────────────────────────────
echo  ┌─────────────────────────────────────────────────────┐
echo  │            SELECT STARTUP MODE                      │
echo  │                                                     │
echo  │  [1] Docker Mode  (Recommended - Full stack)        │
echo  │  [2] Local Mode   (Python + Node.js directly)       │
echo  │  [3] Backend only (API server only)                 │
echo  │  [4] Frontend only (UI dev server only)             │
echo  │  [5] Stop all services                              │
echo  └─────────────────────────────────────────────────────┘
echo.
set /p "MODE=Enter choice (1-5): "

if "%MODE%"=="1" goto :DOCKER_MODE
if "%MODE%"=="2" goto :LOCAL_MODE
if "%MODE%"=="3" goto :BACKEND_ONLY
if "%MODE%"=="4" goto :FRONTEND_ONLY
if "%MODE%"=="5" goto :STOP_ALL
echo  [ERROR] Invalid choice
pause
exit /b 1

REM ════════════════════════════════════════════════════════════════════════════
:DOCKER_MODE
REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  [DOCKER MODE] Starting full stack with Docker Compose...
echo.

if %DOCKER_AVAILABLE% equ 0 (
    echo  [ERROR] Docker not found! Install Docker Desktop from https://docker.com
    pause
    exit /b 1
)

echo [3/7] Starting Docker services...
cd /d "%DOCKER_DIR%"
docker compose up -d --build

if %errorlevel% neq 0 (
    echo  [ERROR] Docker Compose failed to start
    pause
    exit /b 1
)

echo.
echo  [OK] Docker services started!
echo.
echo  Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

echo.
echo  ┌──────────────────────────────────────────────────────────────┐
echo  │               SMART TASMAC IS RUNNING!                      │
echo  │                                                              │
echo  │  🌐 Frontend:     http://localhost:5173                      │
echo  │  ⚡ Backend API:  http://localhost:8000                      │
echo  │  📚 API Docs:     http://localhost:8000/docs                 │
echo  │  📖 ReDoc:        http://localhost:8000/redoc                │
echo  │  🐘 PostgreSQL:   localhost:5432                             │
echo  │  🔀 Nginx:        http://localhost:80                        │
echo  │                                                              │
echo  │  Demo Credentials:                                           │
echo  │  Admin:    admin@tasmac.gov.in  / Admin@1234                 │
echo  │  Consumer: consumer@test.com    / Test@1234                  │
echo  │                                                              │
echo  └──────────────────────────────────────────────────────────────┘
echo.
echo  Press any key to open the app in your browser...
pause >nul
start http://localhost:5173
echo.
echo  To stop all services, run this script again and choose option [5]
echo.
goto :END

REM ════════════════════════════════════════════════════════════════════════════
:LOCAL_MODE
REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  [LOCAL MODE] Starting backend + frontend directly...
echo.

REM ─── Setup Backend ────────────────────────────────────────────────────────────
echo [3/7] Setting up Python virtual environment...
cd /d "%BACKEND_DIR%"

if not exist "venv" (
    python -m venv venv
    echo  [OK] Virtual environment created
) else (
    echo  [OK] Virtual environment exists
)

echo [4/7] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet --disable-pip-version-check

if %errorlevel% neq 0 (
    echo  [ERROR] Failed to install Python dependencies!
    pause
    exit /b 1
)
echo  [OK] Python dependencies installed

REM ─── Run Database Migrations ─────────────────────────────────────────────────
echo [5/7] Running database migrations...
alembic upgrade head 2>nul
if %errorlevel% neq 0 (
    echo  [WARN] Alembic migration failed - DB may not be configured yet
    echo         Make sure PostgreSQL is running and DATABASE_URL in .env is correct
    echo         Continuing anyway...
)

REM ─── Start Backend in new window ─────────────────────────────────────────────
echo.
echo  Starting FastAPI backend server...
start "Smart TASMAC Backend" cmd /k "cd /d "%BACKEND_DIR%" && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo  [OK] Backend starting on http://localhost:8000

timeout /t 3 /nobreak >nul

REM ─── Setup Frontend ───────────────────────────────────────────────────────────
echo [6/7] Installing Node.js dependencies...
cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    npm install --silent
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo  [OK] Node.js dependencies installed
) else (
    echo  [OK] node_modules exists - skipping install
)

REM ─── Start Frontend in new window ────────────────────────────────────────────
echo [7/7] Starting React development server...
start "Smart TASMAC Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"
echo  [OK] Frontend starting on http://localhost:5173

timeout /t 5 /nobreak >nul

echo.
echo  ┌──────────────────────────────────────────────────────────────┐
echo  │               SMART TASMAC IS RUNNING!                      │
echo  │                                                              │
echo  │  🌐 Frontend:     http://localhost:5173                      │
echo  │  ⚡ Backend API:  http://localhost:8000                      │
echo  │  📚 API Docs:     http://localhost:8000/docs                 │
echo  │  📖 ReDoc:        http://localhost:8000/redoc                │
echo  │                                                              │
echo  │  Demo Credentials:                                           │
echo  │  Admin:    admin@tasmac.gov.in  / Admin@1234                 │
echo  │  Consumer: consumer@test.com    / Test@1234                  │
echo  │  Doctor:   doctor@test.com      / Test@1234                  │
echo  │  Caretaker:caretaker@test.com   / Test@1234                  │
echo  │  Operator: operator@test.com    / Test@1234                  │
echo  │                                                              │
echo  │  Two terminal windows opened - Backend + Frontend            │
echo  │  Close those windows to stop the servers                     │
echo  └──────────────────────────────────────────────────────────────┘
echo.
echo  Press any key to open the app in your browser...
pause >nul
start http://localhost:5173
goto :END

REM ════════════════════════════════════════════════════════════════════════════
:BACKEND_ONLY
REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  [BACKEND ONLY] Starting FastAPI server...
echo.
cd /d "%BACKEND_DIR%"

if not exist "venv" (
    echo  Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet --disable-pip-version-check
alembic upgrade head 2>nul
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
goto :END

REM ════════════════════════════════════════════════════════════════════════════
:FRONTEND_ONLY
REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  [FRONTEND ONLY] Starting React dev server...
echo.
cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    echo  Installing dependencies...
    npm install
)
npm run dev
goto :END

REM ════════════════════════════════════════════════════════════════════════════
:STOP_ALL
REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  Stopping all Smart TASMAC services...
echo.

if %DOCKER_AVAILABLE% equ 1 (
    cd /d "%DOCKER_DIR%"
    docker compose down 2>nul
    echo  [OK] Docker services stopped
)

REM Kill Node.js processes (Vite)
taskkill /f /im node.exe 2>nul
echo  [OK] Node.js processes stopped

REM Kill Python processes (Uvicorn)
taskkill /f /fi "WINDOWTITLE eq Smart TASMAC Backend" 2>nul
echo  [OK] Python processes stopped

echo.
echo  All services stopped.
goto :END

REM ════════════════════════════════════════════════════════════════════════════
:END
REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  கள்ளுண்ணாமை — Chapter 93, Thirukkural 922
echo  "களித்தறியேன் என்பது கைவிடுக — நெஞ்சத்து
echo   வளர்த்தது வாய்க்கும் மதி."
echo  — Thiruvalluvar
echo.
echo  Smart TASMAC © 2025 Tamil Nadu State Marketing Corporation Ltd.
echo  No. 800, Anna Salai, Chennai — 600 002
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause
