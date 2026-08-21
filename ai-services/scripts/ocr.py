#!/usr/bin/env python3
"""
EasyOCR Engine script for FLN Platform.
Uses PyTorch EasyOCR with fast digit allowlist restriction and token extraction.
"""

import sys
import os
import json
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

import easyocr_evaluator

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python ocr.py <pdf_path> [student_id] [class_num] [--regions <file>]"}))
        sys.exit(1)

    # Region mode: read one answer per stored answer region instead of
    # scraping the whole page. The caller passes the regions the worksheet
    # generator recorded, each carrying its own question id, so every reading
    # is attributed by metadata rather than by position.
    if "--regions" in sys.argv:
        idx = sys.argv.index("--regions")
        regions_path = sys.argv[idx + 1] if len(sys.argv) > idx + 1 else None
        if not regions_path or not os.path.exists(regions_path):
            print(json.dumps({"status": "error", "error": "regions file not found"}))
            sys.exit(1)
        with open(regions_path, "r", encoding="utf-8") as fh:
            regions = json.load(fh)
        result = easyocr_evaluator.read_answer_regions(sys.argv[1], regions)
        print(json.dumps({"status": "success", "mode": "regions", **result}))
        return

    easyocr_evaluator.main()

if __name__ == "__main__":
    main()
