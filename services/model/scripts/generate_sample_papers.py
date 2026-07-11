"""Generate SmartFLN sample answer-sheet images from template JSON files.

Each generated paper includes:
- A4 coordinate system from the template
- one QR code containing student_id, paper_id, test_id in compact pipe format
- four black corner markers
- labelled prompts and fixed answer boxes from template ROIs
"""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import wrap
from typing import Any

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "templates"
SAMPLES_DIR = ROOT / "samples"
STUDENT_ID = "stu_demo_001"


def create_galois_tables() -> tuple[list[int], list[int]]:
    exp = [0] * 512
    log = [0] * 256
    value = 1
    for index in range(255):
        exp[index] = value
        log[value] = index
        value <<= 1
        if value & 0x100:
            value ^= 0x11D
    for index in range(255, 512):
        exp[index] = exp[index - 255]
    return exp, log


GF_EXP, GF_LOG = create_galois_tables()


def gf_multiply(left: int, right: int) -> int:
    if left == 0 or right == 0:
        return 0
    return GF_EXP[GF_LOG[left] + GF_LOG[right]]


def poly_multiply(left: list[int], right: list[int]) -> list[int]:
    result = [0] * (len(left) + len(right) - 1)
    for left_index, left_value in enumerate(left):
        for right_index, right_value in enumerate(right):
            result[left_index + right_index] ^= gf_multiply(left_value, right_value)
    return result


def rs_generator(degree: int) -> list[int]:
    generator = [1]
    for index in range(degree):
        generator = poly_multiply(generator, [1, GF_EXP[index]])
    return generator


def reed_solomon(data: list[int], degree: int) -> list[int]:
    generator = rs_generator(degree)
    remainder = [0] * degree
    for byte in data:
        factor = byte ^ remainder.pop(0)
        remainder.append(0)
        for index in range(degree):
            remainder[index] ^= gf_multiply(generator[index + 1], factor)
    return remainder


def append_bits(bits: list[int], value: int, length: int) -> None:
    for index in range(length - 1, -1, -1):
        bits.append((value >> index) & 1)


def encode_qr_codewords(text: str) -> list[int]:
    raw = text.encode("utf-8")
    if len(raw) > 53:
        raise ValueError("QR payload is too large for this demo QR template.")

    data_codeword_count = 55
    bits: list[int] = []
    append_bits(bits, 0b0100, 4)
    append_bits(bits, len(raw), 8)
    for byte in raw:
        append_bits(bits, byte, 8)

    capacity = data_codeword_count * 8
    append_bits(bits, 0, min(4, capacity - len(bits)))
    while len(bits) % 8 != 0:
        bits.append(0)

    data = []
    for index in range(0, len(bits), 8):
        data.append(int("".join(str(bit) for bit in bits[index : index + 8]), 2))

    pads = [0xEC, 0x11]
    index = 0
    while len(data) < data_codeword_count:
        data.append(pads[index % 2])
        index += 1

    return [*data, *reed_solomon(data, 15)]


def create_qr_matrix(text: str) -> list[list[bool]]:
    size = 29
    modules = [[False for _ in range(size)] for _ in range(size)]
    reserved = [[False for _ in range(size)] for _ in range(size)]

    def set_module(x: int, y: int, dark: bool, lock: bool = True) -> None:
        if x < 0 or y < 0 or x >= size or y >= size:
            return
        modules[y][x] = bool(dark)
        if lock:
            reserved[y][x] = True

    def finder(x: int, y: int) -> None:
        for dy in range(-1, 8):
            for dx in range(-1, 8):
                dark = (
                    0 <= dx <= 6
                    and 0 <= dy <= 6
                    and (dx in {0, 6} or dy in {0, 6} or (2 <= dx <= 4 and 2 <= dy <= 4))
                )
                set_module(x + dx, y + dy, dark, True)

    def alignment(cx: int, cy: int) -> None:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                distance = max(abs(dx), abs(dy))
                set_module(cx + dx, cy + dy, distance == 2 or distance == 0, True)

    finder(0, 0)
    finder(size - 7, 0)
    finder(0, size - 7)
    alignment(22, 22)

    for index in range(8, size - 8):
        set_module(index, 6, index % 2 == 0, True)
        set_module(6, index, index % 2 == 0, True)
    set_module(8, size - 8, True, True)

    for index in range(0, 9):
        if index != 6:
            set_module(8, index, False, True)
            set_module(index, 8, False, True)
    for index in range(8):
        set_module(size - 1 - index, 8, False, True)
        set_module(8, size - 1 - index, False, True)

    codewords = encode_qr_codewords(text)
    data_bits = [(byte >> (7 - index)) & 1 for byte in codewords for index in range(8)]
    bit_index = 0
    upward = True
    right = size - 1
    while right > 0:
        if right == 6:
            right -= 1
        for vertical in range(size):
            y = size - 1 - vertical if upward else vertical
            for column in range(2):
                x = right - column
                if reserved[y][x]:
                    continue
                dark = data_bits[bit_index] == 1 if bit_index < len(data_bits) else False
                bit_index += 1
                if (x + y) % 2 == 0:
                    dark = not dark
                set_module(x, y, dark, True)
        upward = not upward
        right -= 2

    qr_format = 0x77C4

    def fmt_bit(index: int) -> bool:
        return ((qr_format >> index) & 1) == 1

    for index in range(0, 6):
        set_module(8, index, fmt_bit(index), True)
    set_module(8, 7, fmt_bit(6), True)
    set_module(8, 8, fmt_bit(7), True)
    set_module(7, 8, fmt_bit(8), True)
    for index in range(9, 15):
        set_module(14 - index, 8, fmt_bit(index), True)
    for index in range(8):
        set_module(size - 1 - index, 8, fmt_bit(index), True)
    for index in range(8, 15):
        set_module(8, size - 15 + index, fmt_bit(index), True)

    return modules


def font(size: int, bold: bool = False, handwritten: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if handwritten:
        candidates.extend(["C:/Windows/Fonts/segoepr.ttf", "C:/Windows/Fonts/comic.ttf"])
    candidates.extend(
        [
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf",
        ]
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fill: str,
    text_font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    width: int,
    line_gap: int = 8,
) -> int:
    x, y = xy
    wrap_width = max(24, width // 34)
    for line in wrap(text, width=wrap_width):
        draw.text((x, y), line, fill=fill, font=text_font)
        bbox = draw.textbbox((x, y), line, font=text_font)
        y += bbox[3] - bbox[1] + line_gap
    return y


def draw_qr(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, size_px: int) -> None:
    matrix = create_qr_matrix(text)
    quiet = 4
    total_modules = len(matrix) + quiet * 2
    module = size_px // total_modules
    actual_size = module * total_modules
    draw.rectangle((x, y, x + actual_size, y + actual_size), fill="white", outline="#111827", width=3)
    for row_index, row in enumerate(matrix):
        for column_index, dark in enumerate(row):
            if not dark:
                continue
            left = x + (column_index + quiet) * module
            top = y + (row_index + quiet) * module
            draw.rectangle((left, top, left + module - 1, top + module - 1), fill="#111827")


def draw_markers(draw: ImageDraw.ImageDraw, width: int, height: int) -> None:
    margin = 76
    marker = 126
    for x, y in [
        (margin, margin),
        (width - margin - marker, margin),
        (margin, height - margin - marker),
        (width - margin - marker, height - margin - marker),
    ]:
        draw.rectangle((x, y, x + marker, y + marker), fill="#111827")


def draw_answer_box_marker(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    label: str,
    text_font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
) -> None:
    marker_size = 44
    marker_y = max(0, y - 54)
    draw.rectangle((x, marker_y, x + marker_size, marker_y + marker_size), fill="#111827")
    draw.text((x + marker_size + 16, marker_y - 1), label, fill="#111827", font=text_font)


def qr_text_for(template: dict[str, Any]) -> str:
    return f"{STUDENT_ID}|{template['paper_id']}|{template['test_id']}"


def sample_answer_for(template: dict[str, Any], question: dict[str, Any]) -> str:
    sample_answers = template.get("sample_answers") or {}
    if question["question_id"] in sample_answers:
        return str(sample_answers[question["question_id"]])
    answer_key = question.get("answer_key")
    if isinstance(answer_key, dict):
        return ", ".join(f"{key}-{value}" for key, value in answer_key.items())
    return str(answer_key or "")


def render_paper(template: dict[str, Any], filled: bool) -> Image.Image:
    width = int(template["page"]["width"])
    height = int(template["page"]["height"])
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    title_font = font(60, bold=True)
    body_font = font(32)
    label_font = font(30, bold=True)
    small_font = font(25)
    answer_font = font(88, handwritten=True)
    answer_small_font = font(64, handwritten=True)

    draw.rectangle((54, 54, width - 54, height - 54), outline="#111827", width=8)
    draw_markers(draw, width, height)

    title = template.get("title") or "SmartFLN Sample Assessment"
    subtitle = template.get("subtitle") or "QR Structured Answer Paper"
    qr_text = qr_text_for(template)

    draw.text((250, 126), title, fill="#111827", font=title_font)
    draw.text((252, 214), subtitle, fill="#4b5563", font=body_font)
    draw.text((252, 290), f"Student: {STUDENT_ID}", fill="#111827", font=small_font)
    draw.text((252, 335), f"Paper: {template['paper_id']}", fill="#111827", font=small_font)
    draw.text((252, 380), f"Test: {template['test_id']}", fill="#111827", font=small_font)

    draw_qr(draw, qr_text, 1758, 118, 500)
    draw.text((1764, 634), "QR: student | paper | test", fill="#111827", font=small_font)

    for question in template["questions"]:
        roi = question["roi"]
        x = int(roi["x"])
        y = int(roi["y"])
        box_w = int(roi["width"])
        box_h = int(roi["height"])
        marks = question.get("marks", 1)
        prompt = f"{question['label']}. {question['prompt']} ({marks} mark{'s' if marks != 1 else ''})"
        draw_wrapped(draw, (x, y - 88), prompt, "#111827", label_font, box_w)
        draw_answer_box_marker(draw, x, y, question["label"], label_font)

        draw.rectangle((x, y, x + box_w, y + box_h), outline="#111827", width=5)
        for line_y in range(y + 90, y + box_h - 18, 90):
            draw.line((x + 22, line_y, x + box_w - 22, line_y), fill="#d1d5db", width=2)

        if filled:
            answer_text = sample_answer_for(template, question)
            answer_text_font = answer_small_font if len(answer_text) > 8 else answer_font
            draw.text((x + 64, y + 88), answer_text, fill="#111827", font=answer_text_font)

    draw.text(
        (198, height - 190),
        "Generated sample for SmartFLN model pipeline. Print/upload only for development testing.",
        fill="#4b5563",
        font=small_font,
    )
    return image


def load_templates() -> list[dict[str, Any]]:
    templates = []
    for path in sorted(TEMPLATE_DIR.glob("*.json")):
        template = json.loads(path.read_text(encoding="utf-8"))
        if template.get("paper_id") and template.get("questions"):
            templates.append(template)
    return templates


def main() -> None:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for template in load_templates():
        paper_id = template["paper_id"]
        blank_name = f"{paper_id}-blank.png"
        filled_name = f"{paper_id}-filled.png"
        qr_name = f"{paper_id}-qr.txt"
        render_paper(template, filled=False).save(SAMPLES_DIR / blank_name)
        render_paper(template, filled=True).save(SAMPLES_DIR / filled_name)
        qr_text = qr_text_for(template)
        (SAMPLES_DIR / qr_name).write_text(qr_text, encoding="utf-8")
        manifest.append(
            {
                "paper_id": paper_id,
                "test_id": template["test_id"],
                "answer_key_id": template.get("answer_key_id") or f"{template['test_id']}:answer-key",
                "title": template.get("title") or paper_id,
                "blank": f"/samples/{blank_name}",
                "filled": f"/samples/{filled_name}",
                "qr": f"/samples/{qr_name}",
                "qrText": qr_text,
            }
        )
        print(SAMPLES_DIR / blank_name)
        print(SAMPLES_DIR / filled_name)
        print(SAMPLES_DIR / qr_name)

    (SAMPLES_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(SAMPLES_DIR / "manifest.json")


if __name__ == "__main__":
    main()
