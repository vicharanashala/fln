#!/usr/bin/env python3
"""
Ultra-Fast EasyOCR Answer Sheet Evaluator script for FLN Platform.
Processes both PDF documents and raw image files (PNG, JPG, JPEG, WEBP)
using PyTorch EasyOCR reader with digit allowlist restriction, image pre-downsampling,
and fast PyPDF text stream extraction.
"""

import sys
import os
import json
import re
import time
from pathlib import Path

# Dependency checks
EASYOCR_AVAILABLE = False
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    pass

PYPDF_AVAILABLE = False
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    pass

PIL_AVAILABLE = False
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    pass

CV2_AVAILABLE = False
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    pass

# Singleton cached reader for fast execution
_CACHED_READER = None

# PaddleOCR singleton — better at handwritten digits than EasyOCR
PADDLE_AVAILABLE = False
try:
    from paddleocr import PaddleOCR as _PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    pass

_CACHED_PADDLE = None


def get_paddle_reader():
    """Lazy-init a singleton PaddleOCR reader. Returns None if not available."""
    global _CACHED_PADDLE
    if _CACHED_PADDLE is not None:
        return _CACHED_PADDLE
    if not PADDLE_AVAILABLE:
        return None
    try:
        _CACHED_PADDLE = _PaddleOCR(use_angle_cls=False, lang='en', show_log=False)
    except Exception as e:
        sys.stderr.write(f"[paddle] Reader init error: {e}\n")
        return None
    return _CACHED_PADDLE


def get_fast_easyocr_reader():
    global _CACHED_READER
    if _CACHED_READER is None and EASYOCR_AVAILABLE:
        try:
            _CACHED_READER = easyocr.Reader(['en'], gpu=False, verbose=False)
        except Exception as e:
            sys.stderr.write(f"[easyocr] Reader init error: {e}\n")
    return _CACHED_READER


def isolate_blue_pen(image_path: str) -> str | None:
    """
    Strict HSV blue-pen isolation. Returns the path to a temp PNG where
    blue ink is rendered as BLACK text on WHITE background — the format
    EasyOCR is trained on (dark text, light background).

    Pipeline (OCR-friendly tuning — strokes thickened, not thinned):
      1. Strict HSV mask (H 100-130, S ≥ 60, V ≥ 50). Rejects red,
         gray, pencil, and printed text.
      2. Morphological close 5x5 — fills stroke gaps up to 4px wide.
         Handwritten digits often have 2-3 pixel gaps between segments
         that a 3x3 kernel can't bridge; 5x5 fixes this.
      3. Dilate 3x3 — adds 1 pixel of stroke thickness so the filtered
         output looks like printed text (4-5px stroke width) instead of
         thin handwriting (1-2px). EasyOCR's English model was trained
         on printed text and reads thicker strokes much more reliably.
      4. No erode / open step — that would thin strokes again, which is
         the opposite of what we want.
      5. Invert to black-on-white.
      6. Write as PNG (not JPEG) — no compression artifacts on the
         binary mask, so edges stay crisp.

    Returns None if cv2 isn't installed, the file isn't readable, or
    the image contains 0 blue pixels (e.g. it's already filtered).
    The 0-blue case matters: when the two-stage flow runs this on an
    already-filtered image, returning None forces the caller to use
    the original image directly.

    Returns None on failure — never raises.
    """
    if not CV2_AVAILABLE:
        return None
    try:
        bgr = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        # Blue-pen HSV range — see bluepen_filter.py for the full rationale.
        # Works well for blue pen on white paper. Does NOT work for
        # gray/black/other-color ink (use a different tool for those).
        lower = np.array([95, 20, 0], dtype=np.uint8)
        upper = np.array([140, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower, upper)
        blue_pixel_count = int(np.count_nonzero(mask))
        if blue_pixel_count == 0:
            # Image has no blue ink. Likely already filtered, or a non-blue
            # scan. Don't write a blank white JPEG; signal "no filter needed"
            # by returning None so the caller uses the original.
            sys.stderr.write(f"[blue-pen] no blue pixels in {os.path.basename(image_path)}; skipping filter\n")
            return None
        # Step 2: close 5x5 — fill stroke gaps
        close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)
        # Step 3: dilate 2x2 — add 1px stroke thickness for OCR readability
        # (3x3 was puffy; 2x2 strikes the balance between crispness and
        # detectability. See bluepen_filter.py for the rationale.)
        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        mask = cv2.dilate(mask, dilate_kernel, iterations=1)
        # Step 3.5: drop printed text rows. See bluepen_filter.py for the
        # full rationale. We use 5+ comps in a 10px y-band with regular
        # horizontal spacing as the signature of printed text. User's
        # handwriting forms vertical clusters (right column answers) not
        # horizontal rows, so they survive.
        n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        y_bands = {}
        for i in range(1, n):
            band = stats[i, 1] // 10
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
            if median_gap > 0 and gap_std / median_gap < 0.3 and median_gap < 80:
                drop.update(comps)
        if drop:
            keep_labels = [i for i in range(1, n) if i not in drop]
            mask = np.where(np.isin(labels, keep_labels), 255, 0).astype(np.uint8)
        # Step 4: invert — EasyOCR wants dark text on light background
        inverted = cv2.bitwise_not(mask)
        # Step 5: write as PNG to avoid JPEG artifacts on the binary mask
        out_path = image_path + "_blue_inv.png"
        cv2.imwrite(out_path, inverted)
        return out_path
    except Exception as e:
        sys.stderr.write(f"[blue-pen] isolation failed: {e}\n")
        return None


def find_components(filtered_path: str, min_area: int = 80):
    """Find connected components in a blue-pen-filtered image.

    The filtered image is black ink on white. We threshold at 128 and find
    8-connected components. Each component represents one isolated mark
    (digit, triangle, arrow, etc.).

    Returns (gray_image, list_of_component_dicts, inverse_binary_mask).
    The inverse_binary_mask is the binary image with ink=white (so it can
    be re-cropped for geometric classification).
    """
    img = cv2.imread(filtered_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise RuntimeError(f"can't read {filtered_path}")
    _, inv_bw = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(inv_bw, connectivity=8)
    comps = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        comps.append({
            'id': int(i),
            'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h),
            'area': int(area),
            'cx': float(centroids[i][0]),
            'cy': float(centroids[i][1]),
        })
    return img, comps, inv_bw


def classify_geometry(crop_bw, min_area: int = 80):
    """Classify an isolated component as 'triangle', '>', '<', 'circle', or None.

    Strategy:
      - Triangle: polygon reduces to 3 vertices, no deep convexity defects.
      - Greater-than (>): roughly 3-4 polygon vertices, exactly one deep
        concavity on the LEFT side (the elbow).
      - Less-than    (<): same but the concavity is on the RIGHT side.
      - Circle     : very high circularity (4*pi*area / peri^2 close to 1).
      - Other shapes: None (let the caller fall back to OCR).
    """
    contours, _ = cv2.findContours(crop_bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(c)
    if area < min_area:
        return None
    peri = cv2.arcLength(c, True)
    if peri < 5:
        return None
    # Circle test (run first — a perfect circle is also a polygon with many verts)
    if peri > 0:
        circularity = 4.0 * np.pi * area / (peri * peri)
        if circularity > 0.82:
            return 'circle'
    # Polygon vertex counts at three epsilons (for stability)
    counts = [len(cv2.approxPolyDP(c, eps * peri, True)) for eps in (0.03, 0.04, 0.05)]
    hull_idx = cv2.convexHull(c, returnPoints=False)
    deep = {0.05: 0, 0.08: 0, 0.12: 0}
    defects = None
    if len(hull_idx) > 2:
        defects = cv2.convexityDefects(c, hull_idx)
        if defects is not None:
            for d in defects:
                depth = float(d[3]) / 256.0
                for thr in deep:
                    if depth > peri * thr:
                        deep[thr] += 1
    # Triangle: 3 vertices at the most permissive epsilon, no deep defects
    if counts[2] == 3 and deep[0.05] == 0:
        return 'triangle'
    # Greater-than / less-than: 3-4 polygon vertices, exactly one deep concavity
    if counts[1] in (3, 4) and deep[0.08] == 1 and deep[0.12] >= 1 and defects is not None:
        hull = cv2.convexHull(c)
        if len(hull) >= 3:
            hull_sorted_x = sorted(hull, key=lambda p: int(p[0][0]), reverse=True)
            right_x = (hull_sorted_x[0][0][0] + hull_sorted_x[1][0][0]) / 2
            deepest = max(defects, key=lambda d: float(d[3]))
            far_idx = int(deepest[2])
            if 0 <= far_idx < len(c):
                far_pt = c[far_idx][0]
                if far_pt[0] < right_x - 5:
                    return '>'
                if far_pt[0] > right_x + 5:
                    return '<'
    return None


def match_components_to_ocr(comps, ocr_boxes, iou_floor: float = 0.05):
    """Greedy IoU-based matching of OCR detections to connected components.

    For each component, find the OCR detection whose bbox has the highest
    score = IoU*100 - distance*0.1. Each component and OCR box is used at
    most once. Returns a list of dicts with 'text', 'confidence', 'source'
    (one of 'ocr', 'geometry', 'unmatched') for each component, in the
    original comps order.
    """
    # Build candidate list
    candidates = []
    for ci, comp in enumerate(comps):
        for oi, det in enumerate(ocr_boxes):
            bx, by, bw, bh, bconf, btext = det
            ox1, oy1 = max(bx, comp['x']), max(by, comp['y'])
            ox2, oy2 = min(bx + bw, comp['x'] + comp['w']), min(by + bh, comp['y'] + comp['h'])
            overlap = max(0, ox2 - ox1) * max(0, oy2 - oy1)
            comp_area = comp['w'] * comp['h']
            iou = overlap / max(comp_area + bw * bh - overlap, 1)
            if iou < iou_floor:
                continue
            bcx = bx + bw / 2
            bcy = by + bh / 2
            d = ((bcx - comp['cx']) ** 2 + (bcy - comp['cy']) ** 2) ** 0.5
            score = iou * 100 - d * 0.1
            candidates.append((score, ci, oi))
    candidates.sort(reverse=True)
    comp_assigned = {}
    used_ocr = set()
    for score, ci, oi in candidates:
        if ci in comp_assigned or oi in used_ocr:
            continue
        bx, by, bw, bh, bconf, btext = ocr_boxes[oi]
        comp_assigned[ci] = {
            'text': btext,
            'confidence': round(float(bconf), 3),
            'source': 'ocr',
            'ocr_iou': round(float(score), 2),
        }
        used_ocr.add(oi)
    return comp_assigned


def analyze_components(filtered_path: str, ocr_boxes, reader=None):
    """Combined OCR + geometry pass on a filtered image.

    Strategy:
      1. Find connected components (one per isolated mark).
      2. Greedy IoU-match each component to a full-image OCR detection.
         Matched components keep their OCR text.
      3. For UNMATCHED components, crop the component with padding,
         upscale 4x (so handwritten digits are ~200px tall instead of
         ~50px), and run EasyOCR on the crop. This is the standard
         technique for handwriting recognition with EasyOCR — full-page
         scans of small handwriting have many marks EasyOCR can't find
         because the text detector gives up below ~20px character height.
         4x upscaling + per-crop pass catches what full-image missed.
      4. For STILL-unmatched components, run geometric classification
         (triangle / > / < / circle).

    Args:
      filtered_path: path to a blue-pen-filtered PNG (black ink on white).
      ocr_boxes: list of (x, y, w, h, confidence, text) from the
                 full-image EasyOCR pass.
      reader: optional pre-loaded EasyOCR reader. If None, one is created.

    Returns a list of per-component dicts sorted top-to-bottom.
    """
    img, comps, inv_bw = find_components(filtered_path)
    comps.sort(key=lambda c: c['cy'])
    assigned = match_components_to_ocr(comps, ocr_boxes)

    # Lazy-init the reader for per-component fallback. The full-image
    # pass used a separate (newer-detector) path, so this is sometimes
    # a fresh instance.
    if reader is None and EASYOCR_AVAILABLE:
        reader = get_fast_easyocr_reader()

    results = []
    for ci, comp in enumerate(comps):
        if ci in assigned:
            entry = dict(assigned[ci])
        else:
            # Per-component OCR with 4x upscaling
            entry = _ocr_single_component(inv_bw, comp, reader)
            if entry is None:
                # Geometry fallback
                comp_crop = inv_bw[comp['y']:comp['y'] + comp['h'], comp['x']:comp['x'] + comp['w']]
                geom = classify_geometry(comp_crop)
                if geom:
                    entry = {'text': geom, 'confidence': 0.4, 'source': 'geometry'}
                else:
                    entry = {'text': '', 'confidence': 0.0, 'source': 'unmatched'}
        entry.update({
            'x': comp['x'], 'y': comp['y'], 'w': comp['w'], 'h': comp['h'],
            'area': comp['area'],
        })
        results.append(entry)
    return results


def _ocr_single_component(inv_bw, comp, reader, upsample: int = 2):
    """Crop one component, upscale, run EasyOCR on the crop.

    Returns a dict with 'text', 'confidence', 'source' on success, or
    None if no detection.

    The crop is padded so the digit has ~25% margin on each side, then
    squared (centered on white) so EasyOCR sees a balanced image. Then
    upsampled with cv2.INTER_CUBIC for smoother edges than nearest-neighbor.

    For per-component OCR we expect exactly one character per crop
    (each connected component is a single digit/shape). If EasyOCR
    returns a multi-character result (e.g. "61" from a "6" with a
    vertical tail), we keep only the first character — multi-char
    results are EasyOCR hallucinating a second character on the side
    of an isolated handwritten digit. Multi-digit numbers like "10"
    are split into "1" + "0" components by the connected-components
    pass, so they get their own crop each.

    Upsample 2x empirically outperforms 4x on handwritten digits: the
    digit is already ~50px wide after the blue-pen filter pipeline
    (close + dilate), so 2x brings it to ~100px which is EasyOCR's
    sweet spot. Going to 4x or higher over-smooths the strokes and
    loses character detail — the per-crop detections degrade.
    """
    if reader is None:
        return None
    if CV2_AVAILABLE is False:
        return None
    h, w = inv_bw.shape[:2]
    pad = max(8, int(max(comp['w'], comp['h']) * 0.25))
    x0 = max(0, comp['x'] - pad)
    y0 = max(0, comp['y'] - pad)
    x1 = min(w, comp['x'] + comp['w'] + pad)
    y1 = min(h, comp['y'] + comp['h'] + pad)
    crop = inv_bw[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    # Square pad to center the mark
    ch, cw = crop.shape[:2]
    side = max(ch, cw)
    sq = np.full((side, side), 255, dtype=np.uint8)
    y_off = (side - ch) // 2
    x_off = (side - cw) // 2
    sq[y_off:y_off + ch, x_off:x_off + cw] = crop
    # Upsample 4x so the digit is ~200px tall (EasyOCR's sweet spot)
    up = cv2.resize(sq, (side * upsample, side * upsample), interpolation=cv2.INTER_CUBIC)
    try:
        res = reader.readtext(
            up,
            allowlist='0123456789+-><=',
            canvas_size=512,
            mag_ratio=1.0,
            text_threshold=0.3,  # very low — we want even weak matches
            low_text=0.2,
            paragraph=False,
            detail=1,
        )
    except Exception as e:
        sys.stderr.write(f"[per-component-ocr] error: {e}\n")
        return None
    if not res:
        return None
    # Pick the highest-confidence, longest detection
    best = max(res, key=lambda r: (r[2] * len(r[1])))
    text = best[1].strip()
    if not text:
        return None
    ocr_conf = float(best[2])
    # Per-component crops should produce a single character. If EasyOCR
    # returned multiple (e.g. "61" on a "6" with a long right tail), keep
    # only the first character — multi-digit numbers are already split
    # by the connected-components pass.
    if len(text) > 1:
        text = text[0]

    # Cross-check with the digit CNN. EasyOCR often misreads handwritten
    # digits (4<->1, 0<->1, 6<->5). The CNN was trained on printed-font
    # digits which is a different distribution from real handwriting,
    # so it's only useful as a tiebreaker when EasyOCR is uncertain.
    # Use it ONLY when EasyOCR confidence is very low (<0.3) — otherwise
    # it overrides correct EasyOCR predictions with wrong ones.
    cnn_result = _cnn_classify_component(sq)
    if cnn_result is not None:
        cnn_digit, cnn_conf = cnn_result
        cnn_text = str(cnn_digit)
        # Only consult CNN when EasyOCR is unsure
        if ocr_conf < 0.3 and cnn_conf > 0.6:
            return {
                'text': cnn_text,
                'confidence': round(cnn_conf, 3),
                'source': 'cnn',
            }

    return {
        'text': text,
        'confidence': round(ocr_conf, 3),
        'source': 'ocr_upsampled',
    }


def _cnn_classify_component(sq_crop):
    """Run the digit CNN on a padded square crop. Returns (digit, conf) or None.

    The crop is the squared (not upsampled) version of the component.
    We resize to 28x28, then the CNN classifies.
    """
    try:
        from digit_cnn import classify, is_available
    except ImportError:
        return None
    if not is_available():
        return None
    if not CV2_AVAILABLE:
        return None
    # Resize the squared crop to 28x28 (CNN input size)
    img = cv2.resize(sq_crop, (28, 28), interpolation=cv2.INTER_AREA)
    # Normalize to [0, 1]
    arr = img.astype(np.float32) / 255.0
    return classify(arr)


def run_fast_ocr(file_path):
    start_time = time.time()
    extracted_tokens = []
    page_texts = []
    
    is_pdf = file_path.lower().endswith('.pdf')

    # Fast path 1: PyPDF instant text stream extraction for PDFs (< 30ms)
    if is_pdf and PYPDF_AVAILABLE and os.path.exists(file_path):
        try:
            reader = pypdf.PdfReader(file_path)
            for page in reader.pages:
                txt = page.extract_text() or ""
                page_texts.append(txt)
        except Exception as e:
            sys.stderr.write(f"[easyocr] PyPDF fast path warning: {e}\n")

    combined_text = "\n".join(page_texts).strip()

    # Fast path 1.5: PaddleOCR (much better at handwritten digits than
    # EasyOCR). If available, run it first and skip EasyOCR entirely.
    # PaddleOCR's PP-OCRv4 recognizer is trained on a much larger and
    # more diverse text distribution, including handwriting-adjacent
    # samples, so it handles the user's handwritten digits far better.
    # IMPORTANT: pass the blue-pen-filtered image (not the original).
    # On the original color JPEG, PaddleOCR's detector merges adjacent
    # numbers into one detection (e.g. 7 numbers -> "11311116116");
    # on the clean B&W filtered image, it finds each number separately.
    ocr_boxes = []  # populated if any OCR engine runs; used by the component pass
    paddle_used = False
    if PADDLE_AVAILABLE and (not combined_text or not is_pdf):
        paddle_reader = get_paddle_reader()
        if paddle_reader is not None:
            try:
                # Use the filtered image if we can produce one quickly.
                # PaddleOCR takes ~40s to init + 1-2s to run; the filter
                # takes ~50ms — well worth the cost.
                paddle_input = file_path
                paddle_filtered = None
                if not is_pdf and CV2_AVAILABLE:
                    paddle_filtered = isolate_blue_pen(file_path)
                    if paddle_filtered and os.path.exists(paddle_filtered):
                        paddle_input = paddle_filtered
                res = paddle_reader.ocr(paddle_input, cls=False)
                if res and res[0]:
                    paddle_used = True
                    res_texts = []
                    for line in res[0]:
                        bbox, info = line
                        # PaddleOCR returns (text, confidence) tuple
                        text, conf = (info if isinstance(info, (list, tuple)) and len(info) >= 2 else (str(info), 0.5))
                        res_texts.append(text)
                        extracted_tokens.append({
                            "text": text,
                            "confidence": round(float(conf), 3),
                            "bbox": [[int(coord) for coord in point] for point in bbox] if isinstance(bbox, (list, tuple)) else []
                        })
                        xs = [p[0] for p in bbox]
                        ys = [p[1] for p in bbox]
                        ocr_boxes.append((
                            int(min(xs)), int(min(ys)),
                            int(max(xs) - min(xs)), int(max(ys) - min(ys)),
                            float(conf), str(text),
                        ))
                    combined_text = " ".join(res_texts)
                if paddle_filtered and os.path.exists(paddle_filtered):
                    try: os.remove(paddle_filtered)
                    except Exception: pass
            except Exception as e:
                sys.stderr.write(f"[paddle] OCR error: {e}\n")
                ocr_boxes = []
                paddle_used = False

    # Fast path 2: EasyOCR (fallback if PaddleOCR unavailable or failed)
    if not paddle_used and EASYOCR_AVAILABLE and (not combined_text or not is_pdf):
        ocr_reader = get_fast_easyocr_reader()
        if ocr_reader:
            target_path = file_path
            temp_resized_path = None

            # Pre-downsample only very large camera/scanned images to 2048px
            # max dimension (faster inference). For notebook scans like
            # 1200x1600 the original is fine — downsampling breaks the
            # per-component match (different components at different scales).
            if not is_pdf and PIL_AVAILABLE:
                try:
                    with Image.open(file_path) as img:
                        w, h = img.size
                        if w > 2048 or h > 2048:
                            img.thumbnail((2048, 2048), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.ANTIALIAS)
                            temp_resized_path = file_path + "_fast_opt.jpg"
                            img.convert('RGB').save(temp_resized_path, "JPEG", quality=80)
                            target_path = temp_resized_path
                except Exception as e:
                    sys.stderr.write(f"[easyocr] PIL downsampling warning: {e}\n")

            # Blue-pen isolation (only for non-PDF image scans). Converts
            # the target image so blue ink becomes black text on white — the
            # format EasyOCR is trained on. We do this AFTER PIL downsampling
            # so the cv2 work happens on a smaller image. Falls back to the
            # unfiltered target_path if cv2 isn't installed or fails.
            temp_blue_path = None
            if not is_pdf and CV2_AVAILABLE:
                blue_path = isolate_blue_pen(target_path)
                if blue_path and os.path.exists(blue_path):
                    temp_blue_path = blue_path
                    target_path = blue_path

            try:
                results = ocr_reader.readtext(
                    target_path,
                    allowlist='0123456789+-><=QAns ',
                    canvas_size=1024,
                    mag_ratio=1.0,
                    text_threshold=0.4,   # lower threshold catches weak marks
                    low_text=0.3,         # lower min-size text threshold
                    paragraph=False,
                    detail=1
                )
                res_texts = []
                # Normalized form for component-matching: (x, y, w, h, conf, text)
                ocr_boxes = []
                for bbox, text, prob in results:
                    res_texts.append(text)
                    extracted_tokens.append({
                        "text": text,
                        "confidence": round(float(prob), 3),
                        "bbox": [[int(coord) for coord in point] for point in bbox] if isinstance(bbox, (list, tuple)) else []
                    })
                    xs = [p[0] for p in bbox]
                    ys = [p[1] for p in bbox]
                    ocr_boxes.append((
                        int(min(xs)), int(min(ys)),
                        int(max(xs) - min(xs)), int(max(ys) - min(ys)),
                        float(prob), text,
                    ))
                combined_text = " ".join(res_texts)
            except Exception as e:
                sys.stderr.write(f"[easyocr] Fast readtext error: {e}\n")
                ocr_boxes = []
            finally:
                if temp_resized_path and os.path.exists(temp_resized_path):
                    try:
                        os.remove(temp_resized_path)
                    except Exception:
                        pass
                if temp_blue_path and os.path.exists(temp_blue_path):
                    try:
                        os.remove(temp_blue_path)
                    except Exception:
                        pass

    # Combined per-component pass: matches each connected component to an
    # OCR detection by IoU, falling back to geometric classification
    # (triangle / > / < / circle) for non-text marks. Only runs on non-PDF
    # images where blue-pen isolation was applied (i.e. CV2 + image path).
    # Skipped when PaddleOCR found a healthy number of tokens — its full
    # image detection is more reliable than per-crop EasyOCR on
    # handwritten digits.
    component_sequence = []
    skip_per_component = paddle_used and len(ocr_boxes) >= 3
    if not skip_per_component and not is_pdf and CV2_AVAILABLE and EASYOCR_AVAILABLE and ocr_boxes:
        try:
            # The EasyOCR pass above ran blue-pen isolation on a PIL-downsampled
            # copy of the image, so its bbox coordinates are in downsampled
            # Run the per-component analysis on the ORIGINAL resolution
            # filtered image, not the PIL-downsampled copy. The
            # downsampled image gives a different set of connected
            # components (small digits merge or split), which breaks
            # the IoU match against the EasyOCR bboxes that were
            # detected on the full-resolution pass too. The original
            # image is only 1200x1600 max for our scans, so the
            # per-component analysis is fast enough without downsampling.
            re_filtered = isolate_blue_pen(file_path)
            if re_filtered and os.path.exists(re_filtered):
                try:
                    # If EasyOCR ran, reuse its reader for the per-component
                    # OCR fallback. If PaddleOCR ran, fall back to EasyOCR
                    # here (so we still have a reader for unmatched components).
                    fallback_reader = ocr_reader if ocr_reader else get_fast_easyocr_reader()
                    component_sequence = analyze_components(
                        re_filtered, ocr_boxes, reader=fallback_reader,
                    )
                finally:
                    if os.path.exists(re_filtered):
                        try: os.remove(re_filtered)
                        except Exception: pass
        except Exception as e:
            sys.stderr.write(f"[easyocr] analyze_components error: {e}\n")
            component_sequence = []

    if not extracted_tokens and combined_text:
        found_nums = re.findall(r'\b\d+\b', combined_text)
        for num in found_nums:
            extracted_tokens.append({
                "text": num,
                "confidence": 0.96,
                "bbox": []
            })

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "rawOcrText": combined_text[:600] if combined_text else "No raw text detected",
        "extractedTokens": extracted_tokens,
        "processingTimeMs": elapsed_ms,
        "easyOcrLoaded": EASYOCR_AVAILABLE,
        "isImage": not is_pdf,
        # Per-component sequence (top-to-bottom) of every isolated mark in
        # the image. Each entry has text/confidence/source ('ocr',
        # 'geometry', or 'unmatched') plus bbox. Empty for PDFs.
        "componentSequence": component_sequence,
        "paddleUsed": paddle_used,
    }


def evaluate_student_file(file_path, student_id="ALL_STUDENTS", class_num=1):
    ocr_data = run_fast_ocr(file_path)
    num_matches = re.findall(r'(?:Q\d+|Ans|\b)(\d+)\b', ocr_data["rawOcrText"])

    return {
        "studentId": student_id,
        "classNum": class_num,
        "filePath": file_path,
        "ocrEngine": ("PaddleOCR (PP-OCRv4)" if ocr_data.get("paddleUsed") else "EasyOCR (PyTorch Fast Reader)"),
        "processingTimeMs": ocr_data["processingTimeMs"],
        "rawOcrText": ocr_data["rawOcrText"],
        "extractedTokens": ocr_data["extractedTokens"],
        "detectedNumbers": num_matches,
        "componentSequence": ocr_data.get("componentSequence", []),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python easyocr_evaluator.py <file_path> [student_id] [class_num]"}))
        sys.exit(1)

    file_path = sys.argv[1]
    student_id = sys.argv[2] if len(sys.argv) > 2 else "ALL_STUDENTS"
    class_num = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    if not os.path.exists(file_path):
        print(json.dumps({
            "status": "error",
            "error": f"File not found: {file_path}"
        }))
        sys.exit(1)

    result = evaluate_student_file(file_path, student_id, class_num)

    output = {
        "status": "success",
        "engine": "EasyOCR (PyTorch Fast Reader)",
        "easyOcrLoaded": EASYOCR_AVAILABLE,
        "processingTimeMs": result["processingTimeMs"],
        "studentId": student_id,
        "classNum": class_num,
        "evaluation": result
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
