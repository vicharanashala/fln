import os
import time
from dotenv import load_dotenv
load_dotenv()

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from services.pdf_processor import pdf_to_images_and_pictures, render_single_image, crop_page_to_bbox
import services.groq_service as groq_svc
from services.question_parser import parse_pages, SUBJECTIVE_TYPES
from utils.logger import get_logger

app = FastAPI(title="FLN Template Builder", version="3.0.0")
logger = get_logger("main")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "extracted_images")
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/extracted-images", StaticFiles(directory=IMAGES_DIR), name="images")


class GenerateTemplateRequest(BaseModel):
    assessmentId: str
    pdfPath: Optional[str] = None
    filePaths: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class RegenerateQuestionRequest(BaseModel):
    assessmentId: str
    questionIndex: int
    filePath: Optional[str] = None
    imageBase64: Optional[str] = None
    promptHint: Optional[str] = None


class QuestionImageOut(BaseModel):
    imageUrl: str
    position: str = "inline"


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
    visualDescription: str = ""
    hasImage: bool = False
    boundingBox: Dict[str, float]
    sourceFile: Optional[str] = None
    images: List[QuestionImageOut] = []


class GenerateTemplateResponse(BaseModel):
    assessmentId: str
    provider: str
    model: str
    totalQuestions: int
    totalMarks: int
    imagesBySource: Dict[str, List[str]] = {}
    questions: List[QuestionOut]


def active_provider():
    """Provider chain: Groq only."""
    if groq_svc.is_configured():
        return ("groq", groq_svc.get_model(), groq_svc.analyze_page)
    return (None, "mock", None)


def backend_url():
    return os.environ.get("BACKEND_PUBLIC_URL", "http://localhost:5000")


MOCK_QUESTIONS = [
    {"questionNo": 1, "pageNumber": 1, "questionText": "Count the objects and write the number.", "questionType": "Counting", "concept": "Counting 1-10", "difficulty": "Easy", "marks": 1, "answerType": "text", "correctAnswer": "5", "alternateAnswers": ["five"], "evaluationRule": "exact", "visualDescription": "Picture of 5 objects", "hasImage": True, "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}, "sourceFile": None, "images": []},
    {"questionNo": 2, "pageNumber": 1, "questionText": "8 + 3 = ?", "questionType": "Addition", "concept": "Simple Addition", "difficulty": "Easy", "marks": 2, "answerType": "number", "correctAnswer": "11", "alternateAnswers": ["eleven"], "evaluationRule": "exact", "visualDescription": "", "hasImage": False, "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}, "sourceFile": None, "images": []},
    {"questionNo": 3, "pageNumber": 1, "questionText": "Which letter comes after A?", "questionType": "MCQ", "concept": "Alphabet Sequence", "difficulty": "Easy", "marks": 1, "answerType": "multiple", "correctAnswer": "B", "alternateAnswers": ["b"], "evaluationRule": "contains", "visualDescription": "", "hasImage": False, "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0}, "sourceFile": None, "images": []},
]


def _collect_pages_and_images(file_paths: List[str]) -> tuple:
    """Render every file as JPEG pages + extract embedded images per page + save full pages for cropping.

    Returns:
        pages: List of (page_idx, source_file_idx, jpeg_bytes)
        pictures_by_page: Dict[page_idx, List[image_paths]]
        saved_page_paths: Dict[page_idx, saved_path_to_full_page_jpeg]   ← for cropping per-question
        images_by_source: Dict[source_file_name, List[image_urls]]   ← for per-question image attachment
    """
    pages = []
    pictures_by_page = {}
    saved_page_paths = {}
    images_by_source = {}

    for src_idx, fp in enumerate(file_paths, start=1):
        src_name = os.path.basename(fp)
        is_image = fp.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))

        if is_image:
            # Render the image itself as a single page
            try:
                img_bytes = render_single_image(fp)
                page_idx = len(pages) + 1
                pages.append((page_idx, src_idx, img_bytes))
                # The image IS the page — save a copy so the frontend can serve it
                fname = f"page-{src_idx}-{src_name}"
                out_path = os.path.join(IMAGES_DIR, fname)
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                images_by_source[src_name] = [f"{backend_url()}/extracted-images/{fname}"]
                # Also save as "full page" so it can be cropped if AI returns bbox
                saved_page_paths[page_idx] = out_path
            except Exception as e:
                logger.warning(f"Could not render image {fp}: {e}")
            continue

        # PDF path
        try:
            pdf_pages, pdf_pics, pdf_page_paths = pdf_to_images_and_pictures(fp, IMAGES_DIR, save_page_images=True)
            for local_idx, jpeg in enumerate(pdf_pages, start=1):
                page_idx = len(pages) + 1
                pages.append((page_idx, src_idx, jpeg))
            # Index embedded images by their global page index
            base = len(pdf_pages)
            for local_idx in range(1, base + 1):
                page_idx_key = (len(pages) - base) + local_idx
                pics = pdf_pics.get(local_idx, [])
                if pics:
                    urls = [f"{backend_url()}/extracted-images/{os.path.basename(p)}" for p in pics]
                    pictures_by_page[page_idx_key] = urls
                    images_by_source[f"{src_name}#p{local_idx}"] = urls
                # Map global page → saved page path (for cropping)
                if local_idx in pdf_page_paths:
                    saved_page_paths[page_idx_key] = pdf_page_paths[local_idx]
        except Exception as e:
            logger.warning(f"Could not process PDF {fp}: {e}")

    return pages, pictures_by_page, saved_page_paths, images_by_source


@app.get("/health")
def health():
    provider, model, _ = active_provider()
    return {
        "ok": True,
        "service": "fln-template-builder",
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "provider": provider,
        "model": model,
        "providers": {
            "groq": {"configured": groq_svc.is_configured(), "model": groq_svc.get_model() if groq_svc.is_configured() else None},
        },
    }


@app.post("/regenerate-question", response_model=QuestionOut)
def regenerate_question(req: RegenerateQuestionRequest):
    """Re-ask the AI to extract/refine ONE specific question."""
    t0 = time.time()
    provider_name, model_name, analyze_fn = active_provider()

    if not provider_name:
        return _mock_with_label(req.assessmentId, "mock").questions[0]

    if not req.filePath or not os.path.exists(req.filePath):
        raise HTTPException(status_code=400, detail="filePath required")

    try:
        from services.pdf_processor import render_single_image
        is_image = req.filePath.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))

        if is_image:
            # The file itself is the question's image — just re-run AI on it
            img = render_single_image(req.filePath)
            meta = {
                "singleQuestionMode": True,
                "hint": req.promptHint or "This image shows ONE question. Extract it and provide a complete, specific answer.",
                "sourceFileIndex": req.questionIndex,
            }
            questions = analyze_fn(img, 1, meta)
        else:
            # PDF — render specific page
            pages, _ = pdf_to_images_and_pictures(req.filePath, IMAGES_DIR)
            if not pages:
                raise HTTPException(status_code=400, detail="PDF has no pages")
            page_idx = min(req.questionIndex + 1, len(pages))
            img = pages[page_idx - 1]
            meta = {
                "hint": req.promptHint or "Extract the question at the given index and provide a complete answer.",
            }
            questions = analyze_fn(img, page_idx, meta)
            # Filter: keep only the question at the requested index from this page
            if questions and req.questionIndex is not None:
                if req.questionIndex < len(questions):
                    questions = [questions[req.questionIndex]]
                else:
                    questions = [questions[0]]

        if not questions:
            raise HTTPException(status_code=500, detail="AI returned no question")

        elapsed = time.time() - t0
        logger.info(f"Regenerated question {req.questionIndex} in {elapsed:.1f}s")
        return QuestionOut(**questions[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Regenerate failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-template", response_model=GenerateTemplateResponse)
def generate_template(req: GenerateTemplateRequest):
    t0 = time.time()
    provider_name, model_name, analyze_fn = active_provider()

    # Build list of file paths
    if req.filePaths:
        file_paths = [p for p in req.filePaths if p and os.path.exists(p)]
    elif req.pdfPath:
        file_paths = [req.pdfPath] if os.path.exists(req.pdfPath) else []
    else:
        file_paths = []

    # Add hint: if 1+ image files uploaded, single-question mode
    is_image_mode = any(
        fp.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))
        for fp in file_paths
    )

    logger.info(f"generate-template {req.assessmentId} | provider={provider_name} model={model_name} files={len(file_paths)} image_mode={is_image_mode}")

    if not provider_name or not file_paths:
        if not provider_name:
            logger.info("No AI provider configured — returning mock questions")
        else:
            logger.info("No files uploaded — returning mock questions")
        return _mock_response(req.assessmentId)

    try:
        pages, pictures_by_page, saved_page_paths, images_by_source = _collect_pages_and_images(file_paths)
        if not pages:
            logger.warning("No pages extracted — falling back to mock")
            return _mock_with_label(req.assessmentId, "mock (no-pages)")

        all_results: List[List[Dict[str, Any]]] = []
        per_page_metadata = []
        for page_idx, src_idx, img in pages:
            meta = dict(req.metadata or {})
            if is_image_mode:
                meta["singleQuestionMode"] = True
                meta["hint"] = "This image shows ONE question. Extract that single question and its answer."
            meta["pageNumber"] = page_idx
            meta["sourceFileIndex"] = src_idx
            per_page_metadata.append(meta)
            qs = analyze_fn(img, page_idx, meta)
            all_results.append(qs)

        questions_raw = [q for page in all_results for q in page]
        elapsed = time.time() - t0
        logger.info(f"Done in {elapsed:.1f}s — {len(questions_raw)} questions from {provider_name}")

        if not questions_raw:
            logger.warning(f"{provider_name} extracted 0 questions — falling back to mock")
            return _mock_with_label(req.assessmentId, f"mock ({provider_name}-empty)")

        deduped = parse_pages(all_results)
        deduped = _attach_images_to_questions(deduped, pictures_by_page, images_by_source, is_image_mode, saved_page_paths)
        total_marks = sum(q.get("marks", 1) for q in deduped)

        # Post-process: only mark visual questions as manual if AI completely failed
        # (NOT for short answers like "5", "T", "9" which are valid)
        for q in deduped:
            if q.get("hasImage") and q.get("evaluationRule") != "manual":
                ans = (q.get("correctAnswer") or "").strip()
                # Only mark manual if answer is COMPLETELY empty
                # (question_parser already filled in fallbacks for arithmetic etc.)
                if not ans and q.get("questionType") not in SUBJECTIVE_TYPES:
                    q["evaluationRule"] = "manual"
                    q["needsReview"] = True
                    q["correctAnswer"] = ""  # keep empty for manual review

        return GenerateTemplateResponse(
            assessmentId=req.assessmentId,
            provider=provider_name,
            model=model_name,
            totalQuestions=len(deduped),
            totalMarks=total_marks,
            imagesBySource=images_by_source,
            questions=[QuestionOut(**q) for q in deduped],
        )

    except Exception as e:
        logger.exception(f"Template generation failed: {e}")
        err_msg = str(e)
        if "Connection refused" in err_msg or "11434" in err_msg or "ConnectionError" in err_msg:
            detail = "Ollama is not running locally. Please start the Ollama server on your machine."
        elif "not found" in err_msg.lower() or "404" in err_msg:
            detail = f"Model '{model_name}' is not installed in Ollama. Please run 'ollama pull {model_name}' in your terminal."
        else:
            detail = f"AI Generation Error: {err_msg}"
        raise HTTPException(status_code=500, detail=detail)


def _attach_images_to_questions(questions, pictures_by_page, images_by_source, is_image_mode, saved_page_paths=None):
    """Attach per-question images.

    - In image-mode: each image file = 1 page = all questions from that page get that image
    - In PDF-mode: pictures_by_page is keyed by page number
    - If bbox is valid: crop the page image to just that question's region
    """
    saved_page_paths = saved_page_paths or {}
    cropped_count = 0

    for q in questions:
        page = q.get("pageNumber", 1)
        source_idx = q.get("sourceFileIndex") or page
        urls = []
        crop_path = None

        # Try to crop the page image to just this question (PDF mode only)
        bbox = q.get("boundingBox") or {}
        bbox_valid = (
            isinstance(bbox, dict)
            and 0 <= float(bbox.get("x", 0)) <= 1
            and 0 <= float(bbox.get("y", 0)) <= 1
            and 0 < float(bbox.get("width", 0)) <= 1
            and 0 < float(bbox.get("height", 0)) <= 1
        )
        if bbox_valid and page in saved_page_paths:
            crop_fname = f"crop-{os.path.basename(saved_page_paths[page]).replace('.jpg', '')}-q{q.get('questionNo', 'x')}.jpg"
            crop_full_path = os.path.join(IMAGES_DIR, crop_fname)
            cropped_bytes = crop_page_to_bbox(saved_page_paths[page], bbox, output_path=crop_full_path)
            if cropped_bytes and os.path.exists(crop_full_path):
                crop_path = crop_full_path
                cropped_count += 1
                logger.info(f"Cropped Q{q.get('questionNo', '?')} from page {page}: bbox=({bbox.get('x'):.2f},{bbox.get('y'):.2f},{bbox.get('width'):.2f},{bbox.get('height'):.2f})")

        # Build the image URL list for this question
        if crop_path:
            urls.append(f"{backend_url()}/extracted-images/{os.path.basename(crop_path)}")
        elif is_image_mode:
            all_keys = list(images_by_source.keys())
            page_to_url = {}
            for idx, key in enumerate(all_keys, start=1):
                src_urls = images_by_source[key]
                if src_urls:
                    page_to_url[idx] = src_urls[0]
            if page in page_to_url:
                urls.append(page_to_url[page])
            elif pictures_by_page.get(page):
                urls = pictures_by_page[page]
        else:
            urls = pictures_by_page.get(page, [])

        q["images"] = [{"imageUrl": u, "position": "inline"} for u in urls[:4]]
        if crop_path:
            q["croppedFromPage"] = page

    if cropped_count > 0:
        logger.info(f"✂️  Cropped {cropped_count}/{len(questions)} questions from their pages")
    return questions


def _mock_response(assessment_id: str) -> GenerateTemplateResponse:
    return GenerateTemplateResponse(
        assessmentId=assessment_id,
        provider="mock",
        model="mock",
        totalQuestions=len(MOCK_QUESTIONS),
        totalMarks=sum(q["marks"] for q in MOCK_QUESTIONS),
        questions=[QuestionOut(**q) for q in MOCK_QUESTIONS],
    )


def _mock_with_label(assessment_id: str, label: str) -> GenerateTemplateResponse:
    return GenerateTemplateResponse(
        assessmentId=assessment_id,
        provider="mock",
        model=label,
        totalQuestions=len(MOCK_QUESTIONS),
        totalMarks=sum(q["marks"] for q in MOCK_QUESTIONS),
        questions=[QuestionOut(**q) for q in MOCK_QUESTIONS],
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5051))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)