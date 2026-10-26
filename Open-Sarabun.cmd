@echo off
cd /d "%~dp0"
node scripts/open-local.mjs
if errorlevel 1 pause
