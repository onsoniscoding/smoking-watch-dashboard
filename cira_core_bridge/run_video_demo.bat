@echo off
title Smoke Watch - CiRA CORE 2-Stage High-Accuracy Video Demo
call C:\opt\ros\melodic\x64\setup.bat
C:\opt\ros\melodic\x64\python.exe "D:\SmokeDetect\cira_core_bridge\run_smoking_ai.py" --video "D:/SmokeDetect/gemini_generated_video_bf68e964.mp4" --camera-id CAM-CCTV-01 --camera-name "Corridor CCTV (CiRA 2-Stage)" --show
pause
