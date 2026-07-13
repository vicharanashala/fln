from typing import List, Dict, Any

from utils.logger import get_logger

logger = get_logger("question-parser")

VALID_TYPES = {
    "MCQ", "True/False", "Fill in the Blanks", "Short Answer", "Long Answer",
    "Match the Following", "Counting", "Addition", "Subtraction",
    "Number Recognition", "Drawing", "Trace",
}
VALID_DIFFICULTY = {"Easy", "Medium", "Hard"}
VALID_RULES = {"exact", "contains", "tolerance", "range", "subjective", "manual"}


def _coerce_question(raw: Dict[str, Any], index: int) -> Dict[str, Any]:
    """Normalize a raw question dict to the schema expected by the API."""
    qno = raw.get("questionNo")
    if not isinstance(qno, int):
        try:
            qno = int(qno)
        except Exception:
            qno = index + 1

    qtype = raw.get("questionType", "Short Answer")
    if qtype not in VALID_TYPES:
        qtype = "Short Answer"

    diff = raw.get("difficulty", "Easy")
    if diff not in VALID_DIFFICULTY:
        diff = "Easy"

    rule = raw.get("evaluationRule", "exact")
    if rule not in VALID_RULES:
        rule = "exact"

    marks = raw.get("marks", 1)
    try:
        marks = max(0, int(marks))
    except Exception:
        marks = 1

    bbox = raw.get("boundingBox") or {}

    return {
        "questionNo": qno,
        "pageNumber": int(raw.get("pageNumber", 1) or 1),
        "questionText": str(raw.get("questionText", "")).strip(),
        "questionType": qtype,
        "concept": str(raw.get("concept", "")).strip(),
        "difficulty": diff,
        "marks": marks,
        "answerType": str(raw.get("answerType", "text")).strip() or "text",
        "correctAnswer": str(raw.get("correctAnswer", "")).strip(),
        "alternateAnswers": [str(a) for a in (raw.get("alternateAnswers") or [])],
        "evaluationRule": rule,
        "boundingBox": {
            "x": float(bbox.get("x", 0) or 0),
            "y": float(bbox.get("y", 0) or 0),
            "width": float(bbox.get("width", 0) or 0),
            "height": float(bbox.get("height", 0) or 0),
        },
        "images": raw.get("images") or [],
    }


def parse_pages(pages_data: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Merge + dedupe + renumber questions from all pages."""
    all_qs: List[Dict[str, Any]] = []
    for page_questions in pages_data:
        for q in page_questions:
            all_qs.append(_coerce_question(q, len(all_qs)))

    seen = set()
    deduped: List[Dict[str, Any]] = []
    for q in all_qs:
        key = (q["pageNumber"], q["questionText"][:80].lower())
        if not q["questionText"]:
            continue
        if key in seen:
            continue
        seen.add(key)
        deduped.append(q)

    for i, q in enumerate(deduped, start=1):
        q["questionNo"] = i

    logger.info(f"Parsed {len(deduped)} unique questions from {len(pages_data)} pages")
    return deduped