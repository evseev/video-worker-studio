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
            "_faces": [],
        }
        if not faces:
            return result
        inv = 1.0 / scale
        largest = max(f[2] * f[3] for f in faces)
        # Significant faces: at least 25% of the largest face's area (ignore tiny background faces).
        significant = sorted((f for f in faces if f[2] * f[3] >= 0.25 * largest), key=lambda f: -(f[2] * f[3]))
        result["faceCount"] = len(significant)
        result["_faces"] = []
        for f in significant:
            feature = self.recognizer.feature(self.recognizer.alignCrop(work, f))
            x, y, fw, fh = [float(v) * inv for v in f[:4]]
            result["_faces"].append({
                "box": [round(x, 1), round(y, 1), round(fw, 1), round(fh, 1)],
                "score": round(float(f[14]), 4),
                "area": round((fw * fh) / float(w * h), 5),
                "feature": feature,
            })
        self.choose_face(result, 0)
        return result

    @staticmethod
    def choose_face(result, idx):
        face = result["_faces"][idx]
        result["faceBox"] = face["box"]
        result["faceScore"] = face["score"]
        result["faceAreaRatio"] = face["area"]
        result["_feature"] = face["feature"]
        result["faceIndex"] = idx

    def similarity(self, a, b):
        return float(self.recognizer.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def main():
    req = json.load(sys.stdin)
    refs = req.get("references") or []
    cands = req.get("candidates") or []
    # Faces that must NOT be this person (e.g. the famous partner who dominates a spouse's search results).
    excludes = req.get("exclude") or []
    engine = FaceEngine()

    ref_results = [engine.analyze(p) for p in refs]
    ref_features = [r["_feature"] for r in ref_results if r.get("ok") and r.get("_feature") is not None]
    excl_features = [r["_feature"] for r in (engine.analyze(p) for p in excludes) if r.get("ok") and r.get("_feature") is not None]

    def excl_sim(feature):
        return max((engine.similarity(feature, e) for e in excl_features), default=0.0)
    cand_results = [engine.analyze(p) for p in cands]

    # In group photos pick the face that is this person: best reference match, else the face most
    # similar to the person's single-face photos (couples photos are common for spouses).
    singles = [
        c["_feature"]
        for c in cand_results
        if c.get("ok") and c.get("faceCount") == 1 and c.get("_feature") is not None and excl_sim(c["_feature"]) < 0.36
    ]
    for c in cand_results:
        faces = c.get("_faces") or []
        if len(faces) < 2:
            continue
        def score(face):
            penalty = excl_sim(face["feature"])
            if ref_features:
                return max(engine.similarity(face["feature"], rf) for rf in ref_features) - penalty
            if singles:
                return float(np.median([engine.similarity(face["feature"], g) for g in singles])) - penalty
            return -penalty
        best = max(range(len(faces)), key=lambda k: score(faces[k]))
        engine.choose_face(c, best)

    feats = [c.get("_feature") if c.get("ok") else None for c in cand_results]
    for i, c in enumerate(cand_results):
        f = feats[i]
        c["refSimilarity"] = None
        c["consensusSimilarity"] = None
        c["excludeSimilarity"] = None
        if f is None:
            continue
        if excl_features:
            c["excludeSimilarity"] = round(excl_sim(f), 4)
        if ref_features:
            c["refSimilarity"] = round(max(engine.similarity(f, rf) for rf in ref_features), 4)
        # Consensus against the other photos' chosen faces, ignoring faces that match an excluded person.
        others = [
            engine.similarity(f, g)
            for j, g in enumerate(feats)
            if j != i and g is not None and (not excl_features or excl_sim(g) < 0.36)
        ]
        if others:
            c["consensusSimilarity"] = round(float(np.median(others)), 4)

    def clean(r):
        r = dict(r)
        r.pop("_feature", None)
        r.pop("_faces", None)
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
