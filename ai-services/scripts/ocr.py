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
        print(json.dumps({"error": "Usage: python ocr.py <pdf_path> [student_id] [class_num]"}))
        sys.exit(1)

    easyocr_evaluator.main()

if __name__ == "__main__":
    main()
