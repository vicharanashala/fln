#!/usr/bin/env python3
"""
Rasterize a PDF to JPEG using PyMuPDF.

Used by the Cloud OCR path (/api/icr/evaluate-cloud) to accept PDFs —
Ollama's vision API only takes image MIME types. Renders at 200 DPI
(down from 300 — plenty for handwriting legibility; the extra 300 DPI
detail is thrown away by the vision model's own internal downsampling
anyway) and saves as JPEG at quality 85 instead of lossless PNG. A real
22-page phone-photo scan measured ~4.8 MB/page as 300-DPI PNG (lossless
deflate compresses photo-like scanned paper poorly) vs. a small fraction
of that as 200-DPI JPEG — this is what actually made large multi-page
scans fit under the pipeline's size caps, not just raising the caps
themselves (see backend/src/routes/evaluation.ts MAX_TOTAL_BASE64).

Stdout format (single JSON line):
  Single-page mode: {"success": true, "output_path": "...", "page_size": [w, h]}
  Multi-page mode:  {"success": true, "pages": [{"page_number": 1, "output_path": "...", "page_size": [w, h]}, ...]}

Usage:
  python pdf_rasterize.py <input_pdf> <output_path>              # single page (page 1) — backward compatible
  python pdf_rasterize.py <input_pdf> <output_dir> --all-pages   # all pages, one JPEG per page in output_dir
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

        # 200 DPI render matrix (fitz base = 72 DPI).
        DPI = 200
        JPEG_QUALITY = 85
        # Guard against a stray poster/A0-sized page blowing up memory and
        # output size at a flat 200 DPI (e.g. a wrongly-uploaded non-worksheet
        # PDF) — cap the longer raster side, scaling the matrix down for that
        # one page rather than for the whole document.
        MAX_RASTER_DIM = 3500

        def matrix_for(page) -> "fitz.Matrix":
            scale = DPI / 72
            longer_pt = max(page.rect.width, page.rect.height)
            if longer_pt * scale > MAX_RASTER_DIM:
                scale = MAX_RASTER_DIM / longer_pt
            return fitz.Matrix(scale, scale)

        if args.all_pages:
            output.mkdir(parents=True, exist_ok=True)
            pages_info = []
            page_errors = []
            for i in range(doc.page_count):
                # One malformed/corrupt page (rare but real with scanned/
                # re-exported PDFs) shouldn't fail the whole multi-page scan —
                # skip it and let the caller OCR the pages that did render.
                try:
                    page = doc.load_page(i)
                    pix = page.get_pixmap(matrix=matrix_for(page), alpha=False)
                    out_path = output / f"page_{i + 1}.jpg"
                    pix.save(out_path, jpg_quality=JPEG_QUALITY)
                    page_w, page_h = page.rect.width, page.rect.height
                    pages_info.append({
                        "page_number": i + 1,
                        "output_path": str(out_path),
                        "page_size": [page_w, page_h],
                        "raster_size": [pix.width, pix.height],
                    })
                except Exception as page_err:
                    page_errors.append({"page_number": i + 1, "error": str(page_err)})
            doc.close()
            if not pages_info:
                print(json.dumps({
                    "success": False,
                    "error": f"All {doc.page_count} page(s) failed to rasterize.",
                    "page_errors": page_errors,
                }))
                sys.exit(1)
            print(json.dumps({
                "success": True,
                "page_count": len(pages_info),
                "pages": pages_info,
                **({"page_errors": page_errors} if page_errors else {}),
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
        pix = page.get_pixmap(matrix=matrix_for(page), alpha=False)
        output = output.with_suffix('.jpg')
        output.parent.mkdir(parents=True, exist_ok=True)
        pix.save(output, jpg_quality=JPEG_QUALITY)
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
