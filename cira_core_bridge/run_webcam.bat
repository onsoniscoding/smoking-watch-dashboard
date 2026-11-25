@echo off
title Smoke Watch - CiRA CORE Live Webcam AI (CUDA)
call C:\opt\ros\melodic\x64\setup.bat
C:\opt\ros\melodic\x64\python.exe "D:\SmokeDetect\cira_core_bridge\run_smoking_ai.py" --webcam 0 --camera-id CAM-WEBCAM-01 --camera-name "Webcam Live (CiRA AI)" --cooldown 3.0 --show
pause
