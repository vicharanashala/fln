"""Template loading and validation for fixed answer-box papers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .preprocess import STANDARD_A4

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_DIR = ROOT / "templates"


class TemplateError(ValueError):
    """Raised when a paper template is missing or invalid."""


def _candidate_template_paths(paper_id: str) -> list[Path]:
    safe_name = "".join(character for character in paper_id if character.isalnum() or character in "._-")
    return [
        TEMPLATE_DIR / f"{safe_name}.json",
        TEMPLATE_DIR / safe_name / "template.json",
    ]


def load_template(paper_id: str | None, supplied_template: dict[str, Any] | None = None) -> dict[str, Any]:
    """Load a template from the request or from services/model/templates."""

    if supplied_template:
        return validate_template(supplied_template)

    if not paper_id:
        raise TemplateError("paper_id is required to load a template.")

    for path in _candidate_template_paths(paper_id):
        if path.exists():
            return validate_template(json.loads(path.read_text(encoding="utf-8")))

    raise TemplateError(f"No template JSON found for paper_id '{paper_id}'.")


def validate_template(template: dict[str, Any]) -> dict[str, Any]:
    """Validate and normalize the template shape used by the MVP pipeline."""

    paper_id = template.get("paper_id") or template.get("paperId") or template.get("id")
    questions = template.get("questions") or template.get("answerRegions")
    if not paper_id:
        raise TemplateError("Template is missing paper_id.")
    if not isinstance(questions, list) or not questions:
        raise TemplateError("Template must include at least one question ROI.")

    page = template.get("page") or {}
    normalized = {
        "paper_id": paper_id,
        "test_id": template.get("test_id") or template.get("testId") or template.get("assessmentId"),
        "answer_key_id": template.get("answer_key_id")
        or template.get("answerKeyId")
        or f"{template.get('test_id') or template.get('testId') or template.get('assessmentId')}:answer-key",
        "box_markers_required": bool(template.get("box_markers_required", template.get("boxMarkersRequired", False))),
        "page": {
            "width": int(page.get("width", STANDARD_A4["width"])),
            "height": int(page.get("height", STANDARD_A4["height"])),
            "marker_center_inset_x": int(page.get("marker_center_inset_x", 0)),
            "marker_center_inset_y": int(page.get("marker_center_inset_y", 0)),
        },
        "questions": [],
        "answer_key": template.get("answer_key") or template.get("answerKey") or {},
    }

    for index, question in enumerate(questions, start=1):
        roi = question.get("roi") or {
            "x": question.get("x"),
            "y": question.get("y"),
            "width": question.get("width"),
            "height": question.get("height"),
        }
        if any(roi.get(key) is None for key in ("x", "y", "width", "height")):
            raise TemplateError(f"Question ROI at index {index} is incomplete.")

        question_id = question.get("question_id") or question.get("questionId") or question.get("id") or f"q{index}"
        normalized["questions"].append(
            {
                "question_id": question_id,
                "label": question.get("label") or f"Q{index}",
                "type": question.get("type") or question.get("questionType") or "short_text",
                "source_question_type": question.get("source_question_type") or question.get("questionType"),
                "prompt": question.get("prompt") or "",
                "answer_key": question.get("answer_key")
                or question.get("answerKey")
                or normalized["answer_key"].get(question_id),
                "marks": float(question.get("marks") or question.get("maxMarks") or 1),
                "roi": roi,
                "auto_score": bool(question.get("auto_score", question.get("autoScoreEligible", True))),
            }
        )

    return normalized
