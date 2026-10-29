import base64
import os
import pathlib
import sys
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw

from app.pipeline.evaluator import infer_full_scan
from app.pipeline.preprocess import image_to_data_url
from app.pipeline.recognition import _postprocess_ocr_text
from app.pipeline.roi import detect_answer_box_marker
from app.pipeline.scoring import compare_answer, score_answer
from app.pipeline.vision import parse_qr_payload


class PipelineTest(unittest.TestCase):
    def test_parse_json_qr_payload(self):
        payload = parse_qr_payload('{"student_id":"stu_1","paper_id":"paper_1","test_id":"test_1"}')
        self.assertEqual(payload["student_id"], "stu_1")
        self.assertEqual(payload["paper_id"], "paper_1")
        self.assertEqual(payload["test_id"], "test_1")

    def test_parse_existing_smartfln_short_qr(self):
        payload = parse_qr_payload("SFLN:pp_abc123:deadbeef")
        self.assertEqual(payload["paper_id"], "pp_abc123")
        self.assertEqual(payload["paper_page_id"], "pp_abc123")

    def test_score_numeric_exact_answer(self):
        question = {"type": "numeric", "answer_key": "5", "marks": 1, "auto_score": True}
        result = score_answer(question, "5", 0.94, 0.9)
        self.assertEqual(result["awardedMarks"], 1)
        self.assertEqual(result["needsReview"], False)

    def test_compare_short_text_similarity(self):
        question = {"type": "short_text", "answer_key": "circle"}
        result = compare_answer(question, "circl")
        self.assertGreater(result["matchScore"], 0.85)

    def test_full_scan_returns_review_safe_json(self):
        image = Image.new("RGB", (700, 990), "white")
        draw = ImageDraw.Draw(image)
        for box in ((12, 12, 52, 52), (648, 12, 688, 52), (648, 938, 688, 978), (12, 938, 52, 978)):
            draw.rectangle(box, fill="black")
        draw.rectangle((50, 210, 650, 310), outline="black", width=3)
        draw.text((60, 220), "5", fill="black")

        request = {
            "scanPageId": "scan_test_1",
            "qrText": '{"student_id":"stu_1","paper_id":"paper_inline","test_id":"test_1"}',
            "imageDataUrl": image_to_data_url(image),
            "template": {
                "paper_id": "paper_inline",
                "test_id": "test_1",
                "page": {"width": 700, "height": 990},
                "questions": [
                    {
                        "question_id": "q1",
                        "label": "Q1",
                        "type": "numeric",
                        "answer_key": "5",
                        "marks": 1,
                        "roi": {"x": 50, "y": 210, "width": 600, "height": 100},
                    }
                ],
            },
        }

        result = infer_full_scan(request)
        self.assertEqual(result["scan_id"], "scan_test_1")
        self.assertEqual(result["student_id"], "stu_1")
        self.assertEqual(result["paper_id"], "paper_inline")
        self.assertEqual(len(result["answers"]), 1)
        self.assertEqual(result["answers"][0]["needs_teacher_review"], True)
        self.assertIn("answer_rois_cropped", result["pipeline"])

    def test_visual_question_returns_full_manual_crop_with_zero_confidence(self):
        image = Image.new("RGB", (700, 990), "white")
        draw = ImageDraw.Draw(image)
        for box in ((12, 12, 52, 52), (648, 12, 688, 52), (648, 938, 688, 978), (12, 938, 52, 978)):
            draw.rectangle(box, fill="black")
        draw.rectangle((70, 210, 630, 410), outline="black", width=3)
        draw.text((90, 240), "A. 13     B. 18", fill="black")

        result = infer_full_scan({
            "scanPageId": "scan_visual",
            "qrText": "stu_1|paper_visual|test_1|1",
            "imageDataUrl": image_to_data_url(image),
            "template": {
                "paper_id": "paper_visual",
                "test_id": "test_1",
                "page": {"width": 700, "height": 990},
                "questions": [{
                    "question_id": "q_visual",
                    "label": "Q1",
                    "type": "mcq",
                    "answer_key": "B",
                    "marks": 1,
                    "auto_score": False,
                    "roi": {"x": 70, "y": 210, "width": 560, "height": 200},
                }],
            },
        })

        answer = result["answers"][0]
        self.assertEqual(answer["confidence"], 0.0)
        self.assertEqual(answer["needs_teacher_review"], True)
        self.assertEqual(answer["ocr"]["provider_status"], "manual_visual_review")
        self.assertEqual(answer["roi"]["height"], 200)
        self.assertTrue(answer["crop_image_data_url"].startswith("data:image/png;base64,"))

    def test_full_scan_rejects_page_with_one_missing_fiducial(self):
        image = Image.new("RGB", (700, 990), "white")
        draw = ImageDraw.Draw(image)
        for box in ((12, 12, 52, 52), (648, 12, 688, 52), (12, 938, 52, 978)):
            draw.rectangle(box, fill="black")

        result = infer_full_scan({
            "scanPageId": "scan_missing_marker",
            "qrText": "stu_1|paper_missing_marker|test_1|1",
            "imageDataUrl": image_to_data_url(image),
            "template": {
                "paper_id": "paper_missing_marker",
                "test_id": "test_1",
                "page": {"width": 700, "height": 990},
                "questions": [{
                    "question_id": "q1",
                    "type": "short_text",
                    "answer_key": "5",
                    "roi": {"x": 70, "y": 210, "width": 560, "height": 100},
                }],
            },
        })

        self.assertEqual(result["error"], "invalid_paper")
        self.assertEqual(result["ocr_started"], False)
        self.assertEqual(result["answers"], [])
        self.assertIn("four_markers_detected", result["validation"]["failed"])

    def test_full_scan_rejects_non_smartfln_page_before_ocr(self):
        image = Image.new("RGB", (700, 990), "white")
        draw = ImageDraw.Draw(image)
        draw.text((80, 120), "Normal homework page", fill="black")
        draw.rectangle((80, 220, 620, 320), outline="black", width=2)

        request = {
            "scanPageId": "scan_invalid",
            "imageDataUrl": image_to_data_url(image),
            "student_id": "stu_fake",
            "paper_id": "demo-paper",
            "test_id": "asm_demo_math_baseline",
        }

        result = infer_full_scan(request)
        self.assertEqual(result["error"], "invalid_paper")
        self.assertEqual(result["ocr_started"], False)
        self.assertEqual(result["answers"], [])
        self.assertIn("qr_present", result["validation"]["failed"])
        self.assertIn("four_markers_detected", result["validation"]["failed"])
        self.assertIn("ocr_skipped", result["pipeline"])

    def test_generated_filled_sample_requires_ocr_for_scoring(self):
        image_bytes = (ROOT / "samples" / "demo-paper-filled.png").read_bytes()
        request = {
            "scanPageId": "scan_sample_filled",
            "qrText": "stu_demo_001|demo-paper|asm_demo_math_baseline",
            "imageDataUrl": "data:image/png;base64," + base64.b64encode(image_bytes).decode("ascii"),
        }

        with patch.dict(os.environ, {"SMARTFLN_MODEL_OCR_PROVIDER": "template_assisted"}):
            result = infer_full_scan(request)
        self.assertEqual(result["awarded_marks"], 0.0)
        self.assertEqual(result["total_marks"], 5.0)
        self.assertEqual(result["review_count"], 4)
        self.assertEqual(result["answers"][0]["recognized_answer"], "")
        self.assertEqual(result["answers"][0]["recognition_label"], "OCR required")
        self.assertEqual(result["answers"][0]["recognition_status"], "ocr_required")
        self.assertEqual(result["answers"][0]["answer_detected"], True)
        self.assertEqual(result["answers"][0]["ocr"]["provider_status"], "ink_detected_ocr_required")
        self.assertEqual(result["answers"][0]["ocr"]["diagnostics"]["ink"]["usableInk"], True)
        self.assertTrue(result["answers"][0]["crop_image_data_url"].startswith("data:image/png;base64,"))

    def test_second_paper_format_uses_its_own_template(self):
        image_bytes = (ROOT / "samples" / "demo-paper-compact-filled.png").read_bytes()
        qr_text = (ROOT / "samples" / "demo-paper-compact-qr.txt").read_text(encoding="utf-8").strip()
        request = {
            "scanPageId": "scan_sample_compact",
            "qrText": qr_text,
            "imageDataUrl": "data:image/png;base64," + base64.b64encode(image_bytes).decode("ascii"),
        }

        with patch.dict(os.environ, {"SMARTFLN_MODEL_OCR_PROVIDER": "template_assisted"}):
            result = infer_full_scan(request)
        self.assertEqual(result["valid_paper"], True)
        self.assertEqual(result["paper_id"], "demo-paper-compact")
        self.assertEqual(result["test_id"], "asm_demo_compact_math")
        self.assertEqual(result["answer_key_id"], "ak_demo_compact_math_v1")
        self.assertEqual(result["answer_key"]["mapped_from_test_id"], "asm_demo_compact_math")
        self.assertEqual(len(result["answers"]), 5)
        self.assertEqual(result["total_marks"], 5.0)
        self.assertTrue(all(answer["box_marker"]["detected"] for answer in result["answers"]))

    def test_required_answer_box_marker_skips_missing_roi(self):
        image = Image.new("RGB", (700, 990), "white")
        draw = ImageDraw.Draw(image)
        for box in ((12, 12, 52, 52), (648, 12, 688, 52), (648, 938, 688, 978), (12, 938, 52, 978)):
            draw.rectangle(box, fill="black")
        draw.rectangle((50, 210, 650, 310), outline="black", width=3)
        draw.text((60, 220), "5", fill="black")

        request = {
            "scanPageId": "scan_missing_box_marker",
            "qrText": '{"student_id":"stu_1","paper_id":"paper_inline","test_id":"test_1"}',
            "imageDataUrl": image_to_data_url(image),
            "template": {
                "paper_id": "paper_inline",
                "test_id": "test_1",
                "box_markers_required": True,
                "page": {"width": 700, "height": 990},
                "questions": [
                    {
                        "question_id": "q1",
                        "label": "Q1",
                        "type": "numeric",
                        "answer_key": "5",
                        "marks": 1,
                        "roi": {"x": 50, "y": 210, "width": 600, "height": 100},
                    }
                ],
            },
        }

        result = infer_full_scan(request)
        self.assertEqual(result["answers"][0]["ocr"]["provider_status"], "answer_box_marker_missing")
        self.assertEqual(result["answers"][0]["box_marker"]["detected"], False)

    def test_detect_answer_box_marker_on_generated_sample(self):
        image = Image.open(ROOT / "samples" / "demo-paper-filled.png").convert("RGB")
        marker = detect_answer_box_marker(image, {"x": 198, "y": 772, "width": 2084, "height": 386}, "Q1")
        self.assertEqual(marker["status"], "detected")

    def test_trocr_postprocessing_by_question_type(self):
        self.assertEqual(_postprocess_ocr_text("7.", {"type": "mcq"}), "7")
        self.assertEqual(_postprocess_ocr_text("5. 5", {"type": "numeric"}), "5")
        self.assertEqual(_postprocess_ocr_text("S", {"type": "numeric"}), "5")
        self.assertEqual(_postprocess_ocr_text("I2", {"type": "numeric"}), "12")
        self.assertEqual(_postprocess_ocr_text("circle .", {"type": "short_text"}), "circle")
        self.assertEqual(_postprocess_ocr_text("cirde", {"type": "short_text", "answer_key": "circle"}), "circle")
        self.assertEqual(_postprocess_ocr_text("I 1-one , 2-two .", {"type": "matching"}), "1:one 2:two")


if __name__ == "__main__":
    unittest.main()
