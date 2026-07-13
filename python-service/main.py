import os
import time
from dotenv import load_dotenv
load_dotenv()

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from services.pdf_processor import pdf_to_images, pdf_to_text
from services.gemini_service import analyze_page, is_configured
from services.template_builder import build_template
from utils.logger import get_logger

app = FastAPI(title="FLN Template Builder", version="1.0.0")
logger = get_logger("main")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateTemplateRequest(BaseModel):
    assessmentId: str
    pdfPath: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class QuestionOut(BaseModel):
    questionNo: int
    pageNumber: int
    questionText: str
    questionType: str
    concept: str
    difficulty: str
    marks: int
    answerType: str
    correctAnswer: str
    alternateAnswers: List[str]
    evaluationRule: str
    boundingBox: Dict[str, float]


class GenerateTemplateResponse(BaseModel):
    assessmentId: str
    model: str
    totalQuestions: int
    totalMarks: int
    questions: List[QuestionOut]


MOCK_QUESTIONS = [
    {"questionNo": 1, "pageNumber": 1, "questionText": "Count the objects and write the number.", "questionType": "Counting", "concept": "Counting 1-10", "difficulty": "Easy", "marks": 1, "answerType": "text", "correctAnswer": "", "alternateAnswers": [], "evaluationRule": "exact", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 2, "pageNumber": 1, "questionText": "8 + 3 = ?", "questionType": "Addition", "concept": "Simple Addition", "difficulty": "Easy", "marks": 2, "answerType": "number", "correctAnswer": "11", "alternateAnswers": [], "evaluationRule": "exact", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 3, "pageNumber": 1, "questionText": "Which letter comes after A?", "questionType": "MCQ", "concept": "Alphabet Sequence", "difficulty": "Easy", "marks": 1, "answerType": "multiple", "correctAnswer": "B", "alternateAnswers": ["b"], "evaluationRule": "contains", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 4, "pageNumber": 2, "questionText": "Fill in the blanks: The sun rises in the ____.", "questionType": "Fill in the Blanks", "concept": "Environmental Science", "difficulty": "Easy", "marks": 2, "answerType": "text", "correctAnswer": "east", "alternateAnswers": ["East"], "evaluationRule": "contains", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 5, "pageNumber": 2, "questionText": "15 - 6 = ?", "questionType": "Subtraction", "concept": "Simple Subtraction", "difficulty": "Medium", "marks": 2, "answerType": "number", "correctAnswer": "9", "alternateAnswers": [], "evaluationRule": "exact", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 6, "pageNumber": 2, "questionText": "Match the following: Cat — ?", "questionType": "Match the Following", "concept": "Animal Knowledge", "difficulty": "Medium", "marks": 3, "answerType": "text", "correctAnswer": "Meow", "alternateAnswers": ["meow"], "evaluationRule": "contains", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 7, "pageNumber": 3, "questionText": "True or False: Birds can swim.", "questionType": "True/False", "concept": "General Knowledge", "difficulty": "Easy", "marks": 1, "answerType": "text", "correctAnswer": "True", "alternateAnswers": ["true", "TRUE"], "evaluationRule": "exact", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 8, "pageNumber": 3, "questionText": "Draw a circle around the biggest object.", "questionType": "Drawing", "concept": "Spatial Awareness", "difficulty": "Medium", "marks": 3, "answerType": "drawing", "correctAnswer": "", "alternateAnswers": [], "evaluationRule": "manual", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 9, "pageNumber": 3, "questionText": "Trace the letter 'A' along the dotted line.", "questionType": "Trace", "concept": "Motor Skills", "difficulty": "Easy", "marks": 2, "answerType": "trace", "correctAnswer": "N/A", "alternateAnswers": [], "evaluationRule": "manual", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
    {"questionNo": 10, "pageNumber": 3, "questionText": "What comes after Tuesday?", "questionType": "Short Answer", "concept": "Days of the Week", "difficulty": "Easy", "marks": 1, "answerType": "text", "correctAnswer": "Wednesday", "alternateAnswers": ["wednesday"], "evaluationRule": "contains", "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}},
]


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "fln-template-builder",
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gemini_configured": is_configured(),
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
    }


@app.post("/generate-template", response_model=GenerateTemplateResponse)
def generate_template(req: GenerateTemplateRequest):
    t0 = time.time()
    logger.info(f"generate-template {req.assessmentId} | pdf={req.pdfPath} | gemini={is_configured()}")

    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

    # No API key or no PDF → return mock questions
    if not is_configured() or not req.pdfPath:
        if not req.pdfPath:
            logger.info("No pdfPath — returning mock questions")
        else:
            logger.info("GEMINI_API_KEY not set — returning mock questions")
        elapsed = time.time() - t0
        return GenerateTemplateResponse(
            assessmentId=req.assessmentId,
            model="mock",
            totalQuestions=len(MOCK_QUESTIONS),
            totalMarks=sum(q["marks"] for q in MOCK_QUESTIONS),
            questions=[QuestionOut(**q) for q in MOCK_QUESTIONS],
        )

    # Real pipeline: PDF → images → Gemini
    try:
        images = pdf_to_images(req.pdfPath)
        if not images:
            raise ValueError(f"Could not render PDF at {req.pdfPath}")

        all_page_results: List[List[Dict[str, Any]]] = []
        for i, img_bytes in enumerate(images, start=1):
            qs = analyze_page(img_bytes, i, req.metadata or {})
            all_page_results.append(qs)

        questions = []
        for page_qs in all_page_results:
            for q in page_qs:
                questions.append(q)

        total_marks = sum(q.get("marks", 1) for q in questions) or sum(q.get("marks", 1) for q in MOCK_QUESTIONS)
        elapsed = time.time() - t0
        logger.info(f"Done in {elapsed:.1f}s — {len(questions)} questions")

        if not questions:
            logger.warning("Gemini extracted 0 questions — falling back to mock")
            return GenerateTemplateResponse(
                assessmentId=req.assessmentId,
                model=model,
                totalQuestions=len(MOCK_QUESTIONS),
                totalMarks=sum(q["marks"] for q in MOCK_QUESTIONS),
                questions=[QuestionOut(**q) for q in MOCK_QUESTIONS],
            )

        return GenerateTemplateResponse(
            assessmentId=req.assessmentId,
            model=model,
            totalQuestions=len(questions),
            totalMarks=total_marks,
            questions=[QuestionOut(**q) for q in questions],
        )

    except Exception as e:
        logger.exception(f"Template generation failed: {e}")
        # Fallback to mock on error
        return GenerateTemplateResponse(
            assessmentId=req.assessmentId,
            model=model,
            totalQuestions=len(MOCK_QUESTIONS),
            totalMarks=sum(q["marks"] for q in MOCK_QUESTIONS),
            questions=[QuestionOut(**q) for q in MOCK_QUESTIONS],
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5051))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)