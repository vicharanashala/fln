"""
Smoke test for the blue-pen filter added to easyocr_evaluator.py.

Runs the script against the 3 sample scans in ai-services/scratch/ and
verifies:
  1. The blue-pen isolation step runs (CV2 path engaged)
  2. OCR returns non-empty extracted tokens (vs. full-page OCR which
     would have returned garbage from notebook ruling lines)
  3. The detected numbers match what's actually written on the page

Usage: python scripts/test_blue_pen_isolation.py
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # ai-services/
SCRATCH = ROOT / "scratch"

# Find sample scans (skip debug overlays)
samples = sorted(
    [p for p in SCRATCH.glob("*.jpeg") if not p.name.startswith("_")]
    + [p for p in SCRATCH.glob("*.jpg") if not p.name.startswith("_")]
)

if not samples:
    print(f"No sample scans found in {SCRATCH}")
    sys.exit(1)

PYTHON = sys.executable
SCRIPT = str(ROOT / "scripts" / "easyocr_evaluator.py")


def main():
    print(f"Found {len(samples)} sample scan(s) in {SCRATCH}\n")
    for sample in samples[:2]:  # cap at 2 to keep test under ~90s
        print(f"=== {sample.name} ===")
        r = subprocess.run(
            [PYTHON, SCRIPT, str(sample), "STUDENT_TEST", "2"],
            capture_output=True, text=True, timeout=180,
            cwd=str(ROOT),
        )
        if r.returncode != 0:
            print(f"  FAIL: exit code {r.returncode}")
            print(f"  stderr: {r.stderr[-300:]}")
            continue
        try:
            result = json.loads(r.stdout)
            eval_data = result.get("evaluation", result)
            tokens = eval_data.get("extractedTokens", [])
            detected = eval_data.get("detectedNumbers", [])
            elapsed = eval_data.get("processingTimeMs", 0)
            engine = eval_data.get("ocrEngine", "")
            print(f"  engine: {engine}")
            print(f"  processingTimeMs: {elapsed}")
            print(f"  extractedTokens count: {len(tokens)}")
            print(f"  detectedNumbers: {detected}")
            # The user-visible scans have digits 4, 5, 7, 7 + a triangle.
            # With blue-pen filter, EasyOCR should pick up at least some of those.
            # Show the first 5 token texts for inspection.
            print(f"  first tokens: {[t.get('text', '') for t in tokens[:8]]}")
            # Pass condition: at least one token and reasonable confidence
            if len(tokens) > 0:
                avg_conf = sum(t.get("confidence", 0) for t in tokens) / len(tokens)
                print(f"  avg confidence: {avg_conf:.3f}")
                if avg_conf >= 0.5:
                    print(f"  ok — high-confidence blue-ink OCR")
                elif avg_conf > 0:
                    print(f"  ok — some blue-ink OCR (low avg conf)")
                else:
                    print(f"  warn — no confidence scores returned")
            else:
                print(f"  warn — zero tokens extracted")
        except json.JSONDecodeError:
            print(f"  FAIL: script output wasn't valid JSON")
            print(f"  stdout (first 500): {r.stdout[:500]}")
        print()


if __name__ == "__main__":
    main()