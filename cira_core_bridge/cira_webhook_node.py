# -*- coding: utf-8 -*-
"""
High-Accuracy CiRA CORE -> Smoke Watch Dashboard Webhook Bridge (v2)
Features:
  1. Restores full CCTV frame & maps Stage-2 Person-ROI crop coordinates back to global frame
  2. Exhaled Smoke-Plume Optical Analyzer (detects semi-transparent exhaled smoke clouds near head)
  3. Multi-Frame Temporal Consensus Filter (eliminates single-frame false positives & boosts precision)
  4. Precision Face Blur (anonymizes face while keeping cigarette & smoke evidence clearly visible)
  5. Sends verified events + face-blurred evidence JPEG to http://localhost:3000/api/webhook/detection
"""

import base64
import datetime
import json
import os
import tempfile
import time
import uuid

import cv2
import numpy as np

try:
    import urllib.request as urllib_request
except ImportError:
    import urllib2 as urllib_request

CAMERA_PRESETS = {
    "corridor": u"\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e42\u0e16\u0e07\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e19\u0e2d\u0e32\u0e04\u0e32\u0e23 (CiRA AI)",
    "image_test": u"\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e17\u0e14\u0e2a\u0e2d\u0e1a\u0e20\u0e32\u0e1e\u0e19\u0e34\u0e48\u0e07 (CiRA AI)",
    "webcam": u"\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e41\u0e04\u0e21\u0e2a\u0e14 (CiRA AI)",
}

API_BASE_URL = globals().get("API_BASE_URL", os.environ.get("SMOKE_WATCH_API", "http://localhost:3000/api"))
AI_WEBHOOK_KEY = globals().get("AI_WEBHOOK_KEY", os.environ.get("AI_WEBHOOK_KEY", ""))
CAMERA_ID = globals().get("CAMERA_ID", "CAM-CIRA-01")
_preset_key = globals().get("CAMERA_PRESET", "")
CAMERA_NAME = CAMERA_PRESETS.get(_preset_key, globals().get("CAMERA_NAME", CAMERA_PRESETS["corridor"]))
COOLDOWN_SEC = float(globals().get("COOLDOWN_SEC", 4.0))
MIN_TEMPORAL_HITS = int(globals().get("MIN_TEMPORAL_HITS", 2))
HEARTBEAT_INTERVAL_SEC = 10.0

TEMP_DIR_SLASH = tempfile.gettempdir().replace("\\", "/")
STATE_FILE = TEMP_DIR_SLASH + "/smoke_watch_cira_state_v2.json"
CROP_STATE_FILE = TEMP_DIR_SLASH + "/smoke_watch_crop_ctx.json"
FULL_FRAME_FILE = TEMP_DIR_SLASH + "/smoke_watch_full_frame.jpg"
PREV_GRAY_FILE = TEMP_DIR_SLASH + "/smoke_watch_prev_gray_" + CAMERA_ID + ".png"


def _load_state():
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {"last_heartbeat": 0.0, "last_sent": {}, "history": {}}


def _save_state(state):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass


def _post_json(url, data_dict, api_key=""):
    # ensure_ascii=True guarantees pure ASCII JSON escape sequences (\u0e01...) across Python 2 & 3!
    body = json.dumps(data_dict, ensure_ascii=True).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key
    req = urllib_request.Request(url, data=body, headers=headers)
    resp = urllib_request.urlopen(req, timeout=4)
    raw = resp.read()
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


def _iso_now_bkk():
    utc_now = datetime.datetime.utcnow()
    bkk_now = utc_now + datetime.timedelta(hours=7)
    return bkk_now.strftime("%Y-%m-%dT%H:%M:%S+07:00")


def _blur_region(frame, x1, y1, x2, y2):
    h, w = frame.shape[:2]
    x1 = max(0, min(w - 1, int(x1)))
    y1 = max(0, min(h - 1, int(y1)))
    x2 = max(0, min(w, int(x2)))
    y2 = max(0, min(h, int(y2)))
    if x2 - x1 > 4 and y2 - y1 > 4:
        roi = frame[y1:y2, x1:x2]
        k = max(15, ((min(x2 - x1, y2 - y1) // 2) | 1))
        if k % 2 == 0:
            k += 1
        frame[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (k, k), 30)


def _detect_exhaled_plume(full_frame, person_box, all_persons=None):
    """
    Detects dynamic semi-transparent exhaled smoke mist STRICTLY at head/mouth height (`top_y .. top_y + 0.26*ph`),
    while masking out all detected people (`all_persons`) so background walkers are NEVER mistaken for smoke!
    """
    if full_frame is None or person_box is None:
        return None

    fh, fw = full_frame.shape[:2]
    gray = cv2.cvtColor(full_frame, cv2.COLOR_BGR2GRAY)
    prev_gray = None
    if os.path.exists(PREV_GRAY_FILE):
        prev_gray = cv2.imread(PREV_GRAY_FILE, cv2.IMREAD_GRAYSCALE)
    cv2.imwrite(PREV_GRAY_FILE, gray)

    if prev_gray is None or prev_gray.shape != gray.shape:
        return None

    px, py, pw, ph = person_box["x"], person_box["y"], person_box["w"], person_box["h"]
    # Head & mouth exhale zone ONLY (top_y - 4% to top_y + 26% of person height!)
    zx1 = max(0, int(px - pw * 0.50))
    zy1 = max(0, int(py - ph * 0.04))
    zx2 = min(fw, int(px + pw * 2.15))
    zy2 = min(fh, int(py + ph * 0.26))
    if zx2 - zx1 < 30 or zy2 - zy1 < 20:
        return None

    roi_bgr = full_frame[zy1:zy2, zx1:zx2]
    roi_gray = gray[zy1:zy2, zx1:zx2].astype(np.int16)
    roi_prev = prev_gray[zy1:zy2, zx1:zx2].astype(np.int16)
    hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)

    diff_pos = roi_gray - roi_prev
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    mask = ((diff_pos >= 8) & (diff_pos <= 85) & (sat <= 52) & (val >= 115)).astype(np.uint8) * 255

    # Mask out ALL detected persons' solid head/body regions so walking people never trigger false smoke!
    plist = all_persons if all_persons else [person_box]
    for p in plist:
        mx1 = max(0, int(p["x"] + p["w"] * 0.12) - zx1)
        mx2 = min(zx2 - zx1, int(p["x"] + p["w"] * 0.88) - zx1)
        my1 = max(0, int(p["y"]) - zy1)
        my2 = min(zy2 - zy1, int(p["y"] + p["h"]) - zy1)
        if mx2 > mx1 and my2 > my1:
            mask[my1:my2, mx1:mx2] = 0

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

    plume_pixels = int(np.count_nonzero(mask))
    zone_area = float((zx2 - zx1) * (zy2 - zy1))
    ratio = plume_pixels / max(1.0, zone_area)

    if plume_pixels >= 260 and 0.015 <= ratio <= 0.65:
        ys, xs = np.where(mask > 0)
        bx1, by1 = int(np.min(xs)) + zx1, int(np.min(ys)) + zy1
        bx2, by2 = int(np.max(xs)) + zx1, int(np.max(ys)) + zy1
        plume_conf = min(0.92, 0.62 + ratio * 1.4)
        return {
            "name": "smoke",
            "confidence": round(plume_conf, 4),
            "x": bx1,
            "y": by1,
            "w": max(20, bx2 - bx1),
            "h": max(20, by2 - by1),
            "is_topleft": True,
        }
    return None


def _apply_precision_face_blur(frame, person_box, smoking_objs):
    if frame is None or frame.size <= 3:
        return frame, True

    out = frame.copy()
    blurred = 0

    # 1. Try Haar face detector first
    cascade_paths = []
    if hasattr(cv2, "data") and hasattr(cv2.data, "haarcascades"):
        cascade_paths.append(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    cascade_paths.append("C:/opt/ros/melodic/x64/etc/haarcascades/haarcascade_frontalface_default.xml")

    gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
    for cp in cascade_paths:
        if os.path.exists(cp):
            clf = cv2.CascadeClassifier(cp)
            if not clf.empty():
                faces = clf.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(22, 22))
                for (fx, fy, fw, fh) in faces:
                    # Keep lower mouth/cigarette clear if cigarette overlaps bottom of face box
                    blur_h = int(fh * 0.78)
                    _blur_region(out, fx, fy, fx + fw, fy + blur_h)
                    blurred += 1
            break

    # 2. Person-box upper-face blur (eyes/nose zone: top 17% of person bbox, avoiding hands/cigarette)
    if blurred == 0 and person_box is not None:
        px, py, pw, ph = person_box["x"], person_box["y"], person_box["w"], person_box["h"]
        fx1 = int(px + pw * 0.24)
        fx2 = int(px + pw * 0.76)
        fy1 = int(py + ph * 0.02)
        fy2 = int(py + ph * 0.17)
        _blur_region(out, fx1, fy1, fx2, fy2)
        blurred += 1

    # 3. Close-up cropped-head fallback
    if blurred == 0:
        for obj in smoking_objs:
            if obj["name"] in ("smoking_person", "smoker"):
                bx, by, bw, bh = obj["x"], obj["y"], obj["w"], obj["h"]
                _blur_region(out, bx + int(bw * 0.2), by, bx + int(bw * 0.8), by + max(14, int(bh * 0.22)))
                blurred += 1
        if blurred == 0:
            for obj in smoking_objs:
                if obj["name"] == "cigarette":
                    cx, cy, cw, ch = obj["x"], obj["y"], max(20, obj["w"]), max(14, obj["h"])
                    _blur_region(out, cx - cw, max(0, cy - ch * 4), cx + cw * 2, max(4, cy - 6))
                    blurred += 1

    return out, True


def _draw_clean_boxes(frame, person_box, smoking_objs, all_persons=None):
    vis = frame.copy()
    plist = all_persons if all_persons else ([person_box] if person_box is not None else [])
    for pb in plist:
        px, py, pw, ph = pb["x"], pb["y"], pb["w"], pb["h"]
        cv2.rectangle(vis, (px, py), (px + pw, py + ph), (16, 185, 129), 2)
        plab = "person %.0f%%" % (pb["confidence"] * 100.0)
        cv2.rectangle(vis, (px, max(0, py - 24)), (px + 125, py), (16, 185, 129), -1)
        cv2.putText(vis, plab, (px + 6, max(16, py - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    palette = {
        "cigarette": (0, 120, 255),
        "smoke": (36, 36, 235),
        "smoking_person": (0, 140, 255),
        "smoker": (0, 140, 255),
    }
    for o in smoking_objs:
        x, y, w, h = o["x"], o["y"], o["w"], o["h"]
        color = palette.get(o["name"], (0, 180, 255))
        cv2.rectangle(vis, (x, y), (x + w, y + h), color, 2)
        lbl = "%s %.0f%%" % (o["name"], o["confidence"] * 100.0)
        ty = max(24, y)
        cv2.rectangle(vis, (x, ty - 24), (x + max(130, len(lbl) * 10), ty), color, -1)
        cv2.putText(vis, lbl, (x + 5, ty - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    return vis


def process_cira_frame(pl, frame):
    now = time.time()
    state = _load_state()

    if now - float(state.get("last_heartbeat", 0.0)) >= HEARTBEAT_INTERVAL_SEC:
        try:
            _post_json(API_BASE_URL + "/system/heartbeat", {}, AI_WEBHOOK_KEY)
            state["last_heartbeat"] = now
        except Exception:
            pass

    # Pop optional shared webcam broker metadata (always remove so payload stays clean)
    webcam_meta = pl.pop("_webcam_meta", None) if isinstance(pl, dict) else None

    # Check if Stage 1.5 AutoPersonCrop was active (ONLY on Corridor 2-stage flow!)
    crop_ctx = globals().get("DIRECT_CROP_CTX", None)
    if crop_ctx is None and isinstance(pl, dict) and isinstance(pl.get("_crop_ctx"), dict):
        crop_ctx = pl.get("_crop_ctx")
    if crop_ctx is None and _preset_key == "corridor" and os.path.exists(CROP_STATE_FILE):
        try:
            if now - os.path.getmtime(CROP_STATE_FILE) < 10.0:
                with open(CROP_STATE_FILE, "r") as f:
                    crop_ctx = json.load(f)
        except Exception:
            crop_ctx = None

    offset_x = 0
    offset_y = 0
    person_box = globals().get("DIRECT_PERSON_BOX", None)
    all_persons = None
    confounders = globals().get("DIRECT_CONFOUNDERS", []) or []
    full_frame = frame

    if isinstance(webcam_meta, dict):
        if person_box is None and isinstance(webcam_meta.get("person"), dict):
            person_box = webcam_meta.get("person")
        if not confounders and isinstance(webcam_meta.get("confounders"), list):
            confounders = webcam_meta.get("confounders")

    if isinstance(crop_ctx, dict):
        if person_box is None:
            person_box = crop_ctx.get("person")
        all_persons = crop_ctx.get("all_persons")
        if not confounders:
            confounders = crop_ctx.get("confounders", []) or []
        fpath = crop_ctx.get("frame_path", FULL_FRAME_FILE)
        if crop_ctx.get("active") and fpath and os.path.exists(fpath):
            offset_x = int(crop_ctx.get("crop_x", 0))
            offset_y = int(crop_ctx.get("crop_y", 0))
            restored = cv2.imread(fpath)
            if restored is not None:
                full_frame = restored

    # Safety fallback if person_box came in raw CiRA center-coordinate format
    if isinstance(person_box, dict) and not person_box.get("is_topleft"):
        pw_tmp = int(person_box.get("w", 0))
        ph_tmp = int(person_box.get("h", 0))
        person_box = dict(person_box)
        person_box["x"] = max(0, int(round(person_box.get("x", 0) - pw_tmp * 0.5)))
        person_box["y"] = max(0, int(round(person_box.get("y", 0) - ph_tmp * 0.5)))
        person_box["is_topleft"] = True

    # Extract detections and map crop coordinates to full CCTV coordinates
    raw_objs = []
    if isinstance(pl, dict):
        dd = pl.get("DeepDetect")
        if isinstance(dd, dict) and isinstance(dd.get("objects"), list):
            raw_objs.extend(dd.get("objects"))
        if isinstance(pl.get("objects"), list):
            raw_objs.extend(pl.get("objects"))

    min_cig_conf = float(globals().get("MIN_CIG_CONF", 0.35))
    min_smoke_conf = float(globals().get("MIN_SMOKE_CONF", 0.35))
    strict_webcam = bool(globals().get("STRICT_WEBCAM", False))

    smoking_objs = []
    for item in raw_objs:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip().lower()
        if name == "cigar":
            name = "cigarette"
        elif name == "smoking":
            name = "smoking_person"
        if name not in ("smoking_person", "smoker", "cigarette", "smoke"):
            continue
        raw_c = float(item.get("confidence", 0.0))
        conf = raw_c / 100.0 if raw_c > 1.0 else raw_c
        conf = max(0.0, min(1.0, conf))

        req_c = min_smoke_conf if name == "smoke" else min_cig_conf
        if conf < req_c:
            continue

        gw = int(item.get("w", 0))
        gh = int(item.get("h", 0))
        rx = float(item.get("x", 0))
        ry = float(item.get("y", 0))
        if item.get("is_topleft"):
            local_lx, local_ty = int(rx), int(ry)
        else:
            # CiRA CORE DeepDetect outputs (center_x, center_y)! Convert to (left_x, top_y)!
            local_lx = int(round(rx - gw * 0.5))
            local_ty = int(round(ry - gh * 0.5))

        gx = max(0, local_lx + (0 if item.get("global_coords") else offset_x))
        gy = max(0, local_ty + (0 if item.get("global_coords") else offset_y))

        # Reject vertical straw-like or giant boxes misclassified as cigarette
        if name == "cigarette":
            if gh > gw * 2.2:
                continue
            if person_box is not None and (gw > person_box["w"] * 0.45 or gh > person_box["h"] * 0.25):
                continue

        # Spatial sanity filter: cigarette/smoker must be inside person's face/hand zone (not background wall/window!)
        if person_box is not None and name in ("cigarette", "smoker", "smoking_person"):
            px, py, pw, ph = person_box["x"], person_box["y"], person_box["w"], person_box["h"]
            cx_mid = gx + gw * 0.5
            cy_mid = gy + gh * 0.5
            if strict_webcam:
                if not (px + pw * 0.08 <= cx_mid <= px + pw * 0.92 and py + ph * 0.08 <= cy_mid <= py + ph * 0.88):
                    continue
            else:
                if not (px - pw * 0.35 <= cx_mid <= px + pw * 1.35 and py - ph * 0.10 <= cy_mid <= py + ph * 0.85):
                    continue

        smoking_objs.append({
            "name": name,
            "confidence": round(conf, 4),
            "x": gx,
            "y": gy,
            "w": gw,
            "h": gh,
            "is_topleft": True,
        })

    # Cup / Bottle / Cell-phone Confounder Suppression:
    has_real_smoke = any(o["name"] == "smoke" for o in smoking_objs)
    if confounders and not has_real_smoke:
        smoking_objs = [o for o in smoking_objs if o["confidence"] >= 0.82]

    # Dynamic Exhaled Smoke-Plume Verification at HEAD height, masking out all walking people!
    plume_obj = None
    if not strict_webcam:
        plume_obj = _detect_exhaled_plume(full_frame, person_box, all_persons=all_persons)
    if plume_obj is not None and (smoking_objs or person_box is not None):
        hist_recent = state.get("history", {}).get(CAMERA_ID, [])
        had_recent_cig = any((now - h.get("t", 0)) < 4.0 and h.get("has_cig") for h in hist_recent)
        if any(o["name"] in ("cigarette", "smoker", "smoking_person") for o in smoking_objs) or had_recent_cig or plume_obj["confidence"] >= 0.65:
            smoking_objs.append(plume_obj)

    # Update rolling temporal history for multi-frame consensus
    cam_hist = [h for h in state.get("history", {}).get(CAMERA_ID, []) if (now - h.get("t", 0.0)) <= 4.5]
    if not smoking_objs:
        state.setdefault("history", {})[CAMERA_ID] = cam_hist
        _save_state(state)
        pl["SmokeWatch"] = {"detected": False, "sent": False}
        return pl, full_frame

    has_smoke = any(o["name"] == "smoke" for o in smoking_objs)
    has_cig = any(o["name"] == "cigarette" for o in smoking_objs)
    has_smoker = any(o["name"] in ("smoking_person", "smoker") for o in smoking_objs)
    frame_peak_conf = max(o["confidence"] for o in smoking_objs)

    cam_hist.append({
        "t": now,
        "conf": frame_peak_conf,
        "has_smoke": has_smoke,
        "has_cig": has_cig,
        "has_smoker": has_smoker,
    })
    state.setdefault("history", {})[CAMERA_ID] = cam_hist

    # Draw sharp detection boxes directly on original unblurred frame (all persons green, smoke red!)
    face_blurred = False
    final_vis = _draw_clean_boxes(full_frame, person_box, smoking_objs, all_persons=all_persons)

    # Temporal consensus check (in strict webcam mode, ALWAYS require MIN_TEMPORAL_HITS even on high conf!)
    if strict_webcam:
        required_hits = MIN_TEMPORAL_HITS
    else:
        required_hits = 1 if (COOLDOWN_SEC <= 0.0 or frame_peak_conf >= 0.78) else MIN_TEMPORAL_HITS
    if len(cam_hist) < required_hits:
        _save_state(state)
        pl["SmokeWatch"] = {
            "detected": True,
            "sent": False,
            "reason": "verifying_multi_frame (%d/%d)" % (len(cam_hist), required_hits),
            "confidence": frame_peak_conf,
        }
        return pl, final_vis

    # Aggregate confidence & Smoke-Mandatory Gate across the verified multi-frame window
    window_smoke = any(h.get("has_smoke") for h in cam_hist)
    window_cig = any(h.get("has_cig") for h in cam_hist)
    window_smoker = any(h.get("has_smoker") for h in cam_hist) or (person_box is not None)
    if strict_webcam:
        smoke_gate = bool(window_smoke or (window_cig and max(h.get("conf", 0.0) for h in cam_hist) >= 0.75 and not confounders))
    else:
        smoke_gate = bool(window_smoke or (window_cig and window_smoker and len(cam_hist) >= 2))

    # Multi-model / multi-frame corroborated confidence boost (clamped <= 0.98)
    peak_conf = max(h.get("conf", 0.0) for h in cam_hist)
    corroboration_bonus = 0.05 if (window_smoke and window_cig) else (0.03 if len(cam_hist) >= 2 else 0.0)
    reported_conf = min(0.98, round(peak_conf + corroboration_bonus, 4))

    last_sent_map = state.get("last_sent", {})
    last_ts = float(last_sent_map.get(CAMERA_ID, 0.0))
    if COOLDOWN_SEC > 0 and (now - last_ts) < COOLDOWN_SEC:
        _save_state(state)
        pl["SmokeWatch"] = {
            "detected": True,
            "sent": False,
            "reason": "cooldown",
            "smoke_mandatory_gate": smoke_gate,
            "confidence": reported_conf,
        }
        return pl, final_vis

    evidence_b64 = ""
    if final_vis is not None and final_vis.size > 3:
        ok, buf = cv2.imencode(".jpg", final_vis, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        if ok:
            b64_bytes = base64.b64encode(buf.tobytes())
            evidence_b64 = b64_bytes.decode("ascii") if isinstance(b64_bytes, bytes) else str(b64_bytes)

    short_uid = uuid.uuid4().hex[:6].upper()
    event_id = "EVT-CIRA-" + time.strftime("%H%M%S") + "-" + short_uid

    det_summary = []
    if person_box is not None:
        det_summary.append({"name": "person", "confidence": person_box["confidence"]})
    for o in smoking_objs:
        det_summary.append({"name": o["name"], "confidence": o["confidence"]})

    webhook_payload = {
        "event_id": event_id,
        "timestamp": _iso_now_bkk(),
        "event_type": "smoking",
        "confidence": reported_conf,
        "camera_id": CAMERA_ID,
        "camera_name": CAMERA_NAME,
        "face_blurred": bool(face_blurred),
        "smoke_mandatory_gate": smoke_gate,
        "evidence_base64": evidence_b64,
        "detected_objects": det_summary,
        "source": "CiRA CORE 2-Stage ROI Ensemble",
    }

    try:
        resp = _post_json(API_BASE_URL + "/webhook/detection", webhook_payload, AI_WEBHOOK_KEY)
        last_sent_map[CAMERA_ID] = now
        state["last_sent"] = last_sent_map
        state["last_heartbeat"] = now
        _save_state(state)

        banner = "VERIFIED -> %s | Gate:%s | Conf:%.1f%%" % (
            event_id,
            "PASSED" if smoke_gate else "CHECK",
            reported_conf * 100.0,
        )
        cv2.rectangle(final_vis, (10, 10), (min(final_vis.shape[1] - 10, 650), 46), (16, 120, 72), -1)
        cv2.putText(final_vis, banner, (18, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2)

        pl["SmokeWatch"] = {
            "detected": True,
            "sent": True,
            "event_id": event_id,
            "smoke_mandatory_gate": smoke_gate,
            "confidence": reported_conf,
            "backend_message": resp.get("message", "ok"),
        }
    except Exception as exc:
        _save_state(state)
        pl["SmokeWatch"] = {"detected": True, "sent": False, "error": str(exc)}

    if isinstance(pl, dict) and "_crop_ctx" in pl:
        del pl["_crop_ctx"]
    return pl, final_vis


if "payload" in globals():
    _in_img = globals().get("img", None)
    payload, img = process_cira_frame(payload, _in_img)
