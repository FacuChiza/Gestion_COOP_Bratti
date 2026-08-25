@echo off
REM Backup de la base de datos - Cooperadora Bratti
REM Doble clic en este archivo para generar la copia de seguridad.
cd /d "%~dp0.."
node scripts/backup.mjs
echo.
pause
