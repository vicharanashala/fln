"""
Test the ICR API end-to-end with a real image.

Usage:
  python test_ocr_api.py <image_path>

What it does:
  1. Logs in as a test teacher to get a JWT
  2. Encodes the image as base64 data URL
  3. POSTs to /api/icr/evaluate-pdf with the image
  4. Prints the OCR result (engine, raw text, extracted tokens, processing time)

Test login: teacher.ap_gnt_gnt_01_10.c4@fln.org / Fln@2026
"""

import base64
import json
import sys
import urllib.request
import urllib.error


API_BASE = "http://localhost:3000"
EMAIL = "teacher.ap_gnt_gnt_01_10.c4@fln.org"
PASSWORD = "Fln@2026"


def login() -> str:
    req = urllib.request.Request(
        f"{API_BASE}/api/auth/login",
        data=json.dumps({"email": EMAIL, "password": PASSWORD}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())["token"]


def to_data_url(path: str) -> str:
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    ext = path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")
    return f"data:{mime};base64,{b64}"


def ocr(token: str, image_path: str) -> dict:
    data_url = to_data_url(image_path)
    req = urllib.request.Request(
        f"{API_BASE}/api/icr/evaluate-pdf",
        data=json.dumps({"fileBase64": data_url}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code}: {body}")
        raise


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python test_ocr_api.py <image_path>")
        return 2
    image_path = sys.argv[1]
    print(f"image: {image_path}")
    token = login()
    print(f"token: {token[:24]}...")
    result = ocr(token, image_path)
    if not result.get("success"):
        print(f"failed: {json.dumps(result, indent=2)[:500]}")
        return 1
    # The OCR analysis is at .ocrAnalysis for the no-classId path
    ev = result.get("ocrAnalysis") or result.get("evaluation")
    print()
    print(f"engine:          {ev['ocrEngine']}")
    print(f"processingTime:  {ev['processingTimeMs']:.0f} ms")
    print(f"rawOcrText:      {ev['rawOcrText']!r}")
    print(f"extractedTokens: {[t['text'] for t in ev['extractedTokens']]}")
    if ev.get("componentSequence"):
        cs = ev["componentSequence"]
        print(f"componentSequence ({len(cs)} marks):")
        for c in cs:
            print(f"  {c['text']!r} (conf={c.get('confidence', 0):.2f}, source={c.get('source', '?')})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
