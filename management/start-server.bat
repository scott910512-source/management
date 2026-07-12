@echo off
title StockPilot - Server
chcp 65001 >nul

echo =========================================
echo  StockPilot - Starting (production)
echo =========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

set ROOT=%~dp0
set SERVER=%ROOT%server

if not exist "%SERVER%\node_modules" (
    echo [1/3] Installing server packages...
    cd /d "%SERVER%"
    call npm install --no-audit --no-fund
) else (
    echo [1/3] Server packages OK
)

if not exist "%SERVER%\data" (
    echo [2/3] Generating seed data...
    cd /d "%SERVER%"
    node src/lib/seed.js
) else (
    echo [2/3] Data folder OK
)

echo [3/3] Starting server...
echo.
echo =========================================
echo  Open in browser : http://localhost:4000
echo =========================================
echo.
echo  [Default Accounts]
echo  admin  / admin1234  (super admin)
echo  admin1 / admin1234  (plant1 admin)
echo  admin2 / admin1234  (plant2 admin)
echo  team1  / team1234   (viewer)
echo  user1  / user1234   (user)
echo =========================================
echo.

timeout /t 2 /nobreak > nul
start http://localhost:4000

cd /d "%SERVER%"
node src/index.js

pause
