@echo off
SET PGBIN=C:\PROGRA~1\PostgreSQL\18\bin
SET PGPASSWORD=271527
%PGBIN%\psql.exe -U postgres -d tasmac_db -c "\dt"
