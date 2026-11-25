@echo off
title Smoke Watch - Project Presentation Launcher
echo [1/3] Starting Smoke Watch Backend (http://localhost:3000)...
start "Smoke Watch Backend" cmd /k "cd /d D:\SmokeDetect\smoking-watch-dashboard\backend && npm run dev"

echo [2/3] Starting Smoke Watch Frontend (http://localhost:5173)...
start "Smoke Watch Frontend" cmd /k "cd /d D:\SmokeDetect\smoking-watch-dashboard\frontend && npm run dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173/"

echo [3/3] Launching CiRA CORE (open D:\SmokeDetect\lopo.npj inside CiRA CORE)...
set OPENCV_VIDEOIO_PRIORITY_MSMF=0
start "CiRA CORE" cmd /c "set OPENCV_VIDEOIO_PRIORITY_MSMF=0 && cd /d C:\CiRA-CORE\exec && call ciracore.bat"

echo.
echo Ready for presentation!
echo 1. On http://localhost:5173/ click "Reset Demo" if you want to start counts at 0.
echo 2. In CiRA CORE, File -> Load -> D:\SmokeDetect\lopo.npj -> enable AutoRun!
pause
