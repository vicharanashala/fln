#!/usr/bin/env python3
"""
Rasterize a PDF to PNG using PyMuPDF.

Used by the /api/icr/filter endpoint to accept PDFs (the blue-ink filter
only operates on raster pixels). Renders at 300 DPI so downstream OCR
sees enough detail to read student handwriting.

Stdout format (single JSON line):
  Single-page mode: {"success": true, "output_path": "...", "page_size": [w, h]}
  Multi-page mode:  {"success": true, "pages": [{"page_number": 1, "output_path": "...", "page_size": [w, h]}, ...]}

Usage:
  python pdf_rasterize.py <input_pdf> <output_path>              # single page (page 1) — backward compatible
  python pdf_rasterize.py <input_pdf> <output_dir> --all-pages   # all pages, one PNG per page in output_dir
  python pdf_rasterize.py <input_pdf> <output_path> --page <n>   # specific page (1-based)
"""

import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Rasterize PDF to PNG with PyMuPDF.")
    parser.add_argument("input_pdf", help="Path to input PDF")
    parser.add_argument("output", help="Path to output PNG (single-page) or output directory (multi-page)")
    parser.add_argument("--all-pages", action="store_true", help="Render every page, one PNG per page in output directory")
    parser.add_argument("--page", type=int, help="Render a specific page (1-based)")
    args = parser.parse_args()

    input_path = Path(args.input_pdf)
    output = Path(args.output)

    try:
        # Import under the `pymupdf` name rather than the legacy `fitz` alias —
        # importing as `fitz` prints a deprecation warning to stdout, and this
        # script's stdout is strictly JSON-parsed by the Node caller, so any
        # extra stdout line breaks that parse.
        import pymupdf as fitz
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

        # 300 DPI render matrix (fitz base = 72 DPI).
        matrix = fitz.Matrix(300 / 72, 300 / 72)

        if args.all_pages:
            output.mkdir(parents=True, exist_ok=True)
            pages_info = []
            for i in range(doc.page_count):
                page = doc.load_page(i)
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                out_path = output / f"page_{i + 1}.png"
                pix.save(out_path)
                page_w, page_h = page.rect.width, page.rect.height
                pages_info.append({
                    "page_number": i + 1,
                    "output_path": str(out_path),
                    "page_size": [page_w, page_h],
                    "raster_size": [pix.width, pix.height],
                })
            doc.close()
            print(json.dumps({
                "success": True,
                "page_count": len(pages_info),
                "pages": pages_info,
            }))
            return

        # Single-page mode (backward compatible). Default = page 1, or --page N.
        page_index = (args.page - 1) if args.page else 0
        if page_index < 0 or page_index >= doc.page_count:
            doc.close()
            print(json.dumps({
                "success": False,
                "error": f"Page {args.page} out of range (PDF has {doc.page_count} pages).",
            }))
            sys.exit(1)
        page = doc.load_page(page_index)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        output.parent.mkdir(parents=True, exist_ok=True)
        pix.save(output)
        page_w, page_h = page.rect.width, page.rect.height
        doc.close()

        print(json.dumps({
            "success": True,
            "output_path": str(output),
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
