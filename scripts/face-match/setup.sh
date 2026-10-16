#!/usr/bin/env bash
# One-time setup for the face-match CLI used by the autopilot pipeline.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/pip install -q opencv-python-headless==4.10.0.84 numpy
mkdir -p models
base=https://github.com/opencv/opencv_zoo/raw/main/models
[ -s models/face_detection_yunet_2023mar.onnx ] || curl -sL -o models/face_detection_yunet_2023mar.onnx "$base/face_detection_yunet/face_detection_yunet_2023mar.onnx"
[ -s models/face_recognition_sface_2021dec.onnx ] || curl -sL -o models/face_recognition_sface_2021dec.onnx "$base/face_recognition_sface/face_recognition_sface_2021dec.onnx"
echo "FACE_MATCH_BIN=$(pwd)/.venv/bin/python $(pwd)/face_match.py"
