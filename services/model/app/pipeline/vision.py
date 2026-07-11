"""QR, marker detection, and page alignment stages."""

from __future__ import annotations

import importlib.util
import json
import re
from typing import Any

from PIL import Image

from .preprocess import STANDARD_A4, enhance_page, resize_to_standard_page

_CV2_AVAILABLE = importlib.util.find_spec("cv2") is not None


def available_vision_providers() -> dict[str, bool]:
    return {
        "opencv": _CV2_AVAILABLE,
        "pillow_marker_detection": True,
    }


def parse_qr_payload(qr_text: str | None) -> dict[str, Any]:
    """Parse SmartFLN QR text into identity fields.

    Supported MVP formats:
    - JSON with student_id/paper_id/test_id or SmartFLN camelCase fields
    - key/value strings such as student_id=...;paper_id=...;test_id=...
    - pipe strings such as student_id|paper_id|test_id
    - existing web MVP token SFLN:pp_xxx:checksum
    """

    value = (qr_text or "").strip()
    if not value:
        return {}

    if value.startswith("{"):
        try:
            payload = json.loads(value)
        except json.JSONDecodeError:
            payload = {}
        return {
            "student_id": payload.get("student_id") or payload.get("studentId"),
            "paper_id": payload.get("paper_id") or payload.get("paperId") or payload.get("paperPageId"),
            "test_id": payload.get("test_id") or payload.get("testId") or payload.get("assessmentId"),
            "paper_page_id": payload.get("paperPageId"),
            "raw": value,
            "schema": payload.get("schema"),
        }

    smartfln_match = re.match(r"^SFLN:(pp_[a-z0-9]+):([a-f0-9]{8})$", value, re.IGNORECASE)
    if smartfln_match:
        return {
            "paper_id": smartfln_match.group(1),
            "paper_page_id": smartfln_match.group(1),
            "raw": value,
            "schema": "smartfln.short.v1",
        }

    if "=" in value:
        parts = re.split(r"[;,&]", value)
        parsed: dict[str, str] = {}
        for part in parts:
            if "=" not in part:
                continue
            key, item_value = part.split("=", 1)
            parsed[key.strip()] = item_value.strip()
        return {
            "student_id": parsed.get("student_id") or parsed.get("studentId"),
            "paper_id": parsed.get("paper_id") or parsed.get("paperId"),
            "test_id": parsed.get("test_id") or parsed.get("testId"),
            "raw": value,
            "schema": "key_value",
        }

    if "|" in value:
        parts = [part.strip() for part in value.split("|")]
        return {
            "student_id": parts[0] if len(parts) > 0 else None,
            "paper_id": parts[1] if len(parts) > 1 else None,
            "test_id": parts[2] if len(parts) > 2 else None,
            "raw": value,
            "schema": "pipe",
        }

    return {"raw": value, "schema": "unknown"}


def read_qr_text(image: Image.Image, supplied_qr_text: str | None = None) -> dict[str, Any]:
    """Read QR text using OpenCV when available, otherwise use supplied text."""

    if supplied_qr_text:
        return {
            "qrText": supplied_qr_text,
            "confidence": 0.99,
            "provider": "payload",
            "status": "provided",
        }

    if not _CV2_AVAILABLE:
        return {
            "qrText": None,
            "confidence": 0.0,
            "provider": "none",
            "status": "opencv_not_installed",
        }

    try:  # pragma: no cover - cv2 is optional in the local test runtime
        import cv2
        import numpy as np

        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        detector = cv2.QRCodeDetector()
        qr_text, points, _ = detector.detectAndDecode(cv_image)
        return {
            "qrText": qr_text or None,
            "confidence": 0.95 if qr_text else 0.0,
            "provider": "opencv.QRCodeDetector",
            "status": "decoded" if qr_text else "not_found",
            "points": points.tolist() if points is not None else None,
        }
    except Exception as error:
        return {
            "qrText": None,
            "confidence": 0.0,
            "provider": "opencv.QRCodeDetector",
            "status": "error",
            "error": str(error),
        }


def _fallback_markers(image: Image.Image) -> dict[str, Any]:
    return {
        "markers": [
            {"x": 0, "y": 0},
            {"x": image.width - 1, "y": 0},
            {"x": image.width - 1, "y": image.height - 1},
            {"x": 0, "y": image.height - 1},
        ],
        "confidence": 0.42,
        "status": "fallback_page_bounds",
        "provider": "pillow",
    }


def _corner_dark_ratio(gray: Image.Image, box: tuple[int, int, int, int]) -> float:
    region = gray.crop(box)
    histogram = region.histogram()
    dark = sum(histogram[:55])
    return dark / max(1, region.width * region.height)


def _detect_page_markers_pillow(image: Image.Image) -> dict[str, Any] | None:
    gray = image.convert("L")
    width, height = image.size
    if width < 400 or height < 600:
        return None

    region_w = max(80, int(width * 0.11))
    region_h = max(80, int(height * 0.08))
    boxes = [
        (0, 0, region_w, region_h),
        (width - region_w, 0, width, region_h),
        (width - region_w, height - region_h, width, height),
        (0, height - region_h, region_w, height),
    ]
    ratios = [_corner_dark_ratio(gray, box) for box in boxes]
    if min(ratios) < 0.045:
        return None

    return {
        "markers": [
            {"x": round(region_w / 2, 1), "y": round(region_h / 2, 1)},
            {"x": round(width - region_w / 2, 1), "y": round(region_h / 2, 1)},
            {"x": round(width - region_w / 2, 1), "y": round(height - region_h / 2, 1)},
            {"x": round(region_w / 2, 1), "y": round(height - region_h / 2, 1)},
        ],
        "confidence": 0.84,
        "status": "detected_pillow",
        "provider": "pillow.corner_dark_regions",
        "cornerDarkRatios": [round(value, 4) for value in ratios],
    }


def detect_page_markers(image: Image.Image) -> dict[str, Any]:
    """Detect four corner markers when OpenCV is installed."""

    if not _CV2_AVAILABLE:
        return _detect_page_markers_pillow(image) or _fallback_markers(image)

    try:  # pragma: no cover - cv2 is optional in the local test runtime
        import cv2
        import numpy as np

        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        blurred = cv2.GaussianBlur(cv_image, (5, 5), 0)
        _, threshold = cv2.threshold(blurred, 70, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        page_area = image.width * image.height
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < page_area * 0.00015 or area > page_area * 0.03:
                continue
            x, y, width, height = cv2.boundingRect(contour)
            aspect = width / max(1, height)
            if 0.45 <= aspect <= 2.2:
                candidates.append({"x": x + width / 2, "y": y + height / 2, "area": area})

        if len(candidates) < 4:
            return _detect_page_markers_pillow(image) or {**_fallback_markers(image), "status": "markers_not_found"}

        corners = {
            "tl": min(candidates, key=lambda point: point["x"] + point["y"]),
            "tr": min(candidates, key=lambda point: (image.width - point["x"]) + point["y"]),
            "br": min(candidates, key=lambda point: (image.width - point["x"]) + (image.height - point["y"])),
            "bl": min(candidates, key=lambda point: point["x"] + (image.height - point["y"])),
        }
        ordered = [corners["tl"], corners["tr"], corners["br"], corners["bl"]]
        return {
            "markers": [{"x": round(point["x"], 1), "y": round(point["y"], 1)} for point in ordered],
            "confidence": 0.9,
            "status": "detected",
            "provider": "opencv.contours",
            "candidateCount": len(candidates),
        }
    except Exception as error:
        return {**_fallback_markers(image), "status": "error", "error": str(error)}


def align_page(image: Image.Image, marker_result: dict[str, Any], page_size: dict[str, int] | None = None) -> dict[str, Any]:
    """Apply perspective correction if OpenCV markers are available."""

    page_size = page_size or STANDARD_A4
    width = int(page_size.get("width", STANDARD_A4["width"]))
    height = int(page_size.get("height", STANDARD_A4["height"]))

    if not _CV2_AVAILABLE or marker_result.get("status") != "detected":
        resized = resize_to_standard_page(enhance_page(image), {"width": width, "height": height})
        already_standard = image.size == (width, height) and str(marker_result.get("status", "")).startswith("detected")
        return {
            "image": resized,
            "perspectiveCorrected": False,
            "status": "already_aligned_no_perspective" if already_standard else "resized_without_perspective",
            "confidence": 0.84 if already_standard else min(0.58, float(marker_result.get("confidence", 0.4))),
        }

    try:  # pragma: no cover - cv2 is optional in the local test runtime
        import cv2
        import numpy as np

        source = np.float32([[point["x"], point["y"]] for point in marker_result["markers"]])
        target = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
        transform = cv2.getPerspectiveTransform(source, target)
        warped = cv2.warpPerspective(np.array(image), transform, (width, height))
        aligned = Image.fromarray(warped).convert("RGB")
        return {
            "image": enhance_page(aligned),
            "perspectiveCorrected": True,
            "status": "perspective_corrected",
            "confidence": 0.92,
        }
    except Exception as error:
        resized = resize_to_standard_page(enhance_page(image), {"width": width, "height": height})
        return {
            "image": resized,
            "perspectiveCorrected": False,
            "status": "perspective_error",
            "confidence": 0.5,
            "error": str(error),
        }
