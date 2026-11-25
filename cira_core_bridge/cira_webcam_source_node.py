# -*- coding: utf-8 -*-
"""
CiRA CORE Non-Freezing Live Webcam Source Node (`lopo.npj` Row 3)
Replaces CiRA CORE's buggy MSMF C++ `WebCam` node (which hangs on USB UVC cameras).
  1. Fetches live 30-FPS frames in ~2ms from the shared broker `http://127.0.0.1:3099/raw_frame`,
     allowing BOTH CiRA CORE and the Web Dashboard (`/webcam`) to use the camera simultaneously!
  2. Auto-starts `webcam_daemon.py` in the background if port 3099 is not running yet.
  3. Falls back cleanly to `cv2.VideoCapture(0, cv2.CAP_DSHOW)` if needed.
Pure 7-bit ASCII & forward-slash safe for CiRA CORE `PythonScript`.
"""

import json
import subprocess
import time

import cv2
import numpy as np

try:
    import urllib.request as urllib_request
except ImportError:
    import urllib2 as urllib_request

CAM_INDEX = int(globals().get("CAM_INDEX", 0))
BROKER_URL = "http://127.0.0.1:3099/raw_frame?cam=%d" % CAM_INDEX


def _fetch_from_broker(timeout_sec=1.2):
    resp = urllib_request.urlopen(BROKER_URL, timeout=timeout_sec)
    raw_jpg = resp.read()
    meta_hdr = None
    try:
        info = resp.info()
        if hasattr(info, "getheader"):
            meta_hdr = info.getheader("X-Webcam-Meta")
        elif hasattr(info, "get"):
            meta_hdr = info.get("X-Webcam-Meta")
    except Exception:
        meta_hdr = None

    arr = np.frombuffer(raw_jpg, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    meta = {}
    if meta_hdr:
        try:
            meta = json.loads(meta_hdr)
        except Exception:
            meta = {}
    return frame, meta


def _spawn_broker_detached():
    try:
        cmd = (
            "call C:/opt/ros/melodic/x64/setup.bat >nul 2>&1 && "
            "C:/opt/ros/melodic/x64/python.exe -u D:/SmokeDetect/cira_core_bridge/webcam_daemon.py"
        )
        # DETACHED_PROCESS (0x00000008) | CREATE_NO_WINDOW (0x08000000)
        subprocess.Popen(
            ["cmd.exe", "/d", "/s", "/c", cmd],
            close_fds=True,
            creationflags=0x08000008,
        )
    except Exception:
        pass


def capture_live_webcam(pl):
    frame = None
    meta = {}

    try:
        frame, meta = _fetch_from_broker(timeout_sec=1.0)
    except Exception:
        _spawn_broker_detached()
        time.sleep(0.65)
        try:
            frame, meta = _fetch_from_broker(timeout_sec=2.0)
        except Exception:
            frame = None

    # DirectShow hardware fallback if broker is unreachable
    if frame is None:
        cap = cv2.VideoCapture(CAM_INDEX, cv2.CAP_DSHOW)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            for _ in range(3):
                ok, frm = cap.read()
                if ok and frm is not None and frm.size > 0:
                    frame = frm
            cap.release()

    if frame is None:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            frame,
            "Webcam Unavailable - Check USB Camera",
            (55, 245),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (80, 80, 240),
            2,
        )

    if isinstance(pl, dict) and isinstance(meta, dict) and (meta.get("person") or meta.get("confounders")):
        pl["_webcam_meta"] = {
            "person": meta.get("person"),
            "confounders": meta.get("confounders") or [],
        }

    return pl, frame


if "payload" in globals():
    payload, img = capture_live_webcam(payload)
