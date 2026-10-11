@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0.desktop\runtime\node.exe" (
  echo Desktop package is missing. Run Build-Sarabun.cmd on the development PC first.
  pause
  exit /b 1
)
"%~dp0.desktop\runtime\node.exe" "%~dp0scripts\export-desktop.mjs"
if errorlevel 1 pause
