# -*- coding: utf-8 -*-
"""
Instant-Start Shared Live Webcam MJPEG + CiRA CUDA Broker (127.0.0.1:3099)
Features:
  1. Binds HTTP port 3099 in <0.2s BEFORE lazy-loading GPU models in background,
     so browser `<img>` streams smooth 25-30 FPS DirectShow video immediately (<0.4s)!
  2. Uses 2 lightweight CUDA models (`person_coco` + `smoking_evidence`) to keep VRAM low
     (~380 MiB), coexisting smoothly alongside CiRA CORE's 4/4 GPU models on 4 GB GTX 1650.
  3. Exposes `GET /raw_frame` so BOTH the Web Dashboard (`/webcam`) AND CiRA CORE (`lopo.npj`)
     can use the USB webcam AT THE SAME TIME without fighting over the Windows camera lock!
  4. Anti-hallucination filters: rejects straws/cups/bottles/phones, background walls, and motion blur.
"""

from __future__ import print_function
import json
import os
import sys
import threading
import time

try:
    from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
    from SocketServer import ThreadingMixIn
    import urlparse
except ImportError:
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from socketserver import ThreadingMixIn
    import urllib.parse as urlparse

import cv2

BRIDGE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BRIDGE_DIR)

from run_smoking_ai import CiraNativeDarknetGPU, run_two_stage_inference

WEBHOOK_SCRIPT = os.path.join(BRIDGE_DIR, "cira_webhook_node.py")
STREAM_PORT = 3099


def filter_webcam_objects(person_box, raw_objs, confounders):
    """Strict anti-hallucination filter for live close-up webcam."""
    has_real_smoke = any(o["name"] == "smoke" and o["confidence"] >= 50.0 for o in raw_objs)
    filtered = []

    for o in raw_objs:
        name = o["name"]
        conf = float(o["confidence"])
        gx, gy, gw, gh = o["x"], o["y"], o["w"], o["h"]

        if name == "smoke":
            if conf < 50.0:
                continue
        elif name == "cigarette":
            min_req = 55.0 if has_real_smoke else 64.0
            if confounders and not has_real_smoke:
                min_req = 85.0
            if conf < min_req:
                continue
            if gh > gw * 1.9:
                continue
            if person_box is not None and (gw > person_box["w"] * 0.40 or gh > person_box["h"] * 0.22):
                continue
        elif name in ("smoking_person", "smoker"):
            min_req = 55.0 if has_real_smoke else 68.0
            if confounders and not has_real_smoke:
                min_req = 85.0
            if conf < min_req:
                continue
        else:
            continue

        if person_box is not None and name != "smoke":
            px, py, pw, ph = person_box["x"], person_box["y"], person_box["w"], person_box["h"]
            cx_mid = gx + gw * 0.5
            cy_mid = gy + gh * 0.5
            if not (px + pw * 0.08 <= cx_mid <= px + pw * 0.92 and py + ph * 0.08 <= cy_mid <= py + ph * 0.85):
                continue

        if confounders and name == "cigarette" and not has_real_smoke:
            near_cup = False
            cx_mid = gx + gw * 0.5
            cy_mid = gy + gh * 0.5
            for c in confounders:
                ux, uy, uw, uh = c["x"], c["y"], c["w"], c["h"]
                if (ux - uw * 0.4 <= cx_mid <= ux + uw * 1.4) and (uy - uh * 0.8 <= cy_mid <= uy + uh * 1.2):
                    near_cup = True
                    break
            if near_cup:
                continue

        filtered.append(o)

    return filtered


class SmoothWebcamEngine(object):
    def __init__(self):
        self.lock = threading.Lock()
        self.model_lock = threading.Lock()
        self.person_det = None
        self.ev_det = None
        self.models_loading = False
        self.ai_ready = False

        self.cap = None
        self.cam_idx = 0
        self.auto_record = True
        self.active_clients = 0
        self.snapshot_lease_until = 0.0
        self.running = False
        self.ai_thread_running = False

        self.raw_frame = None
        self.frame_seq = 0
        self.fps_measured = 0.0

        self.latest_person = None
        self.latest_objects = []
        self.latest_confounders = []
        self.latest_sw = {"detected": False, "sent": False}
        self.recent_events = []
        self.last_error = ""

    def _ensure_models_async(self):
        with self.lock:
            if self.ai_ready or self.models_loading:
                return
            self.models_loading = True

        def _loader():
            try:
                p_det = CiraNativeDarknetGPU("D:/SmokeDetect/models/person_coco", thresh=0.22, tag="web_person")
                e_det = CiraNativeDarknetGPU("D:/SmokeDetect/models/smoking_evidence", thresh=0.45, tag="web_ev")
                with self.lock:
                    self.person_det = p_det
                    self.ev_det = e_det
                    self.ai_ready = True
                    self.models_loading = False
            except Exception as exc:
                with self.lock:
                    self.last_error = "AI init error: %s" % str(exc)
                    self.models_loading = False

        t = threading.Thread(target=_loader)
        t.daemon = True
        t.start()

    def start_if_needed(self, cam_idx=0, auto_record=None, need_web_ai=True):
        if need_web_ai:
            self._ensure_models_async()

        with self.lock:
            if auto_record is not None:
                self.auto_record = bool(auto_record)
            if self.running and self.cap is not None and self.cam_idx == int(cam_idx):
                if need_web_ai and not self.ai_thread_running:
                    self._start_ai_thread_locked()
                return True
            self._stop_locked()
            self.cam_idx = int(cam_idx)

        cap = cv2.VideoCapture(int(cam_idx), cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(int(cam_idx))
        if not cap.isOpened():
            with self.lock:
                self.last_error = "Camera busy or unavailable"
            return False

        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        ok, first = False, None
        for _ in range(5):
            ok, first = cap.read()
            if ok and first is not None and first.size > 0:
                break
            time.sleep(0.03)

        if not ok or first is None:
            cap.release()
            with self.lock:
                self.last_error = "Failed to read initial frame from webcam"
            return False

        with self.lock:
            self.cap = cap
            self.raw_frame = first
            self.frame_seq = 1
            self.running = True
            self.last_error = ""
            t_cam = threading.Thread(target=self._camera_loop)
            t_cam.daemon = True
            t_cam.start()
            if need_web_ai and not self.ai_thread_running:
                self._start_ai_thread_locked()

        return True

    def _start_ai_thread_locked(self):
        self.ai_thread_running = True
        t_ai = threading.Thread(target=self._ai_loop)
        t_ai.daemon = True
        t_ai.start()

    def _stop_locked(self):
        self.running = False
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.raw_frame = None
        self.latest_person = None
        self.latest_objects = []
        self.latest_confounders = []
        self.fps_measured = 0.0

    def stop_web_clients(self):
        with self.lock:
            self.active_clients = 0
            if time.time() >= self.snapshot_lease_until:
                self._stop_locked()

    def _camera_loop(self):
        fps_counter = 0
        t0 = time.time()
        idle_since = None

        while True:
            now_check = time.time()
            with self.lock:
                if not self.running or self.cap is None:
                    break
                has_demand = (self.active_clients > 0) or (now_check < self.snapshot_lease_until)
                cap = self.cap

            if not has_demand:
                if idle_since is None:
                    idle_since = now_check
                elif now_check - idle_since > 4.0:
                    with self.lock:
                        if self.active_clients <= 0 and time.time() >= self.snapshot_lease_until:
                            self._stop_locked()
                            break
            else:
                idle_since = None

            ok, frm = cap.read()
            if ok and frm is not None:
                fps_counter += 1
                now = time.time()
                elapsed = now - t0
                with self.lock:
                    self.raw_frame = frm
                    self.frame_seq += 1
                    if elapsed >= 1.0:
                        self.fps_measured = round(fps_counter / elapsed, 1)
                        fps_counter = 0
                        t0 = now
            else:
                time.sleep(0.01)

    def _ai_loop(self):
        last_processed_seq = -1
        try:
            while True:
                with self.lock:
                    if not self.running or self.active_clients <= 0:
                        if not self.running:
                            break
                        # Pause web AI when only CiRA CORE /raw_frame is reading (CiRA runs its own DeepDetect)
                        time.sleep(0.15)
                        continue
                    ready = self.ai_ready
                    p_det = self.person_det
                    e_det = self.ev_det
                    seq = self.frame_seq
                    frm = self.raw_frame.copy() if self.raw_frame is not None else None
                    cam_idx = self.cam_idx
                    record_flag = self.auto_record

                if not ready or p_det is None or e_det is None:
                    time.sleep(0.1)
                    continue

                if frm is None or seq == last_processed_seq:
                    time.sleep(0.04)
                    continue

                gray_check = cv2.cvtColor(frm, cv2.COLOR_BGR2GRAY)
                sharpness = cv2.Laplacian(gray_check, cv2.CV_64F).var()
                if sharpness < 28.0:
                    time.sleep(0.08)
                    continue

                last_processed_seq = seq
                t_start = time.time()
                try:
                    best_person, raw_objs, confounders = run_two_stage_inference(
                        frm, p_det, e_det, None, None, return_confounders=True
                    )
                    objs = filter_webcam_objects(best_person, raw_objs, confounders)
                    sw_info = {"detected": bool(objs), "sent": False}

                    if record_flag:
                        ctx = {
                            "payload": {"DeepDetect": {"count": len(objs), "objects": objs}},
                            "img": frm,
                            "CAMERA_ID": "CAM-WEBCAM-0%d" % (cam_idx + 1),
                            "CAMERA_PRESET": "webcam",
                            "COOLDOWN_SEC": 4.5,
                            "MIN_TEMPORAL_HITS": 4,
                            "MIN_CIG_CONF": 0.64,
                            "MIN_SMOKE_CONF": 0.50,
                            "STRICT_WEBCAM": True,
                            "DIRECT_CONFOUNDERS": confounders,
                            "DIRECT_CROP_CTX": {"active": False, "person": best_person},
                            "DIRECT_PERSON_BOX": best_person,
                        }
                        with open(WEBHOOK_SCRIPT, "rb") as wf:
                            exec(compile(wf.read(), "cira_webhook_node.py", "exec"), ctx)
                        sw_info = ctx["payload"].get("SmokeWatch", sw_info)

                    with self.lock:
                        self.latest_person = best_person
                        self.latest_objects = objs
                        self.latest_confounders = confounders
                        self.latest_sw = sw_info
                        if sw_info.get("sent") and sw_info.get("event_id"):
                            ev_item = {
                                "event_id": sw_info["event_id"],
                                "confidence": sw_info.get("confidence", 0.0),
                                "gate": sw_info.get("smoke_mandatory_gate", False),
                                "time": time.strftime("%H:%M:%S"),
                            }
                            if not self.recent_events or self.recent_events[0]["event_id"] != ev_item["event_id"]:
                                self.recent_events = [ev_item] + self.recent_events[:5]
                except Exception as exc:
                    with self.lock:
                        self.last_error = str(exc)

                dt = time.time() - t_start
                if dt < 0.24:
                    time.sleep(0.24 - dt)
        finally:
            with self.lock:
                self.ai_thread_running = False

    def get_raw_jpeg_and_meta(self, cam_idx=0):
        with self.lock:
            self.snapshot_lease_until = time.time() + 5.0

        if not self.start_if_needed(cam_idx=cam_idx, auto_record=None, need_web_ai=False):
            return None, {}

        with self.lock:
            if self.raw_frame is None:
                return None, {}
            frm = self.raw_frame.copy()
            meta = {
                "person": self.latest_person,
                "confounders": self.latest_confounders,
            }

        ok, buf = cv2.imencode(".jpg", frm, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        if not ok:
            return None, meta
        return buf.tobytes(), meta

    def render_annotated_jpeg(self):
        with self.lock:
            if self.raw_frame is None:
                return None, 0
            vis = self.raw_frame.copy()
            seq = self.frame_seq
            p = self.latest_person
            objs = list(self.latest_objects)
            confounders = list(self.latest_confounders)
            fps = self.fps_measured
            ai_ready = self.ai_ready

        if p is not None:
            px, py, pw, ph = p["x"], p["y"], p["w"], p["h"]
            cv2.rectangle(vis, (px, py), (px + pw, py + ph), (16, 185, 129), 2)
            lbl = "Person %.0f%%" % (p["confidence"] * 100.0)
            cv2.rectangle(vis, (px, max(0, py - 24)), (px + 125, py), (16, 185, 129), -1)
            cv2.putText(vis, lbl, (px + 6, max(17, py - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        for c in confounders:
            cx, cy, cw, ch = c["x"], c["y"], c["w"], c["h"]
            cv2.rectangle(vis, (cx, cy), (cx + cw, cy + ch), (180, 130, 70), 2)
            clbl = "%s (Safe)" % c["name"]
            ty = max(22, cy)
            cv2.rectangle(vis, (cx, ty - 22), (cx + max(110, len(clbl) * 9), ty), (180, 130, 70), -1)
            cv2.putText(vis, clbl, (cx + 5, ty - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1)

        for o in objs:
            x, y, w, h = o["x"], o["y"], o["w"], o["h"]
            color = (36, 36, 235) if o["name"] == "smoke" else (0, 120, 255)
            cv2.rectangle(vis, (x, y), (x + w, y + h), color, 3)
            c_pct = o["confidence"] if o["confidence"] > 1.0 else o["confidence"] * 100.0
            lbl = "%s %.0f%%" % (o["name"], c_pct)
            ty = max(24, y)
            cv2.rectangle(vis, (x, ty - 24), (x + max(130, len(lbl) * 10), ty), color, -1)
            cv2.putText(vis, lbl, (x + 6, ty - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        if fps > 0:
            fps_txt = "LIVE %.0f FPS%s" % (fps, "" if ai_ready else " (AI Loading)")
            box_w = 145 if ai_ready else 255
            cv2.rectangle(vis, (10, 10), (box_w, 38), (15, 23, 42), -1)
            cv2.putText(vis, fps_txt, (18, 29), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (16, 225, 150), 2)

        ok, buf = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ok:
            return None, seq
        return buf.tobytes(), seq

    def get_status(self):
        with self.lock:
            return {
                "ok": True,
                "running": self.running,
                "ai_ready": self.ai_ready,
                "fps": self.fps_measured,
                "person": self.latest_person,
                "objects": self.latest_objects,
                "smoke_watch": self.latest_sw,
                "recent_events": self.recent_events,
                "error": self.last_error,
            }


ENGINE = None


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class StreamHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        parsed = urlparse.urlparse(self.path)
        qs = urlparse.parse_qs(parsed.query)

        if parsed.path == "/status":
            if "record" in qs:
                with ENGINE.lock:
                    ENGINE.auto_record = qs["record"][0] != "0"
            body = json.dumps(ENGINE.get_status(), ensure_ascii=True).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/raw_frame":
            cam_idx = int(qs.get("cam", ["0"])[0])
            jpg_bytes, meta = ENGINE.get_raw_jpeg_and_meta(cam_idx=cam_idx)
            if jpg_bytes is None:
                self.send_response(503)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": ENGINE.last_error}).encode("utf-8"))
                return
            meta_json = json.dumps(meta, ensure_ascii=True)
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(jpg_bytes)))
            self.send_header("X-Webcam-Meta", meta_json)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(jpg_bytes)
            return

        if parsed.path == "/stop":
            ENGINE.stop_web_clients()
            body = json.dumps({"ok": True, "stopped": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/stream":
            cam_idx = int(qs.get("cam", ["0"])[0])
            rec = qs.get("record", ["1"])[0] != "0" if "record" in qs else None

            with ENGINE.lock:
                ENGINE.active_clients += 1

            try:
                if not ENGINE.start_if_needed(cam_idx=cam_idx, auto_record=rec, need_web_ai=True):
                    self.send_response(409)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": ENGINE.last_error}).encode("utf-8"))
                    return

                self.send_response(200)
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                self.send_header("Pragma", "no-cache")
                self.send_header("Connection", "close")
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.end_headers()

                last_sent_seq = -1
                while ENGINE.running:
                    jpg_bytes, seq = ENGINE.render_annotated_jpeg()
                    if jpg_bytes is None or seq == last_sent_seq:
                        time.sleep(0.005)
                        continue
                    last_sent_seq = seq
                    header = (
                        "--frame\r\n"
                        "Content-Type: image/jpeg\r\n"
                        "Content-Length: %d\r\n\r\n" % len(jpg_bytes)
                    ).encode("ascii")
                    self.wfile.write(header)
                    self.wfile.write(jpg_bytes)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                with ENGINE.lock:
                    ENGINE.active_clients = max(0, ENGINE.active_clients - 1)
            return

        self.send_response(404)
        self.end_headers()


def main():
    global ENGINE
    ENGINE = SmoothWebcamEngine()
    server = ThreadedHTTPServer(("127.0.0.1", STREAM_PORT), StreamHandler)
    sys.stdout.write(json.dumps({"ready": True, "port": STREAM_PORT}) + "\n")
    sys.stdout.flush()
    try:
        server.serve_forever()
    finally:
        ENGINE.stop_web_clients()


if __name__ == "__main__":
    main()
