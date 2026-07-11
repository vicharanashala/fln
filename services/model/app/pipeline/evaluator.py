"""End-to-end structured scan evaluation pipeline."""

from __future__ import annotations

from typing import Any

from .preprocess import (
    estimate_image_quality,
    image_to_data_url,
    load_image_from_data_url,
    preprocess_roi,
)
from .recognition import MODEL_NAME, MODEL_VERSION, recognize_answer
from .roi import crop_answer_roi, detect_answer_box_marker, roi_quality
from .scoring import score_answer
from .templates import TemplateError, load_template
from .vision import align_page, detect_page_markers, parse_qr_payload, read_qr_text

VALID_MARKER_STATUSES = {"detected", "detected_pillow"}


def _crop_preview_data_url(crop) -> str:
    preview = crop.copy()
    preview.thumbnail((960, 260))
    return image_to_data_url(preview)


def _recognition_state(recognition: dict[str, Any]) -> dict[str, Any]:
    provider_status = recognition.get("providerStatus")
    diagnostics = recognition.get("diagnostics", {})
    ink = diagnostics.get("ink") if isinstance(diagnostics, dict) else None
    answer_detected = bool(isinstance(ink, dict) and ink.get("usableInk"))

    if recognition.get("recognizedAnswer"):
        label = "Text read"
        status = "recognized"
    elif provider_status == "ink_detected_ocr_required":
        label = "OCR required"
        status = "ocr_required"
    elif provider_status == "blank_or_unreadable":
        label = "Blank or unreadable"
        status = "blank_or_unreadable"
    else:
        label = "Not recognized"
        status = "not_recognized"

    return {
        "answer_detected": answer_detected,
        "recognition_status": status,
        "recognition_label": label,
    }


def _marker_missing_recognition(marker: dict[str, Any]) -> dict[str, Any]:
    return {
        "recognizedAnswer": "",
        "confidence": 0.15,
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "providerStatus": "answer_box_marker_missing",
        "diagnostics": {
            "summary": "Expected answer-box identification marker was not detected, so OCR was skipped for this ROI.",
            "boxMarker": marker,
        },
    }


def _markers_are_valid(markers: dict[str, Any]) -> bool:
    return (
        markers.get("status") in VALID_MARKER_STATUSES
        and len(markers.get("markers") or []) == 4
        and float(markers.get("confidence", 0.0)) >= 0.75
    )


def _paper_validation_checks(
    qr_result: dict[str, Any],
    qr_identity: dict[str, Any],
    markers: dict[str, Any],
    template_loaded: bool = False,
    template_matches_qr: bool = False,
) -> dict[str, bool]:
    return {
        "qr_present": bool(qr_result.get("qrText")),
        "qr_has_student_id": bool(qr_identity.get("student_id")),
        "qr_has_paper_id": bool(qr_identity.get("paper_id")),
        "qr_has_test_id": bool(qr_identity.get("test_id")),
        "four_markers_detected": _markers_are_valid(markers),
        "template_loaded": template_loaded,
        "template_matches_qr": template_matches_qr,
    }


def _invalid_paper_response(
    scan_id: str | None,
    reason: str,
    page_quality: dict[str, Any],
    qr_result: dict[str, Any],
    qr_identity: dict[str, Any],
    markers: dict[str, Any],
    checks: dict[str, bool],
    message: str | None = None,
) -> dict[str, Any]:
    return {
        "error": "invalid_paper",
        "status": "invalid_paper",
        "message": message
        or "Invalid paper. Upload a SmartFLN answer paper with one valid QR code and four black corner markers.",
        "invalid_reason": reason,
        "valid_paper": False,
        "ocr_started": False,
        "scan_id": scan_id,
        "student_id": qr_identity.get("student_id"),
        "paper_id": qr_identity.get("paper_id"),
        "test_id": qr_identity.get("test_id"),
        "identity": {
            "qr_text": qr_result.get("qrText"),
            "qr_status": qr_result.get("status"),
            "qr_provider": qr_result.get("provider"),
            "parsed": qr_identity,
        },
        "page": {
            "quality": page_quality,
            "markers": markers,
        },
        "validation": {
            "checks": checks,
            "failed": [name for name, passed in checks.items() if not passed],
        },
        "answers": [],
        "total_marks": 0.0,
        "awarded_marks": 0.0,
        "percentage": 0.0,
        "needs_teacher_review": False,
        "review_count": 0,
        "final_confidence": 0.0,
        "pipeline": [
            "uploaded",
            "qr_decoded" if qr_result.get("qrText") else "qr_missing",
            "markers_detected" if _markers_are_valid(markers) else "markers_missing",
            "paper_validation_failed",
            "ocr_skipped",
        ],
    }


def infer_crops(payload: dict[str, Any]) -> dict[str, Any]:
    """Maintain the existing crop-level contract used by the MERN API."""

    results = []
    for crop in payload.get("crops", []):
        question = {
            "question_id": crop.get("questionId"),
            "label": crop.get("questionId"),
            "type": crop.get("questionType"),
            "prompt": crop.get("prompt", ""),
            "answer_key": crop.get("answerKey"),
            "marks": crop.get("maxMarks") or crop.get("marks") or 1,
            "auto_score": True,
        }
        try:
            image = load_image_from_data_url(str(crop.get("imageDataUrl", "")))
            processed = preprocess_roi(image)
            recognition = recognize_answer(processed, question)
            scoring = score_answer(question, recognition["recognizedAnswer"], recognition["confidence"])
        except Exception as error:
            recognition = {
                "recognizedAnswer": "",
                "confidence": 0.2,
                "modelName": MODEL_NAME,
                "modelVersion": MODEL_VERSION,
                "providerStatus": "crop_error",
                "diagnostics": {"error": str(error)},
            }
            scoring = {
                "confidence": 0.2,
                "confidenceBand": "very_low",
                "needsReview": True,
                "awardedMarks": 0.0,
                "maxMarks": float(question["marks"]),
                "status": "needs_review",
            }

        results.append(
            {
                "questionId": crop.get("questionId"),
                "recognizedAnswer": recognition["recognizedAnswer"],
                "confidence": scoring["confidence"],
                "needsReview": scoring["needsReview"],
                "modelName": recognition["modelName"],
                "modelVersion": recognition["modelVersion"],
                "providerStatus": recognition["providerStatus"],
                "diagnostics": {
                    **recognition.get("diagnostics", {}),
                    "scoring": scoring,
                    "questionType": crop.get("questionType"),
                },
            }
        )

    return {
        "scanPageId": payload.get("scanPageId"),
        "assessmentId": payload.get("assessmentId"),
        "studentId": payload.get("studentId"),
        "results": results,
    }


def infer_full_scan(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate a full scanned answer sheet using QR identity and template ROIs."""

    scan_id = payload.get("scanPageId") or payload.get("scan_id")
    image = load_image_from_data_url(str(payload.get("imageDataUrl", "")))
    page_quality = estimate_image_quality(image)

    qr_result = read_qr_text(image, payload.get("qrText"))
    qr_identity = parse_qr_payload(qr_result.get("qrText"))
    markers = detect_page_markers(image)
    paper_id = qr_identity.get("paper_id")
    student_id = qr_identity.get("student_id")
    test_id = qr_identity.get("test_id")

    checks = _paper_validation_checks(qr_result, qr_identity, markers)
    identity_and_markers_valid = all(
        checks[name]
        for name in (
            "qr_present",
            "qr_has_student_id",
            "qr_has_paper_id",
            "qr_has_test_id",
            "four_markers_detected",
        )
    )
    if not identity_and_markers_valid:
        return _invalid_paper_response(
            scan_id,
            "missing_required_smartfln_signals",
            page_quality,
            qr_result,
            qr_identity,
            markers,
            checks,
        )

    try:
        template = load_template(paper_id, payload.get("template"))
    except TemplateError as error:
        return _invalid_paper_response(
            scan_id,
            "template_not_found",
            page_quality,
            qr_result,
            qr_identity,
            markers,
            {**checks, "template_loaded": False, "template_matches_qr": False},
            f"Invalid paper. QR paper_id '{paper_id}' does not have a known SmartFLN template. {error}",
        )

    template_matches_qr = template.get("paper_id") == paper_id
    checks = _paper_validation_checks(qr_result, qr_identity, markers, True, template_matches_qr)
    if not template_matches_qr:
        return _invalid_paper_response(
            scan_id,
            "template_paper_mismatch",
            page_quality,
            qr_result,
            qr_identity,
            markers,
            checks,
            "Invalid paper. The QR paper_id does not match the loaded answer-sheet template.",
        )

    alignment = align_page(image, markers, template.get("page"))
    aligned_page = alignment["image"]

    answers = []
    total_marks = 0.0
    awarded_marks = 0.0
    review_count = 0

    for question in template["questions"]:
        box_marker = detect_answer_box_marker(aligned_page, question["roi"], question.get("label"))
        crop, normalized_roi = crop_answer_roi(aligned_page, question["roi"])
        crop_metrics = roi_quality(crop)
        if template.get("box_markers_required") and not box_marker["detected"]:
            recognition = _marker_missing_recognition(box_marker)
        else:
            processed_roi = preprocess_roi(crop)
            recognition = recognize_answer(processed_roi, question)
        scoring = score_answer(
            question,
            recognition["recognizedAnswer"],
            recognition["confidence"],
            crop_metrics["quality"],
        )
        total_marks += scoring["maxMarks"]
        awarded_marks += scoring["awardedMarks"]
        review_count += 1 if scoring["needsReview"] else 0
        answers.append(
            {
                "question_id": question["question_id"],
                "label": question["label"],
                "type": question["type"],
                "recognized_answer": recognition["recognizedAnswer"],
                **_recognition_state(recognition),
                "answer_key": question.get("answer_key"),
                "awarded_marks": scoring["awardedMarks"],
                "max_marks": scoring["maxMarks"],
                "confidence": scoring["confidence"],
                "confidence_band": scoring["confidenceBand"],
                "needs_teacher_review": scoring["needsReview"],
                "status": scoring["status"],
                "normalized_answer": scoring.get("normalizedAnswer"),
                "normalized_key": scoring.get("normalizedKey"),
                "match_score": scoring.get("matchScore"),
                "is_correct": scoring.get("isCorrect"),
                "roi": normalized_roi,
                "box_marker": box_marker,
                "crop_image_data_url": _crop_preview_data_url(crop),
                "crop_quality": crop_metrics,
                "ocr": {
                    "model_name": recognition["modelName"],
                    "model_version": recognition["modelVersion"],
                    "provider_status": recognition["providerStatus"],
                    "diagnostics": recognition.get("diagnostics", {}),
                },
            }
        )

    final_confidence = min(
        float(page_quality["qualityScore"]),
        float(qr_result.get("confidence", 0.0)) if qr_result.get("qrText") else 0.4,
        float(alignment.get("confidence", 0.5)),
        min((answer["confidence"] for answer in answers), default=0.0),
    )

    return {
        "scan_id": scan_id,
        "student_id": student_id,
        "paper_id": paper_id,
        "test_id": test_id,
        "answer_key_id": template.get("answer_key_id"),
        "valid_paper": True,
        "ocr_started": True,
        "identity": {
            "qr_text": qr_result.get("qrText"),
            "qr_status": qr_result.get("status"),
            "qr_provider": qr_result.get("provider"),
            "parsed": qr_identity,
        },
        "answer_key": {
            "answer_key_id": template.get("answer_key_id"),
            "source": "template",
            "mapped_from_test_id": test_id,
            "paper_id": paper_id,
        },
        "page": {
            "standard_width": aligned_page.width,
            "standard_height": aligned_page.height,
            "quality": page_quality,
            "markers": markers,
            "alignment": {
                key: value
                for key, value in alignment.items()
                if key != "image"
            },
        },
        "validation": {
            "checks": checks,
            "failed": [],
        },
        "answers": answers,
        "total_marks": round(total_marks, 2),
        "awarded_marks": round(awarded_marks, 2),
        "percentage": round((awarded_marks / total_marks) * 100, 2) if total_marks else 0.0,
        "needs_teacher_review": review_count > 0,
        "review_count": review_count,
        "final_confidence": round(final_confidence, 3),
        "pipeline": [
            "uploaded",
            "qr_decoded" if qr_result.get("qrText") else "qr_pending",
            "markers_detected" if _markers_are_valid(markers) else "markers_fallback",
            "paper_validated",
            "page_aligned",
            "template_loaded",
            "answer_rois_cropped",
            "roi_preprocessed",
            "ocr_completed",
            "answers_scored",
            "review_routed",
        ],
    }


def infer(payload: dict[str, Any]) -> dict[str, Any]:
    """Route request payloads to crop inference or full-page inference."""

    if payload.get("imageDataUrl"):
        try:
            return infer_full_scan(payload)
        except TemplateError as error:
            return {
                "error": "template_error",
                "message": str(error),
                "needs_teacher_review": True,
            }
    return infer_crops(payload)
