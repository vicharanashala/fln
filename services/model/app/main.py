"""SmartFLN model service.

Run locally:

    python -m app.main

The same `/v1/infer` endpoint supports the existing crop-level backend contract
and the new full-page QR/template evaluation contract.
"""

from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import unquote, urlparse

from app.pipeline.evaluator import infer
from app.pipeline.recognition import MODEL_NAME, MODEL_VERSION, available_ocr_providers
from app.pipeline.vision import available_vision_providers

SERVICE_NAME = "smartfln-model"
MAX_REQUEST_BYTES = int(os.getenv("SMARTFLN_MODEL_MAX_REQUEST_BYTES", str(30 * 1024 * 1024)))
STATIC_DIR = Path(__file__).resolve().parent / "static"
INDEX_HTML = STATIC_DIR / "index.html"
SAMPLES_DIR = Path(__file__).resolve().parents[1] / "samples"


def health() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "status": "ok",
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "ocrProviders": available_ocr_providers(),
        "visionProviders": available_vision_providers(),
        "endpoints": ["GET /", "GET /health", "POST /v1/infer"],
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self._send(status, body, "application/json")

    def _html(self, status: int, html: str) -> None:
        self._send(status, html.encode("utf-8"), "text/html; charset=utf-8")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self._html(200, INDEX_HTML.read_text(encoding="utf-8"))
            return
        if path == "/health":
            self._json(200, health())
            return
        if path == "/favicon.ico":
            self._send(204, b"", "image/x-icon")
            return
        if path.startswith("/samples/"):
            name = Path(unquote(path)).name
            sample_path = (SAMPLES_DIR / name).resolve()
            if sample_path.parent == SAMPLES_DIR.resolve() and sample_path.exists() and sample_path.is_file():
                content_type = mimetypes.guess_type(sample_path.name)[0] or "application/octet-stream"
                self._send(200, sample_path.read_bytes(), content_type)
                return
            self._json(404, {"error": "sample_not_found"})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/v1/infer":
            self._json(404, {"error": "not_found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                self._json(400, {"error": "request_body_required"})
                return
            if length > MAX_REQUEST_BYTES:
                self._json(413, {"error": "request_too_large", "maxBytes": MAX_REQUEST_BYTES})
                return
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._json(200, infer(payload))
        except Exception as error:
            self._json(400, {"error": str(error)})

    def log_message(self, format: str, *args: Any) -> None:
        return


def serve(host: str = "127.0.0.1", port: int = 8090) -> None:
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"{SERVICE_NAME} listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve(
        host=os.getenv("SMARTFLN_MODEL_HOST", "127.0.0.1"),
        port=int(os.getenv("SMARTFLN_MODEL_PORT", "8090")),
    )
