"""Groq provider — uses OpenAI-compatible API with Groq's endpoint."""
import os
import base64
import json
import re
from typing import List, Dict, Any, Optional
from openai import OpenAI

from utils.logger import get_logger

logger = get_logger("groq-service")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

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
  "correctAnswer": "<always filled — see rules below>",
  "alternateAnswers": [<other accepted forms>],
  "evaluationRule": "<exact | contains | tolerance | range | subjective | manual>",
  "visualDescription": "<short description of any picture/image/diagram referenced by this question, or empty string>",
  "hasImage": <true if the question references an image/picture/diagram that must be displayed to the student, else false>,
  "boundingBox": { "x": <0>, "y": <0>, "width": <0>, "height": <0> }
}

**STRICT answer generation rules — ALWAYS provide an answer:**
1. For math/arithmetic/computation: COMPUTE the answer yourself. Examples:
   - "8 + 3 =" → correctAnswer: "11"
   - "15 - 6 =" → correctAnswer: "9"
   - "What comes after Tuesday?" → correctAnswer: "Wednesday"
2. For MCQs: pick the right option letter AND its text (e.g., "C) 8").
3. For fill-in-the-blank factual questions: provide the standard fact.
4. For reading comprehension with no visible answer: write a 1-line model answer.
5. For counting questions with a picture: count the visible items and write the number.
6. For "What comes next" sequence questions: state the next item.
7. For vocabulary/spelling questions: provide the correct word.
8. For subjective tasks (Drawing, Trace, "Draw a...", "Write a story about..."): set correctAnswer = "" and evaluationRule = "manual". This is the ONLY case where correctAnswer can be empty.
9. For Match-the-Following: provide the most obvious pairing.

**visualDescription rules:**
- If the question mentions a picture, image, diagram, or refers to something visual: write a short description like "Picture of 5 stars to count" or "Diagram of a circle to label".
- Set hasImage = true if a visual element must accompany the question.
- Set hasImage = false and visualDescription = "" for pure text questions.

Return a JSON array (no prose, no markdown fences)."""


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
        m = re.search(r"\[[\s\S]*\]", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None


_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set")
        _client = OpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
    return _client


def is_configured() -> bool:
    return bool(os.environ.get("GROQ_API_KEY"))


def get_model() -> str:
    return os.environ.get("GROQ_MODEL", DEFAULT_MODEL)


def analyze_page(image_bytes: bytes, page_number: int, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    metadata = metadata or {}
    if not is_configured():
        logger.warning("GROQ_API_KEY not set")
        return []

    b64 = base64.b64encode(image_bytes).decode("ascii")
    model = get_model()

    single = metadata.get("singleQuestionMode", False)
    if single:
        user_text = (
            f"\nIMPORTANT: This image shows EXACTLY ONE question. "
            f"Return a JSON array containing ONE element only — for that single question. "
            f"Do not infer multiple questions from this image."
        )
    else:
        user_text = (
            f"\nContext: Title='{metadata.get('title','')}', "
            f"Subject='{metadata.get('subject','')}', Grade='{metadata.get('grade','')}', "
            f"Language='{metadata.get('language','English')}', Page={page_number}"
        )

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    ],
                },
            ],
            temperature=0.2,
            max_tokens=4096,
        )
        text = response.choices[0].message.content or ""
        data = _extract_json(text)
        if not isinstance(data, list):
            logger.warning(f"Groq returned non-list JSON for page {page_number}")
            return []
        for q in data:
            q["pageNumber"] = page_number  # ALWAYS use the actual page number, not AI's guess
            q["sourceFileIndex"] = metadata.get("sourceFileIndex", page_number) if metadata else page_number
        return data
    except Exception as e:
        logger.exception(f"Groq error on page {page_number}: {e}")
        return []