@echo off
chcp 65001 >nul
REM ============================================================================
REM  run-daily-export.bat
REM  ManagePilot - Daily Report(IRM) -> plain CSV (1gongjang + 2gongjang)
REM  Edit the 4 paths below (SRC1/DST1, SRC2/DST2) for your environment.
REM  Then double-click this file, or register it in Task Scheduler (daily).
REM ============================================================================

REM Script is assumed to sit next to this .bat (downloaded name has no dashes)
set SCRIPT=%~dp0exportdailyreportcsv.ps1

REM ── 1gongjang ───────────────────────────────────────────────────────────
set SRC1="E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\1공장 보드\최신 26년_1공장_Daily report_6월.xlsx"
set DST1="C:\ManagePilot\watch\1공장"

REM ── 2gongjang ───────────────────────────────────────────────────────────
set SRC2="E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\2공장 보드\최신 26년_2공장_Daily report_6월.xlsx"
set DST2="C:\ManagePilot\watch\2공장"

echo [%date% %time%] 1gongjang ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Source %SRC1% -DestFolder %DST1%

echo [%date% %time%] 2gongjang ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Source %SRC2% -DestFolder %DST2%

echo [%date% %time%] done.
