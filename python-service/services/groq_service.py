"""Groq provider — uses OpenAI-compatible API with Groq's endpoint."""
import os
import base64
import json
import re
from typing import List, Dict, Any, Optional
from openai import OpenAI

from utils.logger import get_logger

logger = get_logger("groq-service")

GROQ_BASE_URL = os.environ.get("LLM_API_BASE_URL", "http://127.0.0.1:11434/v1")
DEFAULT_MODEL = "qwen2.5vl:7b"

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
  "boundingBox": { "ymin": <0-1000>, "xmin": <0-1000>, "ymax": <0-1000>, "xmax": <0-1000> }
}

**CRITICAL — boundingBox coordinates MUST be integers in the 0 to 1000 range relative to the page image (ymin, xmin, ymax, xmax):**
- ymin = distance from the TOP edge of the page (0 = topmost, 1000 = bottommost). **Must start exactly above the question number/text (e.g. "Q1.")**.
- xmin = distance from the LEFT edge of the page (0 = leftmost, 1000 = rightmost). **Must cover the far left side of the text (including question numbers)**.
- ymax = distance from the TOP edge of the page (0 = topmost, 1000 = bottommost). **Must extend below all the answer options, tables, pictures, or drawing lines for this question**.
- xmax = distance from the LEFT edge of the page (0 = leftmost, 1000 = rightmost). **Must cover the far right side of the page**.
- **Important**: Do not let question boxes overlap on the vertical axis (y-axis) unless they are part of the same question! Be extremely careful to find the correct vertical start (`ymin`) and end (`ymax`) for each question.
- Example: a question occupying the top quarter might be {"ymin": 50, "xmin": 50, "ymax": 280, "xmax": 950}

**STRICT answer generation rules — ALWAYS provide an answer:**
1. For math/arithmetic/computation: COMPUTE the answer yourself. Examples:
   - "8 + 3 =" → correctAnswer: "11"
   - "15 - 6 =" → correctAnswer: "9"
   - "What comes after Tuesday?" → correctAnswer: "Wednesday"
2. For MCQs: pick the right option letter AND its text (e.g., "C) 8").
3. For fill-in-the-blank factual questions: provide the standard fact.
4. For reading comprehension with no visible answer: write a 1-line model answer.
5. For counting questions with a picture: count the visible items and write the number (e.g. "5").
6. For "What comes next" sequence questions: state the next item.
7. For vocabulary/spelling questions: provide the correct word.
8. For "Match the following": always provide the correct pairs separated by commas (e.g., "Apple - Red, Banana - Yellow" or "Triangle - Pizza, Circle - Clock").
9. For visual selection/Circle the group/Most/Least: specify the correct group name or count (e.g. "Group A" or "5").
10. **For VISUAL questions (counting objects, identifying shapes, reading from diagrams)**:
    - Look carefully at the image and provide YOUR BEST ANSWER as text/number.
    - Example: "Circle all the ₹1 coins" → "3" (if there are three ₹1 coins).
    - Example: "What color is the biggest shape?" → "Red"
    - DO NOT leave these blank — give a specific answer.
11. **ONLY leave correctAnswer empty for subjective/artistic tasks**:
    - Drawing (kid draws something)
    - Trace (kid traces a letter)
    - "Draw your family"
    For these, set evaluationRule = "manual". This is the ONLY case where correctAnswer can be empty.
12. **SHORT ANSWERS ARE VALID** — "5", "T", "9", "B", "east", etc. are all good answers. Do NOT second-guess short answers.

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
        data = json.loads(text)
        if isinstance(data, dict) and "questions" in data:
            return data["questions"]
        return data
    except Exception:
        # Try finding array in the text first
        m_arr = re.search(r"\[[\s\S]*\]", text)
        if m_arr:
            try:
                return json.loads(m_arr.group(0))
            except Exception:
                pass
        # Try finding object in the text
        m_obj = re.search(r"\{[\s\S]*\}", text)
        if m_obj:
            try:
                data = json.loads(m_obj.group(0))
                if isinstance(data, dict) and "questions" in data:
                    return data["questions"]
                return data
            except Exception:
                pass
    return None


def convert_bbox(bbox: Any) -> Dict[str, float]:
    if not isinstance(bbox, dict):
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}
    
    # If already in x/y/width/height format, keep it
    if "x" in bbox and "y" in bbox and "width" in bbox and "height" in bbox:
        try:
            return {
                "x": round(float(bbox.get("x", 0)), 3),
                "y": round(float(bbox.get("y", 0)), 3),
                "width": round(float(bbox.get("width", 0)), 3),
                "height": round(float(bbox.get("height", 0)), 3)
            }
        except Exception:
            pass

    # Extract coordinates
    try:
        ymin = float(bbox.get("ymin", 0))
        xmin = float(bbox.get("xmin", 0))
        ymax = float(bbox.get("ymax", 0))
        xmax = float(bbox.get("xmax", 0))
    except Exception:
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}

    # Normalize from 0-1000 scale to 0.0-1.0 scale if needed
    if ymin > 1 or xmin > 1 or ymax > 1 or xmax > 1:
        ymin /= 1000.0
        xmin /= 1000.0
        ymax /= 1000.0
        xmax /= 1000.0

    # Ensure bounds [0, 1]
    ymin = max(0.0, min(1.0, ymin))
    xmin = max(0.0, min(1.0, xmin))
    ymax = max(0.0, min(1.0, ymax))
    xmax = max(0.0, min(1.0, xmax))

    x = xmin
    y = ymin
    width = max(0.01, xmax - xmin)
    height = max(0.01, ymax - ymin)

    return {
        "x": round(x, 3),
        "y": round(y, 3),
        "width": round(width, 3),
        "height": round(height, 3)
    }


_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY", "ollama")
        _client = OpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
    return _client


def is_configured() -> bool:
    return True


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
            if "boundingBox" in q:
                q["boundingBox"] = convert_bbox(q["boundingBox"])
        return data
    except Exception as e:
        logger.exception(f"Groq error on page {page_number}: {e}")
        raise e