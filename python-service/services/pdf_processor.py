import os
import io
from typing import List
import fitz  # PyMuPDF
from PIL import Image

from utils.logger import get_logger

logger = get_logger("pdf-processor")

MAX_DIMENSION = 1600
JPEG_QUALITY = 85


def pdf_to_images(pdf_path: str) -> List[bytes]:
    """Convert each page of a PDF into a JPEG byte string.

    Returns an empty list if the PDF can't be opened or doesn't exist.
    """
    if not pdf_path or not os.path.exists(pdf_path):
        logger.warning(f"PDF not found at {pdf_path}")
        return []

    images: List[bytes] = []
    try:
        doc = fitz.open(pdf_path)
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=JPEG_QUALITY)
            images.append(buf.getvalue())
            logger.info(f"Rendered page {i + 1}/{len(doc)} -> {len(buf.getvalue()) // 1024} KB")
        doc.close()
    except Exception as e:
        logger.exception(f"Failed to convert PDF: {e}")
        return []

    return images


def pdf_to_text(pdf_path: str) -> str:
    """Extract plain text from a PDF."""
    if not pdf_path or not os.path.exists(pdf_path):
        return ""
    try:
        doc = fitz.open(pdf_path)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text
    except Exception as e:
        logger.exception(f"Failed to read PDF text: {e}")
        return ""