@echo off
setlocal
rem ---------------------------------------------------------------
rem  VIT Lost and Found Portal - one-time setup for Windows
rem  Double-click this file, or run it from Command Prompt.
rem ---------------------------------------------------------------
cd /d "%~dp0"
title VIT Lost and Found - setup

where node >nul 2>nul
if errorlevel 1 goto :nonode

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 20 goto :oldnode

echo.
echo  Node.js found:
node -v
echo.
echo  [1/3] Installing server packages...
call npm install --prefix server --no-fund --no-audit
if errorlevel 1 goto :fail

echo.
echo  [2/3] Installing web app packages...
call npm install --prefix client --no-fund --no-audit
if errorlevel 1 goto :fail

echo.
echo  [3/3] Creating the database and loading demo data...
call npm run db:reset --prefix server
if errorlevel 1 goto :fail

echo.
echo  ============================================================
echo   Setup complete.
echo   Double-click start.bat to run the app.
echo   Demo login: 24BCE1001   password: Password123
echo  ============================================================
echo.
pause
exit /b 0

:nonode
echo.
echo  Node.js is not installed, or not on your PATH.
echo  Install the LTS version from https://nodejs.org
echo  then close this window and run setup.bat again.
echo.
pause
exit /b 1

:oldnode
echo.
echo  Your Node.js version is too old. This project needs Node 20 or newer.
echo  Install the LTS version from https://nodejs.org and run setup.bat again.
echo.
pause
exit /b 1

:fail
echo.
echo  Setup failed. Scroll up to see the error message.
echo  See the Troubleshooting section in README.md for common fixes.
echo.
pause
exit /b 1
