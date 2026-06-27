@echo off
chcp 65001 > nul
title 화학공장 수불관리 시스템

echo =========================================
echo  화학공장 수불관리 시스템 시작
echo =========================================
echo.

:: Node.js 설치 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 설치 후 다시 실행하세요.
    pause
    exit /b 1
)

:: 현재 bat 파일 위치 기준으로 경로 설정
set ROOT=%~dp0
set SERVER=%ROOT%server
set CLIENT=%ROOT%client

:: server node_modules 확인 및 설치
if not exist "%SERVER%\node_modules" (
    echo [1/3] 서버 패키지 설치 중...
    cd /d "%SERVER%"
    call npm install
    if %errorlevel% neq 0 (
        echo [오류] 서버 패키지 설치 실패
        pause
        exit /b 1
    )
) else (
    echo [1/3] 서버 패키지 확인 완료
)

:: client node_modules 확인 및 설치
if not exist "%CLIENT%\node_modules" (
    echo [2/3] 클라이언트 패키지 설치 중...
    cd /d "%CLIENT%"
    call npm install
    if %errorlevel% neq 0 (
        echo [오류] 클라이언트 패키지 설치 실패
        pause
        exit /b 1
    )
) else (
    echo [2/3] 클라이언트 패키지 확인 완료
)

:: 데이터 초기화 (data 폴더 없을 때만)
if not exist "%ROOT%data" (
    echo [3/3] 초기 데이터 생성 중...
    cd /d "%SERVER%"
    node src/lib/seed.js
) else (
    echo [3/3] 데이터 폴더 확인 완료
)

echo.
echo =========================================
echo  서버 시작 중...
echo  백엔드  : http://localhost:4000
echo  프론트  : http://localhost:5173
echo =========================================
echo.
echo  [기본 계정]
echo  통합관리자 : admin / admin1234
echo  1공장관리자: admin1 / admin1234
echo  2공장관리자: admin2 / admin1234
echo  팀관리자   : team1 / team1234
echo  사용자     : user1 / user1234
echo.
echo  종료하려면 이 창을 닫으세요.
echo =========================================
echo.

:: 백엔드 서버 새 창으로 실행
start "백엔드 서버 (4000)" cmd /k "cd /d "%SERVER%" && node src/index.js"

:: 잠시 대기 후 프론트엔드 실행
timeout /t 2 /nobreak > nul
start "프론트엔드 (5173)" cmd /k "cd /d "%CLIENT%" && npm run dev"

:: 브라우저 자동 오픈 (3초 후)
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo 브라우저가 자동으로 열립니다.
echo 열리지 않으면 http://localhost:5173 을 직접 입력하세요.
echo.
pause
