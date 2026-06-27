@echo off
title Smart TASMAC — Database Setup
color 0A

echo.
echo  Smart TASMAC — PostgreSQL Database Setup
echo  ==========================================
echo.

REM ─── Check PostgreSQL ────────────────────────────────────────────────────────
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] psql not found in PATH!
    echo.
    echo  Options:
    echo  1. Install PostgreSQL 15+ from https://www.postgresql.org/download/windows/
    echo  2. Use Docker mode instead (run START_TASMAC.bat and choose option 1)
    echo.
    pause
    exit /b 1
)

echo  [OK] PostgreSQL found
echo.

REM ─── Get connection details ──────────────────────────────────────────────────
set /p "PG_HOST=PostgreSQL Host [localhost]: "
if "%PG_HOST%"=="" set PG_HOST=localhost

set /p "PG_PORT=PostgreSQL Port [5432]: "
if "%PG_PORT%"=="" set PG_PORT=5432

set /p "PG_SUPERUSER=Superuser name [postgres]: "
if "%PG_SUPERUSER%"=="" set PG_SUPERUSER=postgres

echo.
echo  Creating database and user...
echo.

REM ─── Create DB user and database ────────────────────────────────────────────
set "PGPASSWORD="
psql -h %PG_HOST% -p %PG_PORT% -U %PG_SUPERUSER% -c "CREATE USER tasmac_user WITH PASSWORD 'tasmac_pass';" 2>nul
psql -h %PG_HOST% -p %PG_PORT% -U %PG_SUPERUSER% -c "CREATE DATABASE tasmac_db OWNER tasmac_user;" 2>nul
psql -h %PG_HOST% -p %PG_PORT% -U %PG_SUPERUSER% -c "GRANT ALL PRIVILEGES ON DATABASE tasmac_db TO tasmac_user;" 2>nul

echo  [OK] Database user and database created

REM ─── Run init.sql ────────────────────────────────────────────────────────────
set "INIT_SQL=%~dp0docker\init.sql"
if exist "%INIT_SQL%" (
    echo  Running database initialization script...
    set PGPASSWORD=tasmac_pass
    psql -h %PG_HOST% -p %PG_PORT% -U tasmac_user -d tasmac_db -f "%INIT_SQL%"
    if %errorlevel% equ 0 (
        echo  [OK] Database initialized with all 11 tables + seed data
    ) else (
        echo  [ERROR] Failed to run init.sql
    )
) else (
    echo  [WARN] init.sql not found at %INIT_SQL%
)

echo.
echo  ┌─────────────────────────────────────────┐
echo  │  Database Setup Complete!               │
echo  │                                         │
echo  │  Host:     %PG_HOST%                   
echo  │  Port:     %PG_PORT%                   
echo  │  Database: tasmac_db                    │
echo  │  User:     tasmac_user                  │
echo  │  Password: tasmac_pass                  │
echo  └─────────────────────────────────────────┘
echo.
echo  Now run START_TASMAC.bat and choose option [2] (Local Mode)
echo.
pause
