@echo off
title Management System

echo =========================================
echo  Management System - Starting...
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
set CLIENT=%ROOT%client

if not exist "%SERVER%\node_modules" (
    echo [1/3] Installing server packages...
    cd /d "%SERVER%"
    call npm install --no-audit --no-fund
    echo [1/3] Server packages installed.
) else (
    echo [1/3] Server packages OK
)

if not exist "%CLIENT%\node_modules" (
    echo [2/3] Installing client packages...
    cd /d "%CLIENT%"
    call npm install --foreground-scripts --no-audit --no-fund
    echo [2/3] Client packages installed.
) else (
    echo [2/3] Client packages OK
)

if not exist "%ROOT%data" (
    echo [3/3] Generating seed data...
    cd /d "%SERVER%"
    node src/lib/seed.js
) else (
    echo [3/3] Data folder OK
)

echo.
echo =========================================
echo  Backend  : http://localhost:4000
echo  Frontend : http://localhost:5173
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

start "Backend (4000)" cmd /k "cd /d "%SERVER%" && node src/index.js"

timeout /t 2 /nobreak > nul

start "Frontend (5173)" cmd /k "cd /d "%CLIENT%" && npm run dev"

timeout /t 3 /nobreak > nul

start http://localhost:5173

echo Browser opening at http://localhost:5173
echo Close this window to keep servers running.
echo.
pause
