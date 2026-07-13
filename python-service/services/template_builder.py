from typing import List, Dict, Any

from utils.logger import get_logger

logger = get_logger("template-builder")


def build_template(assessment_id: str, questions: List[Dict[str, Any]], metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """Assemble the final template response."""
    metadata = metadata or {}
    total_marks = sum(q.get("marks", 1) for q in questions)

    return {
        "assessmentId": assessment_id,
        "model": metadata.get("model", "gemini-2.0-flash"),
        "totalQuestions": len(questions),
        "totalMarks": total_marks,
        "questions": questions,
    }


def merge_page_results(page_results: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Flatten + dedupe + renumber from multiple pages."""
    from services.question_parser import parse_pages
    return parse_pages(page_results)