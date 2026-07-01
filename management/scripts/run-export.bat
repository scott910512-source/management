@echo off
REM ManagePilot - launch the export script (no Korean here; edit paths in manage-export.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage-export.ps1"
