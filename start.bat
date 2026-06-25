@echo off
title TSMusicBot

:: Check node
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Run scripts\setup.bat first.
    pause
    exit /b 1
)

echo Starting TSMusicBot...
echo WebUI: http://localhost:3000
echo Press Ctrl+C to stop.
echo.

node dist\index.js

pause