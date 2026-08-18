#!/usr/bin/env python3
"""
Blue-pen isolation stage of the ICR pipeline.

Reads a JPEG/PNG from a known input path, isolates blue-ink pixels using
a strict HSV mask, then cleans up the binary mask so the result is
"OCR-friendly" — strokes are connected (no broken digit segments),
slightly thickened (so thin handwriting reads as solidly as printed text),
and free of single-pixel noise.

Pipeline:
  1. Strict HSV mask: H 100-130 (royal-blue through cyan-blue),
     S ≥ 60, V ≥ 50. Rejects red margin lines, gray ruled lines,
     pencil/graphite, and printed text.
  2. Morphological close with a 5x5 rectangular kernel — fills stroke
     gaps up to 4 pixels wide (handwriting often has 2-3 pixel gaps
     between segments that a 3x3 kernel can't bridge).
  3. Dilate with a 3x3 kernel — adds 1 pixel of stroke thickness so
     EasyOCR (which is trained on printed text) sees strokes that are
     at least ~4-5 pixels wide instead of 1-2.
  4. No erode / open step — that would thin strokes again.
  5. Invert: blue ink (white in mask) → black text on white background,
     the format EasyOCR is trained on.
  6. Write as PNG (not JPEG) — no compression artifacts on the binary
     mask, so the edges stay crisp.

Used by the two-stage ICR scanner UI:
  1. Frontend POSTs the original image to /api/icr/filter
  2. This script filters it; response includes the filtered data URL
  3. Frontend displays the filtered preview
  4. Frontend POSTs the filtered data URL to /api/icr/evaluate-pdf
  5. Python's easyocr_evaluator runs OCR on the (already-filtered) image

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

    # HSV range tuned for blue pen ink (royal blue through cyan-blue).
    # This is the most reliable filter for handwriting scans where the
    # user used a blue pen on white paper.
    #
    # Range: H 95-140, S >= 20, V >= 0 (any value).
    # Safety analysis:
    #   - Paper background: H ~ 21 (warm cream). OUTSIDE H 95-140. Safe.
    #   - Red marks (clouds, drawings): H 0-29. OUTSIDE H 95-140. Safe.
    #   - Printed black text: H 0-30, very dark (V<50). The H is outside
    #     our range. Even if some antialiased edges have S=10-20 and
    #     H drift, they form large connected components that the
    #     size filter below removes.
    #   - Blue ink: H 110-130, S 20-150, V 60-210. INSIDE. Captured.
    #
    # IMPORTANT — this filter is blue-only by design. If the user
    # used a GRAY or BLACK pen, the filter will not find their
    # ink (their ink's H is around 0-30, outside our range). For
    # non-blue ink, the answer is "no ink found" — the user should
    # be told to use a blue pen. We tried a color-agnostic version
    # (S 12-60, V < 200) and it caught the printed text and noise
    # along with the user's gray ink, producing unusable output.
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lower = np.array([95, 20, 0], dtype=np.uint8)
    upper = np.array([140, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    blue_pixel_count = int(np.count_nonzero(mask))
    blue_pixel_ratio = blue_pixel_count / mask.size

    if blue_pixel_count == 0:
        # Image has no blue ink. Likely already filtered, or a non-blue scan.
        # Don't write a blank white image; signal "no filter needed" by
        # returning None so the caller uses the original.
        print(json.dumps({
            "success": False,
            "error": "no_blue_pixels",
            "blue_pixel_count": 0,
        }))
        sys.exit(0)  # exit 0, not error — caller handles via success=False
    # Step 2: close 5x5 — fills stroke gaps up to 4 pixels wide
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)

    # Step 3: dilate 2x2 — adds ~1px stroke thickness for OCR readability
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    mask = cv2.dilate(mask, dilate_kernel, iterations=1)

    # Step 4: drop printed text rows. Printed text on a form (section
    # headers, number grids, question labels) forms HORIZONTAL ROWS
    # of regularly-spaced components. Handwriting is irregularly
    # spaced. We group components into y-bands, and for bands with
    # 5+ components at REGULAR horizontal intervals (gap stddev <
    # 30% of median), we drop the whole band as printed text.
    # 10px y-band + 5+ comps threshold preserves the user's right-
    # column answers (which form vertical, not horizontal, clusters).
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    y_bands = {}
    for i in range(1, n):
        y = stats[i, 1]
        band = y // 10
        y_bands.setdefault(band, []).append(i)
    drop = set()
    for band, comps in y_bands.items():
        if len(comps) < 5:
            continue
        xs = sorted([stats[i, 0] for i in comps])
        gaps = [xs[j + 1] - xs[j] for j in range(len(xs) - 1)]
        if not gaps:
            continue
        median_gap = float(np.median(gaps))
        gap_std = float(np.std(gaps))
        # Regular spacing = small stddev relative to median gap
        if median_gap > 0 and gap_std / median_gap < 0.3 and median_gap < 80:
            drop.update(comps)
    if drop:
        keep_labels = [i for i in range(1, n) if i not in drop]
        keep = np.isin(labels, keep_labels)
        mask = np.where(keep, 255, 0).astype(np.uint8)

    # Step 5: invert — ink renders as black text on white background
    inverted = cv2.bitwise_not(mask)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Step 6: write as PNG to avoid JPEG compression artifacts on the
    # binary mask. The cost is ~3-4x larger files but for an 8MP scan
    # the filtered output is <500KB so it's fine.
    cv2.imwrite(str(output_path), inverted)

    print(json.dumps({
        "success": True,
        "output_path": str(output_path),
        "image_size": [img_w, img_h],
        "blue_pixel_count": blue_pixel_count,
        "blue_pixel_ratio": round(blue_pixel_ratio, 5),
    }))


if __name__ == "__main__":
    main()
