@echo off
setlocal
rem ---------------------------------------------------------------
rem  VIT Lost and Found Portal - start the app on Windows
rem  Opens http://localhost:5173 in your browser when ready.
rem  Close this window or press Ctrl+C to stop.
rem ---------------------------------------------------------------
cd /d "%~dp0"
title VIT Lost and Found - running

if not exist "server\node_modules" goto :nosetup
if not exist "client\node_modules" goto :nosetup

node scripts\dev.js --open
pause
exit /b 0

:nosetup
echo.
echo  Packages are not installed yet. Run setup.bat first.
echo.
pause
exit /b 1
