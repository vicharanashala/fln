#!/usr/bin/env python3
"""
FLN OCR microservice — replaces the per-request EasyOCR subprocess.

The model loads ONCE at startup (via uvicorn lifespan). Every subsequent
/ocr call hits a warm reader: ~500ms instead of 30-60s cold start.

Start: uvicorn ocr_server:app --host 127.0.0.1 --port 8001 --workers 1
Prod:  pm2 start ecosystem.config.js  (see repo root)
"""

import sys, os, base64, time, tempfile
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# easyocr_evaluator lives in scripts/ — add it to path before import
sys.path.insert(0, str(Path(__file__).parent / 'scripts'))
import easyocr_evaluator

SCRATCH_DIR = Path(__file__).parent / 'scratch'
SCRATCH_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the EasyOCR singleton before the server accepts requests.
    # Without this, the first request pays the cold-start cost.
    easyocr_evaluator.get_fast_easyocr_reader()
    yield


app = FastAPI(lifespan=lifespan)


class OcrRequest(BaseModel):
    image_base64: str


@app.post('/ocr')
def ocr(req: OcrRequest):
    t0 = time.time()
    b64_data = req.image_base64.split(',')[-1]
    try:
        img_bytes = base64.b64decode(b64_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Invalid base64: {e}')

    # Write to a temp file — the OpenCV pipeline expects a path, not bytes.
    # This file lives for the duration of the request only.
    with tempfile.NamedTemporaryFile(suffix='.jpg', dir=SCRATCH_DIR, delete=False) as f:
        f.write(img_bytes)
        tmp_path = f.name

    try:
        result = easyocr_evaluator.run_fast_ocr(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'OCR pipeline error: {e}')
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return {
        'tokens': result['extractedTokens'],
        'raw_text': result['rawOcrText'],
        'component_sequence': result.get('componentSequence', []),
        'processing_ms': int((time.time() - t0) * 1000),
        'ocr_engine': 'EasyOCR (warm microservice)',
    }


@app.get('/health')
def health():
    return {
        'status': 'ok',
        'easyocr_loaded': easyocr_evaluator.EASYOCR_AVAILABLE,
    }
