@echo off
REM ============================================================================
REM  run-daily-export.bat
REM  ManagePilot — 보안 엑셀 -> 평문 CSV 자동 추출 (하루 1회 작업 스케줄러용)
REM  아래 경로 3곳만 본인 환경에 맞게 수정하세요.
REM ============================================================================

REM 이 .bat 와 .ps1 이 같은 폴더에 있다고 가정
set SCRIPT=%~dp0export-daily-report-csv.ps1

REM ── 2공장 ──────────────────────────────────────────────────────────────
set SRC2="E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\2공장 보드\최신 26년_2공장_Daily report_6월.xlsx"
set DST2="C:\ManagePilot\watch\2공장"

REM ── 1공장 (있으면 주석 해제하고 경로 수정) ──────────────────────────────
REM set SRC1="E:\전사 폴더\...\최신 26년_1공장_Daily report_6월.xlsx"
REM set DST1="C:\ManagePilot\watch\1공장"

echo [%date% %time%] 2공장 추출 시작...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Source %SRC2% -DestFolder %DST2%

REM echo [%date% %time%] 1공장 추출 시작...
REM powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Source %SRC1% -DestFolder %DST1%

echo [%date% %time%] 완료.
