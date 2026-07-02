@echo off
chcp 65001 >nul
REM ============================================================================
REM  run-daily-export.bat
REM  ManagePilot - Daily Report(IRM) -> plain CSV (1gongjang + 2gongjang)
REM  공유폴더가 "목록 조회"를 막으므로, 폴더 검색 대신
REM  파일명을 현재 월로 직접 만들어 엽니다.  {M}=월, {YY}=연도 두자리.
REM  (현재월 파일이 없으면 전월/전전월 자동 시도)
REM
REM  아래 -Source 경로의 고정 부분만 실제 파일명 형식에 맞게 수정하세요.
REM  예) 실제 파일명이  "최신 26년_2공장_Daily report_7월.xlsx" 이면
REM      _7월 자리에 {M}월, 26년 자리에 {YY}년 을 넣습니다.
REM ============================================================================

set "SCRIPT=%~dp0exportdailyreportcsv.ps1"

REM ── 1gongjang ─────────────────────────────────────────────────────────────
set "SRC1=E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\1공장 보드\최신 {YY}년_1공장_Daily report_{M}월.xlsx"
set "DST1=C:\ManagePilot\watch\1공장"

REM ── 2gongjang ─────────────────────────────────────────────────────────────
set "SRC2=E:\전사 폴더\채널 문서함\SKTC\MIG_SK트리켐 생산팀\2공장 보드\최신 {YY}년_2공장_Daily report_{M}월.xlsx"
set "DST2=C:\ManagePilot\watch\2공장"

echo [%date% %time%] 1gongjang ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Source "%SRC1%" -DestFolder "%DST1%"

echo [%date% %time%] 2gongjang ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Source "%SRC2%" -DestFolder "%DST2%"

echo [%date% %time%] done.
