import os
import io
from typing import List, Tuple, Dict
import fitz  # PyMuPDF
from PIL import Image

from utils.logger import get_logger

logger = get_logger("pdf-processor")

MAX_DIMENSION = 1600
JPEG_QUALITY = 85


def pdf_to_images(pdf_path: str) -> List[bytes]:
    """Convert each page of a PDF into a JPEG byte string for AI vision."""
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


def pdf_to_images_and_pictures(pdf_path: str, output_dir: str = None) -> Tuple[List[bytes], Dict[int, List[str]]]:
    """Render pages AND extract embedded raster images per page.

    Returns:
        pages: list of JPEG bytes (one per page) for AI vision
        pictures_by_page: {page_number: [list of saved image paths or URLs]}
    """
    pages: List[bytes] = []
    pictures_by_page: Dict[int, List[str]] = {}

    if not pdf_path or not os.path.exists(pdf_path):
        return pages, pictures_by_page

    try:
        doc = fitz.open(pdf_path)
        for page_idx, page in enumerate(doc, start=1):
            # 1. render page as JPEG for vision
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=JPEG_QUALITY)
            pages.append(buf.getvalue())

            # 2. extract embedded raster images
            image_paths = []
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                for pic_idx, pic in enumerate(page.get_images(full=True), start=1):
                    try:
                        xref = pic[0]
                        base = doc.extract_image(xref)
                        ext = base.get("ext", "png")
                        data = base.get("image")
                        if not data:
                            continue
                        # Save original
                        fname = f"pdf-{os.path.basename(pdf_path)}-p{page_idx}-img{pic_idx}.{ext}"
                        fpath = os.path.join(output_dir, fname)
                        with open(fpath, "wb") as f:
                            f.write(data)
                        image_paths.append(fpath)
                        logger.info(f"Extracted page {page_idx} image {pic_idx} -> {fname} ({len(data)//1024} KB)")
                    except Exception as e:
                        logger.warning(f"Could not extract image {pic_idx} on page {page_idx}: {e}")

            if image_paths:
                pictures_by_page[page_idx] = image_paths

        doc.close()
    except Exception as e:
        logger.exception(f"Failed to convert/extract PDF: {e}")

    return pages, pictures_by_page


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


def render_single_image(image_path: str) -> bytes:
    """Read a single image file, normalize to JPEG, optionally downscale."""
    if not image_path or not os.path.exists(image_path):
        raise FileNotFoundError(image_path)
    img = Image.open(image_path).convert("RGB")
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    return buf.getvalue()