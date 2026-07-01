@echo off
chcp 65001 >nul
REM ============================================================================
REM  run-daily-export.bat
REM  ManagePilot - Daily Report(IRM) -> plain CSV (1gongjang + 2gongjang)
REM  폴더 + 키워드로 최신 xlsx 자동 검색. 공백 포함 경로 안전 처리(set "VAR=..").
REM  아래 경로/키워드만 환경에 맞게 수정하세요. (값 안에 따옴표 넣지 말 것!)
REM ============================================================================

set "SCRIPT=%~dp0exportdailyreportcsv.ps1"

REM ── 1gongjang : 파일이 들어있는 "폴더" (따옴표 없이 값만) ─────────────────
set "SRC1DIR=E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\1공장 보드"
set "DST1=C:\ManagePilot\watch\1공장"
set "KW1=Daily,report,1공장"

REM ── 2gongjang ────────────────────────────────────────────────────────────
set "SRC2DIR=E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\2공장 보드"
set "DST2=C:\ManagePilot\watch\2공장"
set "KW2=Daily,report,2공장"

echo [%date% %time%] 1gongjang ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SourceFolder "%SRC1DIR%" -Keywords "%KW1%" -DestFolder "%DST1%"

echo [%date% %time%] 2gongjang ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SourceFolder "%SRC2DIR%" -Keywords "%KW2%" -DestFolder "%DST2%"

echo [%date% %time%] done.
