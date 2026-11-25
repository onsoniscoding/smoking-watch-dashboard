# -*- coding: utf-8 -*-
"""
Stage 1.5 CiRA CORE PythonScript Node: AutoPersonCrop
CRITICAL COORDINATE FIX:
  CiRA CORE's native `DeepDetect` node outputs `(x, y)` as `(center_x, center_y)`, NOT `(left_x, top_y)`!
  Converting `left_x = x - w/2`, `top_y = y - h/2` ensures:
    1. Every `person` green box aligns from head to toe.
    2. The Stage-2 ROI crop covers the person's actual head, mouth, hands, and exhaled smoke plume
       (instead of cropping from their waist down!).
    3. All detected people (`all_persons`) are preserved for visualization and background-walker masking.
"""

import json
import os
import tempfile
import time
import cv2

TEMP_DIR_SLASH = tempfile.gettempdir().replace("\\", "/")
RING_SEQ_FILE = TEMP_DIR_SLASH + "/smoke_watch_ring_seq.txt"
CROP_STATE_FILE = TEMP_DIR_SLASH + "/smoke_watch_crop_ctx.json"


def _sanitize_payload(obj):
    if isinstance(obj, dict):
        return dict((k, _sanitize_payload(v)) for k, v in obj.items())
    if isinstance(obj, list):
        return [_sanitize_payload(x) for x in obj]
    if isinstance(obj, str):
        return obj.replace("\\", "/")
    try:
        if isinstance(obj, unicode):
            return obj.replace(u"\\", u"/")
    except NameError:
        pass
    return obj


def _to_topleft(o, fw, fh):
    w = int(o.get("w", 0))
    h = int(o.get("h", 0))
    rx = float(o.get("x", 0))
    ry = float(o.get("y", 0))
    if o.get("is_topleft"):
        lx, ty = int(rx), int(ry)
    else:
        # CiRA CORE DeepDetect outputs center_x, center_y!
        lx = int(round(rx - w * 0.5))
        ty = int(round(ry - h * 0.5))
    lx = max(0, min(fw - 1, lx))
    ty = max(0, min(fh - 1, ty))
    w = min(w, fw - lx)
    h = min(h, fh - ty)
    return lx, ty, w, h


def _next_slot_path():
    seq = 0
    try:
        if os.path.exists(RING_SEQ_FILE):
            with open(RING_SEQ_FILE, "r") as f:
                seq = int(f.read().strip() or "0") + 1
    except Exception:
        seq = int(time.time() * 1000)
    try:
        with open(RING_SEQ_FILE, "w") as f:
            f.write(str(seq))
    except Exception:
        pass
    slot = seq % 10
    return (TEMP_DIR_SLASH + "/smoke_watch_full_%d.jpg" % slot).replace("\\", "/")


def run_person_crop(pl, frame):
    pl = _sanitize_payload(pl)
    if frame is None or frame.size <= 3:
        return pl, frame

    fh, fw = frame.shape[:2]
    slot_path = _next_slot_path()
    cv2.imwrite(slot_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])

    raw_objs = []
    if isinstance(pl, dict):
        dd = pl.get("DeepDetect")
        if isinstance(dd, dict) and isinstance(dd.get("objects"), list):
            raw_objs = dd.get("objects")

    persons = []
    confounders = []
    for o in raw_objs:
        if not isinstance(o, dict):
            continue
        name = str(o.get("name", "")).strip().lower()
        conf = float(o.get("confidence", 0.0))
        if conf > 1.0:
            conf = conf / 100.0
        lx, ty, bw, bh = _to_topleft(o, fw, fh)
        if name == "person" and conf >= 0.25 and bw > 12 and bh > 24:
            persons.append({
                "name": "person",
                "confidence": round(conf, 4),
                "x": lx,
                "y": ty,
                "w": bw,
                "h": bh,
                "is_topleft": True,
            })
        elif name in ("cup", "bottle", "wine glass", "cell phone", "bowl", "toothbrush") and conf >= 0.20:
            confounders.append({
                "name": name,
                "confidence": round(conf, 4),
                "x": lx,
                "y": ty,
                "w": bw,
                "h": bh,
                "is_topleft": True,
            })

    if persons:
        # Sort so largest / foreground person is primary target, while keeping ALL persons for drawing!
        persons.sort(key=lambda p: (p["w"] * p["h"]) * (0.7 + 0.3 * p["confidence"]), reverse=True)
        best = persons[0]
        px, py, pw, ph = best["x"], best["y"], best["w"], best["h"]

        if pw < fw * 0.45:
            # Crop around actual HEAD, MOUTH, HANDS, and EXHALE SMOKE ZONE!
            cx1 = max(0, int(px - pw * 0.30))
            cy1 = max(0, int(py - ph * 0.08))
            cx2 = min(fw, int(px + pw * 1.85))
            cy2 = min(fh, int(py + ph * 0.70))
            if (cx2 - cx1) > 40 and (cy2 - cy1) > 40:
                cropped = frame[cy1:cy2, cx1:cx2].copy()
                ctx = {
                    "active": True,
                    "frame_path": slot_path,
                    "crop_x": cx1,
                    "crop_y": cy1,
                    "crop_w": cx2 - cx1,
                    "crop_h": cy2 - cy1,
                    "full_w": fw,
                    "full_h": fh,
                    "person": best,
                    "all_persons": persons,
                    "confounders": confounders,
                }
                if isinstance(pl, dict):
                    pl["_crop_ctx"] = ctx
                with open(CROP_STATE_FILE, "w") as f:
                    json.dump(ctx, f)
                return pl, cropped

        ctx = {
            "active": False,
            "frame_path": slot_path,
            "crop_x": 0,
            "crop_y": 0,
            "full_w": fw,
            "full_h": fh,
            "person": best,
            "all_persons": persons,
            "confounders": confounders,
        }
        if isinstance(pl, dict):
            pl["_crop_ctx"] = ctx
        with open(CROP_STATE_FILE, "w") as f:
            json.dump(ctx, f)
        return pl, frame

    ctx = {
        "active": False,
        "frame_path": slot_path,
        "crop_x": 0,
        "crop_y": 0,
        "person": None,
        "all_persons": [],
        "confounders": confounders,
    }
    if isinstance(pl, dict):
        pl["_crop_ctx"] = ctx
    with open(CROP_STATE_FILE, "w") as f:
        json.dump(ctx, f)
    return pl, frame


if "payload" in globals():
    _in_img = globals().get("img", None)
    payload, img = run_person_crop(payload, _in_img)
