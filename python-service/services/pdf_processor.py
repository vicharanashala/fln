import os
import io
from typing import List, Tuple, Dict
import fitz  # PyMuPDF
from PIL import Image

from utils.logger import get_logger

logger = get_logger("pdf-processor")

MAX_DIMENSION = 1000
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


def pdf_to_images_and_pictures(pdf_path: str, output_dir: str = None, save_page_images: bool = False) -> Tuple[List[bytes], Dict[int, List[str]], Dict[int, str]]:
    """Render pages AND extract embedded raster images per page.

    Returns:
        pages: list of JPEG bytes (one per page) for AI vision
        pictures_by_page: {page_number: [list of saved image paths or URLs]}
        saved_page_paths: {page_number: saved JPEG path of the whole page} (only if save_page_images=True)
    """
    pages: List[bytes] = []
    pictures_by_page: Dict[int, List[str]] = {}
    saved_page_paths: Dict[int, str] = {}

    if not pdf_path or not os.path.exists(pdf_path):
        return pages, pictures_by_page, saved_page_paths

    try:
        doc = fitz.open(pdf_path)
        for page_idx, page in enumerate(doc, start=1):
            # 1. render page as JPEG for vision
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=JPEG_QUALITY)
            page_bytes = buf.getvalue()
            pages.append(page_bytes)

            # Optionally save the full page as JPEG so we can crop later
            if output_dir and save_page_images:
                os.makedirs(output_dir, exist_ok=True)
                fname = f"pdf-{os.path.basename(pdf_path)}-p{page_idx}-fullpage.jpg"
                fpath = os.path.join(output_dir, fname)
                with open(fpath, "wb") as f:
                    f.write(page_bytes)
                saved_page_paths[page_idx] = fpath
                logger.info(f"Saved full page {page_idx} -> {fname} ({len(page_bytes)//1024} KB)")

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

    return pages, pictures_by_page, saved_page_paths


def crop_page_to_bbox(page_image_path: str, bbox: Dict[str, float], padding_pct: float = 0.02, output_path: str = None) -> bytes:
    """Crop a page image to just the question's bounding box (NORMALIZED 0-1 coords).

    Returns JPEG bytes of the cropped image. If bbox is invalid, returns None.
    """
    try:
        if not page_image_path or not os.path.exists(page_image_path):
            return None
        x = float(bbox.get("x", 0))
        y = float(bbox.get("y", 0))
        w = float(bbox.get("width", 0))
        h = float(bbox.get("height", 0))
        # Validate: must be 0-1 range
        if not (0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1):
            return None

        img = Image.open(page_image_path).convert("RGB")
        page_w, page_h = img.size

        # Enforce full width (0.01 to 0.99) to guarantee left/right margins are never cut off
        x0 = int(0.01 * page_w)
        x1 = int(0.99 * page_w)

        # Convert to pixel coords for vertical axis
        y_px = int(y * page_h)
        h_px = int(h * page_h)

        # Add generous vertical padding (5%) to prevent top/bottom cutoff
        pad_y = int(0.05 * page_h)
        y0 = max(0, y_px - pad_y)
        y1 = min(page_h, y_px + h_px + pad_y)

        cropped = img.crop((x0, y0, x1, y1))
        # Make sure crop isn't too small
        if cropped.size[0] < 50 or cropped.size[1] < 50:
            return None

        buf = io.BytesIO()
        cropped.save(buf, format="JPEG", quality=JPEG_QUALITY)
        data = buf.getvalue()
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(data)
        return data
    except Exception as e:
        logger.exception(f"Crop failed: {e}")
        return None


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