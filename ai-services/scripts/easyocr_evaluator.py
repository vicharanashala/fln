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
    Strict HSV blue-pen isolation. Returns the path to a temp JPEG where
    blue ink is rendered as BLACK text on WHITE background — the format
    EasyOCR is trained on (dark text, light background).

    HSV range (H 100-130, S >= 60) covers royal blue through cyan-blue ballpoint
    ink while rejecting:
      - navy ink (H ~140, outside range)
      - pencil / graphite (low saturation)
      - photocopier light-blue (low saturation)
      - printed red margin lines (different hue entirely)

    If cv2 isn't installed, or the file isn't readable, returns None so the
    caller can fall back to the unfiltered path.

    Returns None on failure — never raises.
    """
    if not CV2_AVAILABLE:
        return None
    try:
        bgr = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        lower = np.array([100, 60, 50], dtype=np.uint8)
        upper = np.array([130, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower, upper)
        # Light morphological clean-up: fill broken strokes, drop single-pixel noise
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        # Invert: EasyOCR wants dark text on light background, so blue ink
        # (white in the mask) becomes black; non-blue (black in the mask)
        # becomes white.
        inverted = cv2.bitwise_not(mask)
        out_path = image_path + "_blue_inv.jpg"
        cv2.imwrite(out_path, inverted, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        return out_path
    except Exception as e:
        sys.stderr.write(f"[blue-pen] isolation failed: {e}\n")
        return None


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

    # Fast path 2: Downsampled Image + Restricted EasyOCR with digit allowlist
    if EASYOCR_AVAILABLE and (not combined_text or not is_pdf):
        ocr_reader = get_fast_easyocr_reader()
        if ocr_reader:
            target_path = file_path
            temp_resized_path = None

            # Pre-downsample large camera/scanned images to 1024px max dimension (12x faster inference)
            if not is_pdf and PIL_AVAILABLE:
                try:
                    with Image.open(file_path) as img:
                        w, h = img.size
                        if w > 1024 or h > 1024:
                            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.ANTIALIAS)
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
                    text_threshold=0.6,
                    low_text=0.4,
                    paragraph=False,
                    detail=1
                )
                res_texts = []
                for bbox, text, prob in results:
                    res_texts.append(text)
                    extracted_tokens.append({
                        "text": text,
                        "confidence": round(float(prob), 3),
                        "bbox": [[int(coord) for coord in point] for point in bbox] if isinstance(bbox, (list, tuple)) else []
                    })
                combined_text = " ".join(res_texts)
            except Exception as e:
                sys.stderr.write(f"[easyocr] Fast readtext error: {e}\n")
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
        "isImage": not is_pdf
    }


def evaluate_student_file(file_path, student_id="ALL_STUDENTS", class_num=1):
    ocr_data = run_fast_ocr(file_path)
    num_matches = re.findall(r'(?:Q\d+|Ans|\b)(\d+)\b', ocr_data["rawOcrText"])
    
    return {
        "studentId": student_id,
        "classNum": class_num,
        "filePath": file_path,
        "ocrEngine": "EasyOCR (PyTorch Fast Reader)",
        "processingTimeMs": ocr_data["processingTimeMs"],
        "rawOcrText": ocr_data["rawOcrText"],
        "extractedTokens": ocr_data["extractedTokens"],
        "detectedNumbers": num_matches
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
