#!/usr/bin/env python3
"""Face verification CLI for the autopilot pipeline.

Reads a JSON request on stdin:
  {"references": ["/abs/ref1.jpg", ...], "candidates": ["/abs/c1.jpg", ...]}

Writes a JSON response on stdout:
  {"references": [{"path", "ok", "faceCount"}...],
   "candidates": [{"path", "ok", "error"?, "width", "height", "faceCount",
                   "faceBox": [x, y, w, h] | null, "faceScore", "faceAreaRatio",
                   "blur", "refSimilarity": float | null,
                   "consensusSimilarity": float | null}]}

refSimilarity    = max cosine similarity between the candidate's main face and any reference face.
consensusSimilarity = median cosine similarity between the candidate's main face and the main
                   faces of the other candidates (identity that recurs across results).
SFace cosine threshold for "same person" is ~0.363 (OpenCV zoo reference value).

Models (downloaded by setup.sh into ./models):
  face_detection_yunet_2023mar.onnx, face_recognition_sface_2021dec.onnx
"""
import json
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DET_MODEL = os.path.join(HERE, "models", "face_detection_yunet_2023mar.onnx")
REC_MODEL = os.path.join(HERE, "models", "face_recognition_sface_2021dec.onnx")
DETECT_SIDES = (640, 960, 320)  # YuNet misses very large faces at full resolution; try several scales


def load_image(path):
    data = np.fromfile(path, dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    return img


def dhash(img, size=8):
    """64-bit difference hash as 16 hex chars; near-duplicates differ by few bits."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (size + 1, size), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    value = 0
    for b in bits:
        value = (value << 1) | int(b)
    return "%016x" % value


class FaceEngine:
    def __init__(self):
        self.detector = cv2.FaceDetectorYN.create(DET_MODEL, "", (320, 320), 0.8, 0.3, 5000)
        self.recognizer = cv2.FaceRecognizerSF.create(REC_MODEL, "")

    def analyze(self, path):
        img = load_image(path)
        if img is None:
            return {"path": path, "ok": False, "error": "unreadable"}
        h, w = img.shape[:2]
        faces, work, scale = [], img, 1.0
        for side in DETECT_SIDES:
            scale = min(1.0, side / float(max(h, w)))
            work = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale)))) if scale < 1.0 else img
            wh, ww = work.shape[:2]
            self.detector.setInputSize((ww, wh))
            _, found = self.detector.detect(work)
            faces = [] if found is None else list(found)
            if faces:
                break
        gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
        blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        result = {
            "path": path,
            "ok": True,
            "width": int(w),
            "height": int(h),
            "faceCount": len(faces),
            "faceBox": None,
            "faceScore": None,
            "faceAreaRatio": 0.0,
            "blur": round(blur, 2),
            "dhash": dhash(img),
            "_feature": None,
        }
        if not faces:
            return result
        # main face = largest area
        main = max(faces, key=lambda f: f[2] * f[3])
        aligned = self.recognizer.alignCrop(work, main)
        feature = self.recognizer.feature(aligned)
        inv = 1.0 / scale
        x, y, fw, fh = [float(v) * inv for v in main[:4]]
        result["faceBox"] = [round(x, 1), round(y, 1), round(fw, 1), round(fh, 1)]
        result["faceScore"] = round(float(main[14]), 4)
        result["faceAreaRatio"] = round((fw * fh) / float(w * h), 5)
        # count only faces at least 25% the area of the main face (ignore tiny background faces)
        main_area = float(main[2] * main[3])
        result["faceCount"] = int(sum(1 for f in faces if f[2] * f[3] >= 0.25 * main_area))
        result["_feature"] = feature
        return result

    def similarity(self, a, b):
        return float(self.recognizer.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def main():
    req = json.load(sys.stdin)
    refs = req.get("references") or []
    cands = req.get("candidates") or []
    engine = FaceEngine()

    ref_results = [engine.analyze(p) for p in refs]
    ref_features = [r["_feature"] for r in ref_results if r.get("ok") and r.get("_feature") is not None]
    cand_results = [engine.analyze(p) for p in cands]

    feats = [c.get("_feature") if c.get("ok") else None for c in cand_results]
    for i, c in enumerate(cand_results):
        f = feats[i]
        c["refSimilarity"] = None
        c["consensusSimilarity"] = None
        if f is None:
            continue
        if ref_features:
            c["refSimilarity"] = round(max(engine.similarity(f, rf) for rf in ref_features), 4)
        others = [engine.similarity(f, g) for j, g in enumerate(feats) if j != i and g is not None]
        if others:
            c["consensusSimilarity"] = round(float(np.median(others)), 4)

    def clean(r):
        r = dict(r)
        r.pop("_feature", None)
        return r

    out = {
        "references": [
            {"path": r["path"], "ok": r.get("ok", False), "faceCount": r.get("faceCount", 0)} for r in ref_results
        ],
        "candidates": [clean(c) for c in cand_results],
    }
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
