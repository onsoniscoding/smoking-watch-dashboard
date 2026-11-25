# -*- coding: utf-8 -*-
"""
High-Accuracy 2-Stage CiRA CORE Native CUDA Smoking Detection Runner (v2)
Pipeline:
  Stage 1: Person Detection (`D:/SmokeDetect/models/person_coco` - 97% person recall on wide CCTV)
  Stage 2: Dual-Scale Person-ROI Cropping (Upper-Body + Tight Head/Hand/Exhale Zoom)
           -> `smoking_evidence` (cigarette + smoke, up to 90% conf)
           -> `smoking_v4` (smoking_person + cigarette + smoke)
           -> `smoking_action` (smoker action verifier)
  Stage 3: Dynamic Exhaled Smoke-Plume Analyzer + Multi-Frame Temporal Consensus + Precision Face Blur
           -> Streams verified events to Smoke Watch Dashboard (`http://localhost:3000/api`)
"""

from __future__ import print_function
import argparse
import os
import re
import subprocess
import sys
import tempfile
import threading
import time

try:
    import queue
except ImportError:
    import Queue as queue

import cv2
import numpy as np

BRIDGE_DIR = os.path.dirname(os.path.abspath(__file__))
WEBHOOK_SCRIPT = os.path.join(BRIDGE_DIR, "cira_webhook_node.py")
DARKNET_EXE = "C:/CiRA-CORE/install/bin/darknet_.exe"
BOX_REGEX = re.compile(
    r"^([A-Za-z0-9_ -]+):\s*(\d+)%\s*\(left_x:\s*(-?\d+)\s+top_y:\s*(-?\d+)\s+width:\s*(\d+)\s+height:\s*(\d+)\)"
)


class CiraNativeDarknetGPU(object):
    def __init__(self, model_dir, thresh=0.25, tag="model"):
        self.tag = tag
        self.model_dir = model_dir.replace("\\", "/")
        self.cfg_path = self.model_dir + "/test.cfg"
        self.weights_path = self.model_dir + "/train.weights"
        self.names_path = self.model_dir + "/obj.names"

        with open(self.names_path, "r") as f:
            self.classes = [line.strip() for line in f.readlines() if line.strip()]

        auto_data = os.path.join(BRIDGE_DIR, "_auto_" + tag + ".data")
        with open(auto_data, "w") as df:
            df.write("classes = %d\nnames = %s\n" % (len(self.classes), self.names_path))
        self.data_path = auto_data.replace("\\", "/")

        env = os.environ.copy()
        extra_paths = [
            r"C:\CiRA-CORE\install\bin",
            r"C:\CiRA-CORE\install\lib",
            r"C:\opt\ros\melodic\x64\bin",
        ]
        env["PATH"] = ";".join(extra_paths) + ";" + env.get("PATH", "")

        cmd = [
            DARKNET_EXE,
            "detector",
            "test",
            self.data_path,
            self.cfg_path,
            self.weights_path,
            "-thresh",
            str(thresh),
            "-dont_show",
            "-ext_output",
        ]
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            bufsize=1,
            universal_newlines=True,
        )
        self._q = queue.Queue()
        self._reader = threading.Thread(target=self._read_stdout)
        self._reader.daemon = True
        self._reader.start()
        self._collect_until_prompt(timeout=30.0)

    def _read_stdout(self):
        buf = ""
        while True:
            ch = self.proc.stdout.read(1)
            if not ch:
                if buf:
                    self._q.put(buf)
                break
            buf += ch
            if ch == "\n" or buf.endswith("Enter Image Path: "):
                self._q.put(buf)
                buf = ""

    def _collect_until_prompt(self, timeout=15.0):
        lines = []
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                chunk = self._q.get(timeout=0.5)
                lines.append(chunk)
                if "Enter Image Path" in chunk:
                    break
            except queue.Empty:
                if self.proc.poll() is not None:
                    break
        return lines

    def detect_frame(self, frame, offset_x=0, offset_y=0):
        tmp_jpg = os.path.join(tempfile.gettempdir(), "cira_roi_%s.jpg" % self.tag)
        cv2.imwrite(tmp_jpg, frame)
        clean_path = tmp_jpg.replace("\\", "/")
        self.proc.stdin.write(clean_path + "\n")
        self.proc.stdin.flush()
        raw_lines = self._collect_until_prompt(timeout=15.0)

        objects = []
        for raw in raw_lines:
            line = raw.strip()
            m = BOX_REGEX.match(line)
            if m:
                cls_name = m.group(1).strip()
                conf_pct = float(m.group(2))
                lx = max(0, int(m.group(3))) + offset_x
                ty = max(0, int(m.group(4))) + offset_y
                bw = int(m.group(5))
                bh = int(m.group(6))
                cls_id = self.classes.index(cls_name) if cls_name in self.classes else 0
                objects.append({
                    "id": cls_id,
                    "name": cls_name,
                    "confidence": conf_pct,
                    "x": lx,
                    "y": ty,
                    "w": bw,
                    "h": bh,
                    "global_coords": True,
                    "is_topleft": True,
                })
        return objects

    def close(self):
        try:
            if self.proc and self.proc.poll() is None:
                self.proc.terminate()
        except Exception:
            pass


def nms_dedup(objects, iou_thresh=0.45):
    """Deduplicate overlapping same-class detections across multi-scale crops."""
    if not objects:
        return []
    by_cls = {}
    for o in objects:
        by_cls.setdefault(o["name"], []).append(o)

    merged = []
    for cls_name, items in by_cls.items():
        items.sort(key=lambda x: x["confidence"], reverse=True)
        kept = []
        for cand in items:
            ax1, ay1, ax2, ay2 = cand["x"], cand["y"], cand["x"] + cand["w"], cand["y"] + cand["h"]
            area_a = max(1.0, float(cand["w"] * cand["h"]))
            overlap = False
            for k in kept:
                bx1, by1, bx2, by2 = k["x"], k["y"], k["x"] + k["w"], k["y"] + k["h"]
                ix1, iy1 = max(ax1, bx1), max(ay1, by1)
                ix2, iy2 = min(ax2, bx2), min(ay2, by2)
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                union = area_a + max(1.0, float(k["w"] * k["h"])) - inter
                if inter / max(1.0, union) >= iou_thresh:
                    overlap = True
                    break
            if not overlap:
                kept.append(cand)
        merged.extend(kept)
    return merged


def run_two_stage_inference(frame, person_det, ev_det, v4_det, act_det, return_confounders=False):
    fh, fw = frame.shape[:2]

    # Stage 1: Detect Person(s) AND Drinking/Phone Confounders (cup, bottle, wine glass, cell phone)
    coco_all = person_det.detect_frame(frame)
    p_objs = [o for o in coco_all if o["name"] == "person" and o["confidence"] >= 30.0]
    confounders = [
        o for o in coco_all
        if o["name"] in ("cup", "bottle", "wine glass", "cell phone", "bowl", "toothbrush") and o["confidence"] >= 20.0
    ]
    best_person = None
    crops_to_scan = []

    if p_objs:
        p_objs.sort(key=lambda p: p["confidence"] * (p["w"] * p["h"]), reverse=True)
        bp = p_objs[0]
        best_person = {
            "name": "person",
            "confidence": round(bp["confidence"] / 100.0, 4),
            "x": bp["x"],
            "y": bp["y"],
            "w": bp["w"],
            "h": bp["h"],
        }
        px, py, pw, ph = bp["x"], bp["y"], bp["w"], bp["h"]

        if pw < fw * 0.48:
            # Crop A: Upper-body + lowered/raised hands + smoke plume zone
            ux1, uy1 = max(0, int(px - pw * 0.30)), max(0, int(py - ph * 0.08))
            ux2, uy2 = min(fw, int(px + pw * 1.75)), min(fh, int(py + ph * 0.72))
            if ux2 - ux1 > 40 and uy2 - uy1 > 40:
                crops_to_scan.append((frame[uy1:uy2, ux1:ux2], ux1, uy1))

            # Crop B: Tight Head + Mouth + Hand Zoom (maximizes tiny cigarette resolution!)
            hx1, hy1 = max(0, int(px - pw * 0.15)), max(0, int(py - ph * 0.06))
            hx2, hy2 = min(fw, int(px + pw * 1.50)), min(fh, int(py + ph * 0.40))
            if hx2 - hx1 > 36 and hy2 - hy1 > 36:
                crops_to_scan.append((frame[hy1:hy2, hx1:hx2], hx1, hy1))
        else:
            crops_to_scan.append((frame, 0, 0))
    else:
        crops_to_scan.append((frame, 0, 0))

    raw_smoking = []
    for crop_img, ox, oy in crops_to_scan:
        raw_smoking.extend(ev_det.detect_frame(crop_img, ox, oy))
        if v4_det is not None:
            raw_smoking.extend(v4_det.detect_frame(crop_img, ox, oy))
        if act_det is not None:
            raw_smoking.extend(act_det.detect_frame(crop_img, ox, oy))

    # Also run smoking_v4 on full frame if no crops matched (e.g. giant close-up smoke plume)
    if not raw_smoking and crops_to_scan[0][1] != 0 and v4_det is not None:
        raw_smoking.extend(v4_det.detect_frame(frame, 0, 0))

    deduped = nms_dedup(raw_smoking)
    if return_confounders:
        return best_person, deduped, confounders
    return best_person, deduped


def send_via_bridge(frame, best_person, objects, camera_id, camera_name, cooldown, min_hits):
    ctx = {
        "payload": {
            "DeepDetect": {
                "count": len(objects),
                "objects": objects,
            }
        },
        "img": frame,
        "CAMERA_ID": camera_id,
        "CAMERA_NAME": camera_name,
        "COOLDOWN_SEC": cooldown,
        "MIN_TEMPORAL_HITS": min_hits,
        "DIRECT_CROP_CTX": {"active": False, "person": best_person},
        "DIRECT_PERSON_BOX": best_person,
    }
    with open(WEBHOOK_SCRIPT, "r") as f:
        code = compile(f.read(), WEBHOOK_SCRIPT, "exec")
        exec(code, ctx)
    return ctx["payload"], ctx["img"]


def main():
    parser = argparse.ArgumentParser(description="High-Accuracy 2-Stage CiRA CORE Smoking AI")
    parser.add_argument("--person-model", default="D:/SmokeDetect/models/person_coco")
    parser.add_argument("--evidence-model", default="D:/SmokeDetect/models/smoking_evidence")
    parser.add_argument("--v4-model", default="D:/SmokeDetect/smoking_v4")
    parser.add_argument("--action-model", default="D:/SmokeDetect/models/smoking_action")
    parser.add_argument("--image", default="")
    parser.add_argument("--video", default="")
    parser.add_argument("--webcam", type=int, default=-1)
    parser.add_argument("--camera-id", default="CAM-CCTV-01")
    parser.add_argument("--camera-name", default="Corridor CCTV (CiRA 2-Stage)")
    parser.add_argument("--thresh", type=float, default=0.25)
    parser.add_argument("--cooldown", type=float, default=3.5)
    parser.add_argument("--min-hits", type=int, default=2)
    parser.add_argument("--frame-step", type=int, default=6)
    parser.add_argument("--max-frames", type=int, default=0)
    parser.add_argument("--save-video", default="", help="Optional output annotated MP4 path")
    parser.add_argument("--show", action="store_true")
    args = parser.parse_args()

    print("[CiRA 2-Stage CUDA] Loading Stage-1 Person Detector + Stage-2 Smoking Ensemble...")
    person_det = CiraNativeDarknetGPU(args.person_model, thresh=0.25, tag="person_coco")
    ev_det = CiraNativeDarknetGPU(args.evidence_model, thresh=args.thresh, tag="smoking_ev")
    v4_det = CiraNativeDarknetGPU(args.v4_model, thresh=args.thresh, tag="smoking_v4")
    act_det = None
    if args.action_model and os.path.exists(os.path.join(args.action_model, "train.weights")):
        act_det = CiraNativeDarknetGPU(args.action_model, thresh=max(0.28, args.thresh), tag="smoking_act")

    writer = None
    try:
        if args.image:
            frame = cv2.imread(args.image)
            if frame is None:
                print("[ERROR] Cannot read image:", args.image)
                sys.exit(1)
            best_p, objs = run_two_stage_inference(frame, person_det, ev_det, v4_det, act_det)
            pl, out_img = send_via_bridge(frame, best_p, objs, args.camera_id, args.camera_name, 0.0, 1)
            print("[CiRA 2-Stage] Person:", best_p, "| Detections:", objs)
            print("[SmokeWatch]:", pl.get("SmokeWatch"))
            return

        source = args.webcam if args.webcam >= 0 else args.video
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print("[ERROR] Cannot open video/webcam:", source)
            sys.exit(1)

        if args.save_video:
            fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(args.save_video, fourcc, max(4.0, fps / max(1, args.frame_step)), (w, h))

        frame_idx = 0
        detected_frames = 0
        sent_events = 0
        peak_seen = 0.0
        print("[CiRA 2-Stage CUDA] Running high-accuracy pipeline on:", source)

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            if args.webcam < 0 and (frame_idx % args.frame_step != 1):
                continue

            best_p, objs = run_two_stage_inference(frame, person_det, ev_det, v4_det, act_det)
            pl, out_img = send_via_bridge(frame, best_p, objs, args.camera_id, args.camera_name, args.cooldown, args.min_hits)
            sw = pl.get("SmokeWatch", {})

            if sw.get("detected"):
                detected_frames += 1
                c = float(sw.get("confidence", 0.0))
                if c > peak_seen:
                    peak_seen = c
            if sw.get("sent"):
                sent_events += 1
                print("[Frame %03d] VERIFIED EVENT -> %s | Conf: %.1f%% | Gate: %s | RawObjs: %s" % (
                    frame_idx,
                    sw.get("event_id"),
                    sw.get("confidence", 0.0) * 100.0,
                    sw.get("smoke_mandatory_gate"),
                    [(o["name"], o["confidence"]) for o in objs],
                ))

            if writer is not None and out_img is not None:
                writer.write(out_img)

            if args.show:
                cv2.imshow("Smoke Watch - CiRA 2-Stage High-Accuracy AI", out_img)
                if (cv2.waitKey(1) & 0xFF) in (ord("q"), 27):
                    break

            if args.max_frames > 0 and frame_idx >= args.max_frames:
                break

        cap.release()
        if writer is not None:
            writer.release()
        if args.show:
            cv2.destroyAllWindows()
        print("[CiRA 2-Stage Summary] Frames scanned: %d | Smoking frames hit: %d | Peak Conf: %.1f%% | Verified events sent: %d" % (
            (frame_idx // max(1, args.frame_step)) + 1,
            detected_frames,
            peak_seen * 100.0,
            sent_events,
        ))
    finally:
        person_det.close()
        ev_det.close()
        v4_det.close()
        if act_det is not None:
            act_det.close()


if __name__ == "__main__":
    main()
