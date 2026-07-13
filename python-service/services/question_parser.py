import re
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

SUBJECTIVE_TYPES = {"Drawing", "Trace"}
MCQ_LETTERS = list("ABCD")


def _fallback_answer(qtext: str, qtype: str) -> str:
    """Compute a fallback answer if the AI didn't supply one."""
    text = (qtext or "").lower()
    # Simple arithmetic
    m = re.search(r"(\d+)\s*\+\s*(\d+)", text)
    if m:
        return str(int(m.group(1)) + int(m.group(2)))
    m = re.search(r"(\d+)\s*[-−]\s*(\d+)", text)
    if m:
        return str(int(m.group(1)) - int(m.group(2)))
    m = re.search(r"(\d+)\s*[×x\*]\s*(\d+)", text)
    if m:
        return str(int(m.group(1)) * int(m.group(2)))
    m = re.search(r"(\d+)\s*[÷/]\s*(\d+)", text)
    if m and int(m.group(2)) != 0:
        return str(int(m.group(1)) // int(m.group(2)))
    # Days of the week
    days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    for i, d in enumerate(days):
        if f"after {d}" in text:
            return days[(i + 1) % 7].capitalize()
    # Alphabets
    for ch in "abcdefghijklmnopqrstuvwxyz":
        if f"after {ch}" in text or f"after '{ch}'" in text:
            nxt = chr(ord(ch) + 1) if ch != "z" else "a"
            return nxt.upper()
    return ""


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

    correct = str(raw.get("correctAnswer", "")).strip()
    # If subjective and AI left it empty, keep empty (manual grading)
    if not correct and qtype in SUBJECTIVE_TYPES:
        rule = "manual"
    elif not correct:
        # Try fallback computation
        fb = _fallback_answer(str(raw.get("questionText", "")), qtype)
        if fb:
            correct = fb
            rule = "exact"

    has_image = bool(raw.get("hasImage", False))
    visual = str(raw.get("visualDescription", "")).strip()

    return {
        "questionNo": qno,
        "pageNumber": int(raw.get("pageNumber", 1) or 1),
        "questionText": str(raw.get("questionText", "")).strip(),
        "questionType": qtype,
        "concept": str(raw.get("concept", "")).strip(),
        "difficulty": diff,
        "marks": marks,
        "answerType": str(raw.get("answerType", "text")).strip() or "text",
        "correctAnswer": correct,
        "alternateAnswers": [str(a) for a in (raw.get("alternateAnswers") or [])],
        "evaluationRule": rule,
        "visualDescription": visual,
        "hasImage": has_image,
        "sourceFileIndex": raw.get("sourceFileIndex"),
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

    # Post-process: fill missing answers from computation
    filled = 0
    for q in deduped:
        if not q["correctAnswer"] and q["questionType"] not in SUBJECTIVE_TYPES:
            fb = _fallback_answer(q["questionText"], q["questionType"])
            if fb:
                q["correctAnswer"] = fb
                if q["evaluationRule"] not in ("subjective", "manual"):
                    q["evaluationRule"] = "exact"
                filled += 1

    logger.info(f"Parsed {len(deduped)} unique questions from {len(pages_data)} pages (filled {filled} missing answers)")
    return deduped