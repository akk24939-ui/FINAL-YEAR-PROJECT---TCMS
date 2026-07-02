@echo off
title Smart TASMAC — Launcher
color 0A
cls

echo.
echo  ████████╗ █████╗ ███████╗███╗   ███╗ █████╗  ██████╗
echo  ╚══██╔══╝██╔══██╗██╔════╝████╗ ████║██╔══██╗██╔════╝
echo     ██║   ███████║███████╗██╔████╔██║███████║██║
echo     ██║   ██╔══██║╚════██║██║╚██╔╝██║██╔══██║██║
echo     ██║   ██║  ██║███████║██║ ╚═╝ ██║██║  ██║╚██████╗
echo     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝
echo.
echo  Smart TASMAC — Consumer Regulation System
echo  Tamil Nadu State Marketing Corporation Ltd.
echo  ─────────────────────────────────────────────────────
echo.

REM ── Paths ─────────────────────────────────────────────────────────────────
SET ROOT=%~dp0
SET BACKEND=%ROOT%backend
SET FRONTEND=%ROOT%frontend
SET PYTHON=python
SET PGBIN=C:\PROGRA~1\PostgreSQL\18\bin
SET PGPASSWORD=271527

echo  [1/4] Checking PostgreSQL...
%PGBIN%\pg_isready.exe -U postgres >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo  [!] PostgreSQL is not running. Starting service...
    net start postgresql-x64-18 >nul 2>&1
    timeout /t 3 /nobreak >nul
) ELSE (
    echo  [OK] PostgreSQL is running.
)

echo.
echo  [2/4] Starting Backend (FastAPI on port 8000)...
start "TASMAC Backend" cmd /k "cd /d "%BACKEND%" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo  [3/4] Starting Frontend (React on port 5173)...
start "TASMAC Frontend" cmd /k "cd /d "%FRONTEND%" && cmd /c npm run dev"

echo.
echo  [4/4] Waiting for servers to start...
ping 127.0.0.1 -n 7 >nul

echo.
echo  ─────────────────────────────────────────────────────
echo   Opening browser...
echo  ─────────────────────────────────────────────────────
start "" "http://localhost:5173"

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║  Smart TASMAC is now running!                    ║
echo  ║                                                   ║
echo  ║  Frontend  →  http://localhost:5173               ║
echo  ║  API Docs  →  http://localhost:8000/docs          ║
echo  ║  Health    →  http://localhost:8000/health        ║
echo  ╚═══════════════════════════════════════════════════╝
echo.
echo  Two terminal windows have been opened:
echo    - "TASMAC Backend"  (keep this open)
echo    - "TASMAC Frontend" (keep this open)
echo.
echo  To stop: close both terminal windows.
echo.
pause
