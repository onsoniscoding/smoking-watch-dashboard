# -*- coding: utf-8 -*-
"""
CiRA CORE Non-Freezing Live Webcam Source + Person-ROI Crop Node (`lopo.npj` Row 3)
Replaces CiRA CORE's buggy MSMF C++ `WebCam` node AND upgrades Row 3 to 2-Stage ROI:
  1. Fetches live frames from the shared broker `http://127.0.0.1:3099/raw_frame`,
     receiving `person` + `confounders` (`cup`, `bottle`, `wine glass`, `cell phone`)
     from the broker's `person_coco` detector even when `/webcam` browser tab is closed!
  2. When a person is farther from the webcam (`pw < fw * 0.65`), crops their upper-body
     head/mouth/hand ROI (`_crop_ctx`) so CiRA's single `SMOKING_EVIDENCE` node detects
     small cigarettes accurately while staying within the 4/4 AI model limit!
  3. Falls back cleanly to `cv2.VideoCapture(0, cv2.CAP_DSHOW)` if broker is unavailable.
Pure 7-bit ASCII & forward-slash safe for CiRA CORE `PythonScript`.
"""

import json
import os
import subprocess
import tempfile
import time

import cv2
import numpy as np

try:
    import urllib.request as urllib_request
except ImportError:
    import urllib2 as urllib_request

CAM_INDEX = int(globals().get("CAM_INDEX", 0))
BROKER_URL = "http://127.0.0.1:3099/raw_frame?cam=%d" % CAM_INDEX
TEMP_DIR_SLASH = tempfile.gettempdir().replace("\\", "/")
WEBCAM_SEQ_FILE = TEMP_DIR_SLASH + "/smoke_watch_webcam_seq.txt"


def _next_webcam_slot_path():
    seq = 0
    try:
        if os.path.exists(WEBCAM_SEQ_FILE):
            with open(WEBCAM_SEQ_FILE, "r") as f:
                seq = int(f.read().strip() or "0") + 1
    except Exception:
        seq = int(time.time() * 1000)
    try:
        with open(WEBCAM_SEQ_FILE, "w") as f:
            f.write(str(seq))
    except Exception:
        pass
    slot = seq % 10
    return (TEMP_DIR_SLASH + "/smoke_watch_webcam_full_%d.jpg" % slot).replace("\\", "/")


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
        return pl, frame

    fh, fw = frame.shape[:2]
    person = meta.get("person") if isinstance(meta, dict) else None
    confounders = (meta.get("confounders") or []) if isinstance(meta, dict) else []

    if isinstance(pl, dict):
        if isinstance(person, dict):
            px, py, pw, ph = int(person["x"]), int(person["y"]), int(person["w"]), int(person["h"])
            # When person occupies < 65% of frame width, crop upper-body/head/hand ROI for Stage-2 accuracy!
            if 24 < pw < int(fw * 0.65) and ph > 40:
                cx1 = max(0, int(px - pw * 0.25))
                cy1 = max(0, int(py - ph * 0.08))
                cx2 = min(fw, int(px + pw * 1.45))
                cy2 = min(fh, int(py + ph * 0.80))
                if (cx2 - cx1) > 60 and (cy2 - cy1) > 60:
                    slot_path = _next_webcam_slot_path()
                    cv2.imwrite(slot_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                    cropped = frame[cy1:cy2, cx1:cx2].copy()
                    pl["_crop_ctx"] = {
                        "active": True,
                        "frame_path": slot_path,
                        "crop_x": cx1,
                        "crop_y": cy1,
                        "crop_w": cx2 - cx1,
                        "crop_h": cy2 - cy1,
                        "full_w": fw,
                        "full_h": fh,
                        "person": person,
                        "all_persons": [person],
                        "confounders": confounders,
                    }
                    return pl, cropped

        if person or confounders:
            pl["_webcam_meta"] = {
                "person": person,
                "confounders": confounders,
            }

    return pl, frame


if "payload" in globals():
    payload, img = capture_live_webcam(payload)
