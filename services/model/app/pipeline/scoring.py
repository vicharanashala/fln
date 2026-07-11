"""Answer normalization, scoring, confidence, and review routing."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

REVIEW_THRESHOLD = 0.82


def normalize_text(value: Any) -> str:
    """Normalize OCR text for constrained answer comparison."""

    if value is None:
        return ""
    text = str(value).strip().lower()
    text = text.replace("\n", " ")
    text = re.sub(r"[^a-z0-9./+\-= ]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def similarity(left: Any, right: Any) -> float:
    """Return a normalized similarity score between two answer strings."""

    left_text = normalize_text(left)
    right_text = normalize_text(right)
    if not left_text and not right_text:
        return 1.0
    if not left_text or not right_text:
        return 0.0
    if left_text == right_text:
        return 1.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def compare_answer(question: dict[str, Any], recognized_answer: Any) -> dict[str, Any]:
    """Compare recognized text with answer key for MVP question types."""

    answer_key = question.get("answer_key")
    question_type = str(question.get("type") or "short_text").lower()

    if isinstance(answer_key, dict):
        recognized_text = normalize_text(recognized_answer)
        expected_pairs = [f"{normalize_text(key)}:{normalize_text(value)}" for key, value in answer_key.items()]
        expected_text = " ".join(expected_pairs)
        match_score = similarity(recognized_text, expected_text)
        return {
            "isCorrect": match_score >= 0.9,
            "matchScore": round(match_score, 3),
            "normalizedAnswer": recognized_text,
            "normalizedKey": expected_text,
        }

    normalized_answer = normalize_text(recognized_answer)
    normalized_key = normalize_text(answer_key)

    if question_type in {"mcq", "multiple_choice", "numeric"}:
        is_correct = normalized_answer == normalized_key
        match_score = 1.0 if is_correct else 0.0
    else:
        match_score = similarity(normalized_answer, normalized_key)
        is_correct = match_score >= 0.88

    return {
        "isCorrect": is_correct,
        "matchScore": round(match_score, 3),
        "normalizedAnswer": normalized_answer,
        "normalizedKey": normalized_key,
    }


def confidence_band(confidence: float) -> str:
    if confidence >= 0.9:
        return "high"
    if confidence >= REVIEW_THRESHOLD:
        return "medium"
    if confidence >= 0.55:
        return "low"
    return "very_low"


def score_answer(question: dict[str, Any], recognized_answer: Any, ocr_confidence: float, crop_quality: float = 0.86) -> dict[str, Any]:
    """Assign marks and decide teacher-review routing."""

    comparison = compare_answer(question, recognized_answer)
    marks = float(question.get("marks") or 1)
    confidence = max(0.0, min(0.99, float(ocr_confidence) * 0.72 + float(crop_quality) * 0.18 + comparison["matchScore"] * 0.1))
    auto_score = bool(question.get("auto_score", True))
    needs_review = (
        confidence < REVIEW_THRESHOLD
        or not auto_score
        or not comparison["isCorrect"] and confidence < 0.92
    )

    return {
        "awardedMarks": marks if comparison["isCorrect"] else 0.0,
        "maxMarks": marks,
        "confidence": round(confidence, 3),
        "confidenceBand": confidence_band(confidence),
        "needsReview": needs_review,
        "status": "needs_review" if needs_review else "auto_scored",
        **comparison,
    }
