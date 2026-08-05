#!/usr/bin/env python3
"""
Blue-pen isolation stage of the ICR pipeline.

Reads a JPEG/PNG from a known input path, applies the strict HSV blue-pen
filter (H 100-130, S >= 60, V 50-255), inverts the mask so blue ink renders as
black text on white, writes the filtered image to a sibling `_blue.jpg`, and
prints a JSON summary on stdout describing what was done.

Used by the two-stage ICR scanner UI:
  1. Frontend POSTs the original image to /api/icr/filter
  2. This script filters it; response includes the filtered data URL
  3. Frontend displays the filtered preview
  4. Frontend POSTs the filtered data URL to /api/icr/evaluate-pdf
  5. Python's easyocr_evaluator runs OCR on the (already-filtered) image

This separation lets the user visually confirm the blue-pen filter worked
before committing to the ~2-3s EasyOCR call.

Stdout format (single JSON line, easy for Node to parse):
  {"success": true, "output_path": "...", "blue_pixel_ratio": 0.012, ...}
"""

import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python bluepen_filter.py <input_path> <output_path>",
        }))
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(json.dumps({"success": False, "error": f"Input not found: {input_path}"}))
        sys.exit(2)

    # Lazy import cv2/numpy — match the existing easyocr_evaluator pattern so
    # environments without opencv fail loudly but the rest of the pipeline
    # can still be imported.
    try:
        import cv2
        import numpy as np
    except ImportError:
        print(json.dumps({
            "success": False,
            "error": "openCV (cv2) not installed. Run: pip install opencv-python-headless numpy",
        }))
        sys.exit(3)

    bgr = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if bgr is None:
        print(json.dumps({"success": False, "error": f"Cannot decode image: {input_path}"}))
        sys.exit(4)

    img_h, img_w = bgr.shape[:2]

    # Same HSV range as easyocr_evaluator.isolate_blue_pen — kept in sync.
    # If you change one, change both (or extract to a shared module).
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lower = np.array([100, 60, 50], dtype=np.uint8)
    upper = np.array([130, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    blue_pixel_count = int(np.count_nonzero(mask))
    blue_pixel_ratio = blue_pixel_count / mask.size

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    # Invert: EasyOCR + human eye both want dark text on light background.
    inverted = cv2.bitwise_not(mask)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), inverted, [int(cv2.IMWRITE_JPEG_QUALITY), 90])

    print(json.dumps({
        "success": True,
        "output_path": str(output_path),
        "image_size": [img_w, img_h],
        "blue_pixel_count": blue_pixel_count,
        "blue_pixel_ratio": round(blue_pixel_ratio, 5),
    }))


if __name__ == "__main__":
    main()