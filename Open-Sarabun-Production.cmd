@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-sarabun.ps1" -Mode start
if errorlevel 1 pause
