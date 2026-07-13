import os
import json
import re
from typing import List, Dict, Any, Optional

import google.generativeai as genai

from utils.logger import get_logger

logger = get_logger("gemini-service")

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


SYSTEM_PROMPT = """You are an expert at extracting structured question data from scanned Indian FLN (Foundational Literacy & Numeracy) question papers for grades 1-8.

For each question visible on the page, output a JSON object with EXACTLY these fields:

{
  "questionNo": <integer>,
  "pageNumber": <integer>,
  "questionText": "<the exact question text, in the same language as the paper>",
  "questionType": "<one of: MCQ | True/False | Fill in the Blanks | Short Answer | Long Answer | Match the Following | Counting | Addition | Subtraction | Number Recognition | Drawing | Trace>",
  "concept": "<short concept label, e.g. 'Counting 1-10', 'Simple Addition', 'Reading Comprehension'>",
  "difficulty": "<Easy | Medium | Hard>",
  "marks": <integer 1-5>,
  "answerType": "<text | number | drawing | trace | multiple>",
  "correctAnswer": "<the correct answer if shown in the paper, else empty string>",
  "alternateAnswers": [<other accepted forms of the answer>],
  "evaluationRule": "<exact | contains | tolerance | range | subjective | manual>",
  "boundingBox": { "x": <0>, "y": <0>, "width": <0>, "height": <0> }
}

Return a JSON array of these objects (no prose, no markdown fences):
[
  { ... },
  { ... }
]
"""


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


def _extract_json(text: str) -> Optional[Any]:
    text = _strip_code_fence(text)
    try:
        return json.loads(text)
    except Exception:
        # find first [ ... ] block
        m = re.search(r"\[[\s\S]*\]", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None


def analyze_page(image_bytes: bytes, page_number: int, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Send one page image to Gemini and return its extracted questions."""
    metadata = metadata or {}
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        logger.info(f"GEMINI_API_KEY not set — using mock for page {page_number}")
        return []

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL_NAME)
        prompt_parts = [
            {"text": SYSTEM_PROMPT},
            {"text": f"\nContext: Title='{metadata.get('title','')}', Subject='{metadata.get('subject','')}', Grade='{metadata.get('grade','')}', Language='{metadata.get('language','English')}', Page={page_number}"},
            {"inline_data": {"mime_type": "image/jpeg", "data": _b64(image_bytes)}},
        ]
        response = model.generate_content(prompt_parts)
        text = response.text or ""
        data = _extract_json(text)
        if not isinstance(data, list):
            logger.warning(f"Gemini returned non-list JSON for page {page_number}")
            return []
        for q in data:
            q.setdefault("pageNumber", page_number)
        return data
    except Exception as e:
        logger.exception(f"Gemini error on page {page_number}: {e}")
        return []


def _b64(b: bytes) -> str:
    import base64
    return base64.b64encode(b).decode("ascii")


def is_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))