@echo off
setlocal
cd /d "%~dp0"
node scripts\build-desktop.mjs
if errorlevel 1 (pause & exit /b 1)
echo Build finished. Open Open-Sarabun.cmd.
pause
