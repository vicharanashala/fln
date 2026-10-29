import json
import pathlib
import sys
import unittest

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.main import health, infer, INDEX_HTML


class ModelContractTest(unittest.TestCase):
    def test_health_payload(self):
        payload = health()
        self.assertEqual(payload["service"], "smartfln-model")
        self.assertEqual(payload["status"], "ok")

    def test_model_test_page_exists(self):
        html = INDEX_HTML.read_text(encoding="utf-8")
        self.assertIn("SmartFLN Model Test", html)
        self.assertIn("/v1/infer", html)
        self.assertIn("/samples/demo-paper-filled.png", html)

    def test_sample_paper_image_exists(self):
        sample_path = ROOT / "samples" / "demo-paper-filled.png"
        self.assertTrue(sample_path.exists())
        with Image.open(sample_path) as image:
            self.assertEqual(image.size, (2480, 3508))

    def test_sample_manifest_lists_multiple_papers(self):
        manifest_path = ROOT / "samples" / "manifest.json"
        self.assertTrue(manifest_path.exists())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        paper_ids = {sample["paper_id"] for sample in manifest}
        self.assertIn("demo-paper", paper_ids)
        self.assertIn("demo-paper-compact", paper_ids)
        self.assertIn("demo-lang", paper_ids)
        self.assertTrue(all(sample.get("answer_key_id") for sample in manifest))

    def test_infer_returns_review_safe_result(self):
        sample_path = ROOT / "app" / "contracts" / "sample_request.json"
        payload = json.loads(sample_path.read_text(encoding="utf-8"))
        result = infer(payload)
        self.assertEqual(result["scanPageId"], "sp_demo")
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["questionId"], "q_demo_2")
        self.assertLess(result["results"][0]["confidence"], 0.5)
        self.assertEqual(result["results"][0]["needsReview"], True)


if __name__ == "__main__":
    unittest.main()
