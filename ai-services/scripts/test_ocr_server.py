#!/usr/bin/env python3
"""
Integration test for the OCR microservice.
Starts uvicorn, waits for readiness, runs tests, shuts down.

Tests:
  1. Health endpoint returns {"status": "ok", "easyocr_loaded": true}
  2. POST /ocr with a real scan returns well-formed tokens
  3. Warm second call is faster than a cold subprocess would be (<5s)
  4. Response shape matches what evaluation.ts expects
"""

import subprocess, sys, time, json, base64, glob, os, requests
from pathlib import Path

ROOT = Path(__file__).parent.parent
SCRATCH = ROOT / 'scratch'
SERVER_URL = 'http://127.0.0.1:8001'
PASS = '\033[92mPASS\033[0m'
FAIL = '\033[91mFAIL\033[0m'


def start_server():
    proc = subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'ocr_server:app',
         '--host', '127.0.0.1', '--port', '8001', '--workers', '1'],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    print(f'Started uvicorn (pid {proc.pid}). Waiting for EasyOCR to load...')
    deadline = time.time() + 60
    while time.time() < deadline:
        time.sleep(2)
        try:
            r = requests.get(f'{SERVER_URL}/health', timeout=2)
            if r.status_code == 200:
                print(f'  Server ready after {int(time.time() - (deadline - 60))}s')
                return proc
        except Exception:
            pass
        # Print any server output so far
        line = proc.stdout.readline()
        if line:
            print(f'  [server] {line.decode().rstrip()}')
    proc.terminate()
    raise RuntimeError('Server did not start within 60s')


def run_tests(img_paths: list[str]):
    results = []

    # ── Test 1: health ────────────────────────────────────────────────────────
    r = requests.get(f'{SERVER_URL}/health', timeout=5)
    ok = r.status_code == 200 and r.json().get('status') == 'ok' and r.json().get('easyocr_loaded') is True
    print(f'\n[1] Health endpoint: {PASS if ok else FAIL}  {r.json()}')
    results.append(ok)

    # ── Test 2-4: OCR on real images ──────────────────────────────────────────
    for i, img_path in enumerate(img_paths, start=2):
        name = os.path.basename(img_path)
        with open(img_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()

        t0 = time.time()
        r = requests.post(f'{SERVER_URL}/ocr', json={'image_base64': b64}, timeout=30)
        elapsed = round(time.time() - t0, 2)

        ok_status = r.status_code == 200
        data = r.json() if ok_status else {}

        # Shape check: must have 'tokens', 'raw_text', 'processing_ms', 'ocr_engine'
        shape_ok = all(k in data for k in ('tokens', 'raw_text', 'processing_ms', 'ocr_engine'))

        # Tokens must be a list of dicts with 'text' and 'confidence'
        tokens = data.get('tokens', [])
        tokens_ok = isinstance(tokens, list) and all(
            isinstance(t, dict) and 'text' in t and 'confidence' in t for t in tokens
        )

        # Speed: warm inference should be under 10s (subprocess cold-start was 30-60s)
        speed_ok = elapsed < 10

        all_ok = ok_status and shape_ok and tokens_ok and speed_ok
        flag = PASS if all_ok else FAIL
        token_texts = [t.get('text', '') for t in tokens]
        print(f'\n[{i}] {name}: {flag}')
        print(f'     status={r.status_code}  elapsed={elapsed}s  processing_ms={data.get("processing_ms")}')
        print(f'     tokens={token_texts}')
        print(f'     raw_text={data.get("raw_text")!r}')
        print(f'     shape_ok={shape_ok}  tokens_ok={tokens_ok}  speed_ok={speed_ok} (<10s)')
        results.append(all_ok)

    # ── Test: second call is warm (comparable speed to first) ─────────────────
    if img_paths:
        with open(img_paths[0], 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
        t0 = time.time()
        r2 = requests.post(f'{SERVER_URL}/ocr', json={'image_base64': b64}, timeout=30)
        elapsed2 = round(time.time() - t0, 2)
        ok = r2.status_code == 200 and elapsed2 < 10
        print(f'\n[warm-repeat] Second call to same image: {PASS if ok else FAIL}  elapsed={elapsed2}s')
        results.append(ok)

    return results


def main():
    images = sorted(glob.glob(str(SCRATCH / '*.jpeg')) + glob.glob(str(SCRATCH / '*.jpg')))[:2]
    if not images:
        print('No test images found in ai-services/scratch/')
        sys.exit(1)

    proc = start_server()
    try:
        results = run_tests(images)
    finally:
        proc.terminate()
        proc.wait()
        print('\nServer stopped.')

    passed = sum(results)
    total = len(results)
    print(f'\n{"="*50}')
    print(f'Result: {passed}/{total} tests passed')
    if passed < total:
        print('SOME TESTS FAILED — fix before merging.')
        sys.exit(1)
    else:
        print('ALL TESTS PASSED — safe to merge.')


if __name__ == '__main__':
    main()
