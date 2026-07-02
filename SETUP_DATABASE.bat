@echo off
SET PGBIN=C:\PROGRA~1\PostgreSQL\18\bin
SET PGPASSWORD=271527

echo [1/4] Creating tasmac_user...
%PGBIN%\psql.exe -U postgres -c "CREATE USER tasmac_user WITH PASSWORD 'tasmac_pass';" 2>nul
echo Done.

echo [2/4] Creating tasmac_db database...
%PGBIN%\psql.exe -U postgres -c "CREATE DATABASE tasmac_db OWNER tasmac_user;" 2>nul
echo Done.

echo [3/4] Granting privileges...
%PGBIN%\psql.exe -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tasmac_db TO tasmac_user;"
%PGBIN%\psql.exe -U postgres -d tasmac_db -c "GRANT ALL ON SCHEMA public TO tasmac_user;"
echo Done.

echo [4/4] Verifying connection as tasmac_user...
SET PGPASSWORD=tasmac_pass
%PGBIN%\psql.exe -U tasmac_user -d tasmac_db -c "SELECT current_user, current_database();"

echo.
echo === Database setup complete! ===
