#!/usr/bin/env python3
"""
Rasterize the first page of a PDF to PNG using PyMuPDF.

Used by the /api/icr/filter endpoint to accept PDFs (the blue-ink filter
only operates on raster pixels). Renders page 1 at 300 DPI so downstream
OCR sees enough detail to read student handwriting.

Stdout format (single JSON line):
  {"success": true, "output_path": "...", "page_size": [w, h]}
"""

import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python pdf_rasterize.py <input_pdf> <output_png>",
        }))
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        print(json.dumps({
            "success": False,
            "error": f"PyMuPDF is not installed in the venv: {e}",
        }))
        sys.exit(1)

    if not input_path.exists():
        print(json.dumps({
            "success": False,
            "error": f"Input PDF not found: {input_path}",
        }))
        sys.exit(1)

    try:
        doc = fitz.open(input_path)
        if doc.page_count == 0:
            doc.close()
            print(json.dumps({
                "success": False,
                "error": "PDF has no pages.",
            }))
            sys.exit(1)

        # Render page 1 at 300 DPI for OCR-quality detail.
        # fitz uses 72 DPI as the base; 300/72 ≈ 4.1667 zoom.
        page = doc.load_page(0)
        matrix = fitz.Matrix(300 / 72, 300 / 72)
        pix = page.get_pixmap(matrix=matrix, alpha=False)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        pix.save(output_path)

        page_w, page_h = page.rect.width, page.rect.height
        doc.close()

        print(json.dumps({
            "success": True,
            "output_path": str(output_path),
            "page_size": [page_w, page_h],
            "raster_size": [pix.width, pix.height],
        }))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"PDF rasterization failed: {e}",
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()