"""Image loading and preprocessing utilities for SmartFLN scans."""

from __future__ import annotations

import base64
import io
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError

STANDARD_A4 = {"width": 2480, "height": 3508}


class ImageDecodeError(ValueError):
    """Raised when a scan image cannot be decoded."""


def decode_image_data_url(image_data_url: str) -> bytes:
    """Decode a data URL or raw base64 string into image bytes."""

    if not image_data_url:
        raise ImageDecodeError("imageDataUrl is required.")

    encoded = image_data_url.split(",", 1)[1] if "," in image_data_url else image_data_url
    try:
        return base64.b64decode(encoded, validate=False)
    except Exception as error:  # pragma: no cover - exact decoder errors differ by runtime
        raise ImageDecodeError("imageDataUrl is not valid base64.") from error


def load_image_from_data_url(image_data_url: str) -> Image.Image:
    """Load an uploaded scan into a normalized RGB Pillow image."""

    image_bytes = decode_image_data_url(image_data_url)
    try:
        image = Image.open(io.BytesIO(image_bytes))
        return ImageOps.exif_transpose(image).convert("RGB")
    except UnidentifiedImageError as error:
        raise ImageDecodeError("imageDataUrl does not contain a readable image.") from error


def image_to_data_url(image: Image.Image, image_format: str = "PNG") -> str:
    """Serialize a Pillow image to a data URL for OCR providers."""

    buffer = io.BytesIO()
    fmt = image_format.upper()
    image.save(buffer, format=fmt)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    mime = "image/png" if fmt == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{encoded}"


def resize_to_standard_page(image: Image.Image, page_size: dict[str, int] | None = None) -> Image.Image:
    """Resize a rectified page to the template coordinate system."""

    page_size = page_size or STANDARD_A4
    width = int(page_size.get("width", STANDARD_A4["width"]))
    height = int(page_size.get("height", STANDARD_A4["height"]))
    if image.size == (width, height):
        return image
    return image.resize((width, height), Image.Resampling.LANCZOS)


def enhance_page(image: Image.Image) -> Image.Image:
    """Apply conservative page-level enhancement before ROI extraction."""

    image = ImageOps.exif_transpose(image).convert("RGB")
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Sharpness(image).enhance(1.05)
    return image


def preprocess_roi(image: Image.Image, *, target_min_width: int = 720) -> Image.Image:
    """Prepare a cropped answer box for OCR.

    The preprocessing is intentionally conservative so handwriting strokes are
    not destroyed. It keeps a high-resolution grayscale image with improved
    contrast and mild sharpening.
    """

    image = ImageOps.exif_transpose(image).convert("L")
    image = ImageOps.autocontrast(image, cutoff=1)

    if image.width < target_min_width:
        scale = target_min_width / max(1, image.width)
        image = image.resize((target_min_width, max(1, int(image.height * scale))), Image.Resampling.LANCZOS)

    image = ImageEnhance.Contrast(image).enhance(1.35)
    image = image.filter(ImageFilter.SHARPEN)
    return image


def estimate_image_quality(image: Image.Image) -> dict[str, Any]:
    """Return simple quality diagnostics without heavy CV dependencies."""

    gray = image.convert("L")
    histogram = gray.histogram()
    pixels = max(1, gray.width * gray.height)
    mean = sum(index * value for index, value in enumerate(histogram)) / pixels
    variance = sum(((index - mean) ** 2) * value for index, value in enumerate(histogram)) / pixels
    contrast = min(1.0, (variance ** 0.5) / 80)
    brightness_ok = 0.18 <= mean / 255 <= 0.92
    score = max(0.2, min(0.98, 0.48 + contrast * 0.45 + (0.05 if brightness_ok else -0.08)))
    return {
        "width": image.width,
        "height": image.height,
        "meanBrightness": round(mean / 255, 3),
        "contrastScore": round(contrast, 3),
        "qualityScore": round(score, 3),
    }
