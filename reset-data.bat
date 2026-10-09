@echo off
setlocal
rem ---------------------------------------------------------------
rem  VIT Lost and Found Portal - wipe the database and reload demo data
rem ---------------------------------------------------------------
cd /d "%~dp0"
title VIT Lost and Found - reset data

echo.
echo  This deletes every account, post and claim, then reloads the demo data.
choice /c YN /m "  Continue"
if errorlevel 2 exit /b 0

call npm run db:reset --prefix server
echo.
pause
