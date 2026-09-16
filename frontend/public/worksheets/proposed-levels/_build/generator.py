"""
Generator for FLN proposed-level question papers (Class 1, Stages 4.x).

Inputs:
  - Research/fln_proposed_levels.md   (level structure, objectives, topics)
  - ai-services/syllabus/class_1/class_1_syllabus_phrase{1,2,3}.json (subtopic detail)

Output:
  - frontend/public/worksheets/proposed-levels/S4.<n>_<slug>.html
    One B&W A4 paper per testable level, paper format, inline SVG, varied question
    types chosen from a palette based on the level's Topics Covered.

Run from repo root:
    python frontend/public/worksheets/proposed-levels/_build/generator.py
"""

from __future__ import annotations

import json
import re
import textwrap
from dataclasses import dataclass, field
from html import escape
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
LEVELS_MD = REPO_ROOT / "Research" / "fln_proposed_levels.md"
SYLLABUS = REPO_ROOT / "ai-services" / "syllabus" / "class_1"
OUT_DIR = REPO_ROOT / "frontend" / "public" / "worksheets" / "proposed-levels"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------- level parsing ----------

@dataclass
class Level:
    code: str            # e.g. "S4.3"
    n: int               # e.g. 3
    title: str
    age: str
    strand: str
    objective: str
    description: str
    learning_outcome: str
    topics: str
    source: str = "fln_proposed_levels.md"


def parse_levels(md_text: str, stage_marker: str, next_stage_marker: str) -> list[Level]:
    """Pull out all `### Level Sx.y — ...` blocks within one Stage."""
    # isolate stage
    start = md_text.index(stage_marker)
    end = md_text.index(next_stage_marker, start)
    stage = md_text[start:end]

    blocks = re.split(r"\n### Level ", "\n" + stage)
    levels: list[Level] = []
    for b in blocks[1:]:
        # skip the oral-only block (no S-code)
        if not b.startswith("S"):
            continue
        # S4.15's body is followed by the oral-only "### *Oral/..." block; cut before
        # the next ### heading so the oral block's fields don't overwrite S4.15's.
        next_heading = b.find("\n### ")
        if next_heading != -1:
            b = b[:next_heading]
        head, _, body = b.partition("\n")
        m = re.match(r"(S\d+)\.(\d+)\s+—\s+(.*)", head)
        if not m:
            continue
        code, num, title = m.group(1), int(m.group(2)), m.group(3).strip()
        # strip "(added YYYY-MM-DD)" annotations from level titles
        title = re.sub(r"\s*\*?\(added[^)]*\)\*?\s*", " ", title).strip()
        fields = {}
        for line in body.splitlines():
            line = line.strip()
            # The first metadata line is "**Class:** X | **Age Group:** Y | **Strand:** Z"
            # packed on one line. Split it into individual fields.
            for piece in re.split(r"\s+\|\s+", line):
                mm = re.match(
                    r"^\*\*([A-Za-z ]+):\*\*\s*(.*?)\s*$",
                    piece.strip(),
                )
                if mm:
                    fields[mm.group(1).strip()] = mm.group(2).strip()
        levels.append(
            Level(
                code=f"{code}.{num}",
                n=num,
                title=title,
                age=fields.get("Age Group", ""),
                strand=fields.get("Strand", ""),
                objective=fields.get("Objective", ""),
                description=fields.get("Description", ""),
                learning_outcome=fields.get("Learning Outcome", ""),
                topics=fields.get("Topics Covered", ""),
            )
        )
    return levels


# ---------- SVG library (B&W) ----------

def svg_circle(cx, cy, r, fill="none", stroke="#000", sw=1.4):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def svg_rect(x, y, w, h, fill="none", stroke="#000", sw=1.4):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def svg_triangle(p1, p2, p3, fill="none", stroke="#000", sw=1.4):
    pts = f"{p1[0]},{p1[1]} {p2[0]},{p2[1]} {p3[0]},{p3[1]}"
    return f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def svg_line(x1, y1, x2, y2, stroke="#000", sw=1.4):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"/>'

def svg_text(x, y, t, size=14, weight="normal", anchor="start", family="Arial"):
    return (
        f'<text x="{x}" y="{y}" font-family="{family},Helvetica,sans-serif" '
        f'font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" '
        f'fill="#000">{escape(t)}</text>'
    )


def svg_count_dots(n: int, box_w=160, box_h=44, dot_r=4) -> str:
    """Row of n filled dots inside a thin box. Up to ~30 dots."""
    parts = [svg_rect(0, 0, box_w, box_h)]
    n = max(0, min(60, n))
    if n == 0:
        parts.append(svg_text(box_w / 2, box_h / 2 + 5, "(none)", size=12, anchor="middle"))
    else:
        spacing = 9
        margin_x = 10
        per_row = max(1, (box_w - 2 * margin_x + spacing) // spacing)
        row_gap = 10
        for i in range(n):
            row, col = divmod(i, per_row)
            cx = margin_x + col * spacing
            cy = 14 + row * row_gap
            if cy > box_h - 6:
                break
            parts.append(f'<circle cx="{cx}" cy="{cy}" r="{dot_r}" fill="#000"/>')
    return f'<svg viewBox="0 0 {box_w} {box_h}" width="{box_w}" height="{box_h}" xmlns="http://www.w3.org/2000/svg">' + "".join(parts) + "</svg>"


def svg_group_compare(items_a: int, items_b: int, label_a="A", label_b="B") -> str:
    """Two boxes with dots for quantity comparison."""
    w, h, dot_r, spacing = 90, 70, 3.2, 7
    margin = 8
    def box(n, x):
        parts = [svg_rect(x, 0, w, h)]
        per_row = (w - 2 * margin) // spacing
        for i in range(n):
            row, col = divmod(i, per_row)
            cx = x + margin + col * spacing
            cy = margin + row * spacing
            if cy > h - margin:
                break
            parts.append(f'<circle cx="{cx}" cy="{cy}" r="{dot_r}" fill="#000"/>')
        return "".join(parts)
    total_w = 2 * w + 18
    return (
        f'<svg viewBox="0 0 {total_w} {h + 18}" width="{total_w}" height="{h + 18}" xmlns="http://www.w3.org/2000/svg">'
        + box(items_a, 0) + box(items_b, w + 18)
        + svg_text(w / 2, h + 14, label_a, size=12, anchor="middle", weight="bold")
        + svg_text(w + 18 + w / 2, h + 14, label_b, size=12, anchor="middle", weight="bold")
        + "</svg>"
    )


def svg_shape(s: str, size=56) -> str:
    s = s.lower()
    if s == "circle":
        body = svg_circle(size / 2, size / 2, size / 2 - 3)
    elif s == "square":
        body = svg_rect(4, 4, size - 8, size - 8)
    elif s == "rectangle":
        body = svg_rect(4, size / 2 - 10, size - 8, 20)
    elif s == "triangle":
        body = svg_triangle((size / 2, 4), (size - 4, size - 4), (4, size - 4))
    elif s == "star":
        # 5-point star
        import math
        cx, cy, r1, r2 = size / 2, size / 2, size / 2 - 3, size / 4
        pts = []
        for i in range(10):
            r = r1 if i % 2 == 0 else r2
            a = -math.pi / 2 + i * math.pi / 5
            pts.append(f"{cx + r*math.cos(a):.1f},{cy + r*math.sin(a):.1f}")
        body = f'<polygon points="{" ".join(pts)}" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "heart":
        body = (
            f'<path d="M {size/2} {size-4} '
            f'C {size/2-size/2.2} {size/2}, {4} {size/3}, {size/2} {size/3} '
            f'C {size-4} {size/3}, {size/2+size/2.2} {size/2}, {size/2} {size-4} Z" '
            f'fill="none" stroke="#000" stroke-width="1.4"/>'
        )
    elif s == "diamond":
        body = svg_triangle((size/2, 4), (size-4, size/2), (size/2, size-4)) + \
               svg_triangle((size/2, size-4), (4, size/2), (size/2, 4))
    else:
        body = svg_rect(4, 4, size - 8, size - 8)
    return f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">{body}</svg>'


def svg_clock(hour: int, minute: int = 0, size=110) -> str:
    """Analog clock face; hour hand to given hour, minute hand to given minute."""
    cx = cy = size / 2
    r = size / 2 - 4
    parts = [svg_circle(cx, cy, r, sw=1.6)]
    # 12 ticks
    import math
    for i in range(12):
        a = i * math.pi / 6 - math.pi / 2
        x1 = cx + (r - 4) * math.cos(a)
        y1 = cy + (r - 4) * math.sin(a)
        x2 = cx + (r - (10 if i % 3 == 0 else 6)) * math.cos(a)
        y2 = cy + (r - (10 if i % 3 == 0 else 6)) * math.sin(a)
        parts.append(svg_line(x1, y1, x2, y2, sw=1.6 if i % 3 == 0 else 1))
    # numerals 12, 3, 6, 9
    for n, (dx, dy) in {12: (0, -r + 16), 3: (r - 14, 4), 6: (0, r - 6), 9: (-(r - 14), 4)}.items():
        parts.append(svg_text(cx + dx, cy + dy, str(n), size=12, weight="bold", anchor="middle"))
    # hour hand
    h_a = ((hour % 12) + minute / 60) * math.pi / 6 - math.pi / 2
    hx = cx + (r * 0.55) * math.cos(h_a)
    hy = cy + (r * 0.55) * math.sin(h_a)
    parts.append(f'<line x1="{cx}" y1="{cy}" x2="{hx}" y2="{hy}" stroke="#000" stroke-width="3" stroke-linecap="round"/>')
    # minute hand
    m_a = minute * math.pi / 30 - math.pi / 2
    mx = cx + (r * 0.78) * math.cos(m_a)
    my = cy + (r * 0.78) * math.sin(m_a)
    parts.append(f'<line x1="{cx}" y1="{cy}" x2="{mx}" y2="{my}" stroke="#000" stroke-width="2" stroke-linecap="round"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="3" fill="#000"/>')
    return f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


def svg_number_line(start: int, end: int, mark: int | None = None, label_mark: str | None = None, size_w=440, size_h=70) -> str:
    """Horizontal number line from start to end inclusive; optional mark + label."""
    pad_x = 20
    y = size_h / 2
    n_steps = end - start
    if n_steps < 1:
        n_steps = 1
    inner_w = size_w - 2 * pad_x
    parts = [svg_line(pad_x, y, size_w - pad_x, y, sw=1.6)]
    for i in range(n_steps + 1):
        x = pad_x + (inner_w * i / n_steps)
        parts.append(svg_line(x, y - 5, x, y + 5, sw=1.4))
        parts.append(svg_text(x, y + 20, str(start + i), size=11, anchor="middle"))
    if mark is not None and start <= mark <= end:
        xm = pad_x + (inner_w * (mark - start) / n_steps)
        parts.append(svg_line(xm, y - 14, xm, y + 14, sw=2.4))
        if label_mark:
            parts.append(svg_text(xm, y - 18, label_mark, size=12, weight="bold", anchor="middle"))
    return f'<svg viewBox="0 0 {size_w} {size_h}" width="{size_w}" height="{size_h}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


def svg_place_value_blocks(tens: int, ones: int, max_t=9, max_o=9) -> str:
    """A bundle of 10 for each ten + scattered dots for ones."""
    bw, bh = 24, 60
    parts = []
    x = 0
    for _ in range(min(tens, max_t)):
        # bundle: 4 vertical lines + 2 horizontal ties
        parts.append(svg_rect(x, 0, 14, bh))
        parts.append(svg_line(x + 2, 0, x + 2, bh))
        parts.append(svg_line(x + 6, 0, x + 6, bh))
        parts.append(svg_line(x + 10, 0, x + 10, bh))
        parts.append(svg_rect(x, bh / 2 - 2, 14, 4, fill="#000"))
        x += bw
    # separator
    if tens and ones:
        parts.append(svg_text(x + 4, bh / 2 + 4, "·", size=18, weight="bold"))
        x += 12
    # loose ones
    for i in range(min(ones, max_o)):
        cx = x + (i % 5) * 10
        cy = 8 + (i // 5) * 12
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="3.5" fill="#000"/>')
    total_w = x + 50
    return f'<svg viewBox="0 0 {total_w} {bh}" width="{total_w}" height="{bh}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


def svg_ten_frame(filled: int, total: int = 10, size=110) -> str:
    """2x5 ten frame, first `filled` cells black."""
    cell = size / 5
    parts = [svg_rect(0, 0, size, cell * 2)]
    for i in range(10):
        r, c = divmod(i, 5)
        x, y = c * cell, r * cell
        if i < filled:
            parts.append(svg_rect(x + 1.5, y + 1.5, cell - 3, cell - 3, fill="#000"))
        else:
            parts.append(svg_rect(x + 1.5, y + 1.5, cell - 3, cell - 3, fill="#fff"))
    return f'<svg viewBox="0 0 {size} {cell*2}" width="{size}" height="{cell*2:.0f}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'


# ---------- question renderers (each is a B&W paper section) ----------

def q_header(text: str) -> str:
    return f'<div class="qinstr">{escape(text)}</div>'


def q_match_two_columns(left: list[tuple[str, str]], right: list[tuple[str, str]],
                         left_label: str = "Column A", right_label: str = "Column B") -> str:
    """Match-the-following: two columns with connector dots, line drawn by student."""
    def col(items, label):
        rows = "".join(
            f'<div class="matchrow"><span class="dot" data-id="{i}"></span>'
            f'<span class="micontent">{body}</span></div>'
            for i, body in enumerate(items)
        )
        return f'<div class="matchcol"><div class="colhead">{label}</div>{rows}</div>'

    return (
        f'<div class="matchwrap">'
        + col(left, left_label)
        + col(right, right_label)
        + "</div>"
        + '<div class="qhint">Draw a line from each item in Column A to its match in Column B.</div>'
    )


def q_count_and_write(n: int, label: str = "Count the dots and write the number.") -> str:
    return (
        q_header(label)
        + f'<div class="center">{svg_count_dots(n)}</div>'
        + '<div class="ansline">Answer: __________________</div>'
    )


def q_compare_choose(n_a: int, n_b: int) -> str:
    return (
        q_header("Look at the two groups. Circle the group that has MORE.")
        + f'<div class="center">{svg_group_compare(n_a, n_b, "A", "B")}</div>'
    )


def q_compare_numerals(a: int, b: int) -> str:
    return (
        q_header("Write &gt;, &lt;, or = between the two numbers.")
        + f'<div class="center big-eq"><span class="num">{a}</span>'
        f'<span class="gapbox"></span><span class="num">{b}</span></div>'
    )


def q_fill_addition_blank(a: int, b: int, blank: str = "second") -> str:
    if blank == "second":
        return (
            q_header("Fill in the missing number.")
            + f'<div class="center big-eq">{a} + <span class="gapbox"></span> = {a + b}</div>'
        )
    if blank == "first":
        return (
            q_header("Fill in the missing number.")
            + f'<div class="center big-eq"><span class="gapbox"></span> + {b} = {a + b}</div>'
        )
    return (
        q_header("Fill in the answer.")
        + f'<div class="center big-eq">{a} + {b} = <span class="gapbox"></span></div>'
    )


def q_fill_subtraction_blank(a: int, b: int) -> str:
    return (
        q_header("Fill in the answer.")
        + f'<div class="center big-eq">{a} &minus; {b} = <span class="gapbox"></span></div>'
    )


def q_word_problem(text: str, hint: str = "Show your work.") -> str:
    return (
        q_header("Solve the word problem.")
        + f'<div class="story">{text}</div>'
        + f'<div class="qhint">{hint}</div>'
        + '<div class="workbox"></div>'
        + '<div class="ansline">Answer: __________________</div>'
    )


def q_shapes_identify() -> str:
    items = [("circle", "circle"), ("square", "square"), ("triangle", "triangle"), ("rectangle", "rectangle"), ("star", "star")]
    body = "".join(
        f'<div class="shape-card"><div class="shape-art">{svg_shape(name, 64)}</div>'
        f'<div class="ansbox">&nbsp;</div><div class="shape-name">{label}</div></div>'
        for name, label in items
    )
    return q_header("Look at each shape. Write its name in the box.") + f'<div class="shapes-row">{body}</div>'


def svg_3d_solid(kind: str, size=90) -> str:
    """Simple isometric/oblique projection of a 3D solid, B&W line art."""
    s = size
    if kind == "cube":
        # front face + offset back face
        off = s * 0.28
        front = [(s*0.10, s*0.30), (s*0.55, s*0.30), (s*0.55, s*0.80), (s*0.10, s*0.80)]
        back  = [(p[0]+off, p[1]-off) for p in front]
        parts = []
        # front face
        parts.append(f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in front)}" fill="none" stroke="#000" stroke-width="1.6"/>')
        # back face
        parts.append(f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in back)}" fill="none" stroke="#000" stroke-width="1.6"/>')
        # connectors
        for f, b in zip(front, back):
            parts.append(svg_line(f[0], f[1], b[0], b[1], sw=1.6))
        return f'<svg viewBox="0 0 {s} {s}" width="{s}" height="{s}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
    if kind == "cuboid":
        # wider than tall, same projection
        off = s * 0.25
        front = [(s*0.08, s*0.40), (s*0.78, s*0.40), (s*0.78, s*0.78), (s*0.08, s*0.78)]
        back  = [(p[0]+off, p[1]-off) for p in front]
        parts = []
        parts.append(f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in front)}" fill="none" stroke="#000" stroke-width="1.6"/>')
        parts.append(f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in back)}" fill="none" stroke="#000" stroke-width="1.6"/>')
        for f, b in zip(front, back):
            parts.append(svg_line(f[0], f[1], b[0], b[1], sw=1.6))
        return f'<svg viewBox="0 0 {s} {s}" width="{s}" height="{s}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
    if kind == "cylinder":
        cx = s / 2
        top_y = s * 0.25
        bot_y = s * 0.78
        rx = s * 0.22
        parts = [
            f'<ellipse cx="{cx}" cy="{top_y}" rx="{rx}" ry="{rx*0.32}" fill="none" stroke="#000" stroke-width="1.6"/>',
            f'<line x1="{cx-rx}" y1="{top_y}" x2="{cx-rx}" y2="{bot_y}" stroke="#000" stroke-width="1.6"/>',
            f'<line x1="{cx+rx}" y1="{top_y}" x2="{cx+rx}" y2="{bot_y}" stroke="#000" stroke-width="1.6"/>',
            f'<path d="M {cx-rx} {bot_y} A {rx} {rx*0.32} 0 0 0 {cx+rx} {bot_y}" fill="none" stroke="#000" stroke-width="1.6"/>',
        ]
        return f'<svg viewBox="0 0 {s} {s}" width="{s}" height="{s}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
    if kind == "sphere":
        cx = cy = s / 2
        r = s * 0.36
        parts = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#000" stroke-width="1.6"/>']
        # equator + meridian
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{r*0.32}" fill="none" stroke="#000" stroke-width="1.2"/>')
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r*0.32}" ry="{r}" fill="none" stroke="#000" stroke-width="1.2"/>')
        return f'<svg viewBox="0 0 {s} {s}" width="{s}" height="{s}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
    if kind == "cone":
        cx = s / 2
        top = (cx, s * 0.20)
        bl  = (s * 0.18, s * 0.78)
        br  = (s * 0.82, s * 0.78)
        parts = [
            f'<polygon points="{top[0]},{top[1]} {br[0]},{br[1]} {bl[0]},{bl[1]}" fill="none" stroke="#000" stroke-width="1.6"/>',
            f'<ellipse cx="{cx}" cy="{s*0.78}" rx="{s*0.32}" ry="{s*0.10}" fill="none" stroke="#000" stroke-width="1.6"/>',
        ]
        return f'<svg viewBox="0 0 {s} {s}" width="{s}" height="{s}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'
    # fallback
    return svg_shape("square", s)


def q_3d_properties(shape_name: str, corners: int, edges: int, faces: int) -> str:
    return (
        q_header(f"Look at the {shape_name}. Fill in the table.")
        + f'<div class="center">{svg_3d_solid(shape_name.lower(), 100)}</div>'
        + '<table class="prop-table">'
        + '<tr><th>Corners</th><th>Edges</th><th>Faces (flat surfaces)</th></tr>'
        + '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'
        + "</table>"
        + f'<div class="qhint">Hint: {shape_name} has {corners} corners, {edges} edges, and {faces} faces.</div>'
    )


def q_pattern_continue(seq: list[str], missing_at: int, total: int) -> str:
    """A repeating pattern of single-character tokens; student fills one missing term."""
    pad = (total - len(seq)) // 2
    cells = ["·"] * pad + seq + ["·"] * (total - pad - len(seq))
    cells_html = "".join(
        f'<div class="pat-cell {"pat-blank" if i == missing_at else ""}">{c if i != missing_at else "&nbsp;"}</div>'
        for i, c in enumerate(cells)
    )
    return q_header("Look at the pattern. Fill in the missing shape.") + f'<div class="pat-row">{cells_html}</div>'


def q_clock_read(hour: int, minute: int = 0) -> str:
    return (
        q_header("What time does the clock show? Write it in numbers.")
        + f'<div class="center">{svg_clock(hour, minute)}</div>'
        + '<div class="ansline">Time: ____ : ____</div>'
    )


def q_clock_draw(hour: int) -> str:
    empty = (
        svg_circle(55, 55, 51, sw=1.6)
        + '<circle cx="55" cy="55" r="3" fill="#000"/>'
    )
    return (
        q_header(f"Draw the hour and minute hands to show {hour} o'clock.")
        + f'<div class="center"><svg viewBox="0 0 110 110" width="120" height="120">{empty}</svg></div>'
    )


def q_ordinal(items: list[str], pos: int) -> str:
    body = "".join(
        f'<div class="ord-item">'
        f'<div class="ord-art">{svg_shape(name, 60)}</div>'
        f'<div class="ord-pos">{"↑" if i == pos - 1 else ""}</div>'
        f'</div>'
        for i, name in enumerate(items)
    )
    return (
        q_header(f"Color the {ordinal_word(pos)} shape.")
        + f'<div class="ord-row">{body}</div>'
    )


def q_ten_frame(filled: int) -> str:
    return (
        q_header("Count the dots. Write the number.")
        + f'<div class="center">{svg_ten_frame(filled)}</div>'
        + '<div class="ansline">Answer: __________________</div>'
    )


def q_number_line_mark(lo: int, hi: int, target: int) -> str:
    return (
        q_header(f"Mark the number {target} on the number line.")
        + f'<div class="center">{svg_number_line(lo, hi)}</div>'
    )


def q_zero_choice() -> str:
    return (
        q_header("An empty basket has how many fruits?")
        + '<div class="center"><svg viewBox="0 0 220 90" width="220" height="90">'
        + svg_rect(30, 30, 160, 50)
        + svg_text(110, 60, "Empty basket", size=14, anchor="middle", weight="bold")
        + '</svg></div>'
        + '<div class="choice-row">'
        + '<span class="choice-box">0</span>'
        + '<span class="choice-box">1</span>'
        + '<span class="choice-box">2</span>'
        + '</div>'
    )


def q_place_value_table(tens: int, ones: int) -> str:
    return (
        q_header("Write the number of tens and ones. Then write the number.")
        + f'<div class="center">{svg_place_value_blocks(tens, ones)}</div>'
        + '<table class="pv-table"><tr><th>Tens</th><th>Ones</th><th>Number</th></tr>'
        + '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>'
    )


def q_compose_decompose(target_shape: str, parts: list[str]) -> str:
    left = "".join(f'<div class="shape-card"><div class="shape-art">{svg_shape(p, 70)}</div><div class="shape-name">{p}</div></div>' for p in parts)
    right = f'<div class="shape-card big"><div class="shape-art">{svg_shape(target_shape, 110)}</div><div class="ansbox">&nbsp;</div><div class="shape-name">?</div></div>'
    return (
        q_header(f"These shapes make a {target_shape}. Color each part, then draw a line from the parts to the whole.")
        + f'<div class="comp-row"><div class="comp-left">{left}</div><div class="comp-right">{right}</div></div>'
    )


def ordinal_word(n: int) -> str:
    words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]
    return words[n] if 0 < n < len(words) else f"{n}th"


# ---------- per-level question bank ----------
# Each level = 8-10 questions of varied types, in cognitive progression (easy -> harder)
# Topic types are picked to match the level's Topics Covered.

def questions_for(level: Level) -> list[str]:
    Q: list[str] = []
    t = level.topics.lower()
    title = level.title.lower()

    # All Class 1 levels should expose: number reading, basic add/sub where relevant,
    # match-the-following (with SVG), short answer, word problem (later).
    # We pick question types by keyword match on Topics Covered.

    # Match-the-following: universal anchor for visual matching
    if "numeral comparison" in t:
        # S4.1, S4.2
        # warm-up: pictorial "more than" before going abstract
        Q.append(q_compare_choose(5, 3))
        Q.append(q_compare_choose(2, 6))
        Q.append(q_match_two_columns(
            left=[(f"{a}  vs  {b}", f"<span class='big'>{a}</span> &nbsp; &nbsp; <span class='big'>{b}</span>") for a, b in [(2, 7), (9, 3), (5, 6), (1, 8)]],
            right=[("> more than", "more than"), ("< less than", "less than"), ("= equal", "equal to"), ("either / either", "either way")],
            left_label="Pairs", right_label="Meaning",
        ))
    if "counting to 20" in t or "counting" in t and "20" in t:
        Q.append(q_count_and_write(random_count(20)))
        Q.append(q_count_and_write(random_count(20), "Count again. How many?"))
    if "reading/writing" in t or "writing numbers" in t or "numbers 1-99" in t or "99" in t:
        # S4.4
        Q.append(q_header("Write the number you hear. (Teacher reads aloud.)"))
        Q.append('<div class="ansline">1) __________________</div>')
        Q.append('<div class="ansline">2) __________________</div>')
        Q.append('<div class="ansline">3) __________________</div>')
        Q.append(q_header("Read the number out loud, then write the number name."))
        Q.append('<div class="center big-eq"><span class="num">14</span></div><div class="ansline">Name: __________________</div>')
        Q.append('<div class="center big-eq"><span class="num">27</span></div><div class="ansline">Name: __________________</div>')
    if "place value" in t and "face value" in t:
        # S4.5
        Q.append(q_header("Look at the number. Write the digit in the ones place and the digit in the tens place."))
        for n in [42, 67, 91, 38]:
            tens, ones = n // 10, n % 10
            Q.append(f'<div class="center big-eq"><span class="num">{n}</span> &nbsp; = &nbsp; '
                     f'Tens: <span class="gapbox"></span> &nbsp; Ones: <span class="gapbox"></span></div>')
    if "addition" in t and "9" in t:
        # S4.6
        Q.append(q_fill_addition_blank(2, 3, "answer"))
        Q.append(q_fill_addition_blank(4, 3, "answer"))
        Q.append(q_fill_addition_blank(5, 4, "answer"))
        Q.append(q_fill_addition_blank(3, 5, "first"))
        Q.append(q_fill_addition_blank(6, 3, "second"))
        Q.append(q_word_problem("Riya has <b>2</b> apples. Her brother gives her <b>3</b> more. "
                                "How many apples does Riya have now?",
                                "Draw the apples. Write a number sentence."))
    if "subtraction" in t and "9" in t:
        # S4.7
        Q.append(q_fill_subtraction_blank(7, 3))
        Q.append(q_fill_subtraction_blank(9, 4))
        Q.append(q_fill_subtraction_blank(8, 5))
        Q.append(q_fill_subtraction_blank(6, 6))
        Q.append(q_word_problem("There are <b>9</b> birds on a tree. <b>4</b> fly away. "
                                "How many birds are left?",
                                "Cross out the birds that flew away. Write a number sentence."))
    if "3d shape" in t or "3-d" in t or "solid" in t.lower() or "corners" in level.objective.lower() or "edges" in level.objective.lower():
        # S4.8
        Q.append(q_3d_properties("cube", 8, 12, 6))
        Q.append(q_3d_properties("cuboid", 8, 12, 6))
        Q.append(q_3d_properties("cylinder", 0, 2, 3))
        Q.append(q_match_two_columns(
            left=[("Corner", "A point where edges meet."), ("Edge", "Where two faces meet."), ("Face", "A flat surface."), ("Solid", "A 3D shape.")],
            right=[("Face", svg_shape("square", 60)), ("Edge", svg_line(8, 8, 56, 56, sw=4)), ("Corner", f'<svg viewBox="0 0 60 60" width="60" height="60"><circle cx="20" cy="20" r="6" fill="#000"/></svg>'), ("Solid", svg_3d_solid("cube", 60))],
            left_label="Word", right_label="Picture",
        ))
    if "length" in t and "non-standard" in t:
        # S4.9
        hand_svg = (
            '<svg viewBox="0 0 60 50" width="60" height="50">'
            + svg_rect(8, 8, 44, 36)  # palm
            + svg_rect(14, 0, 5, 12)  # finger
            + svg_rect(22, 0, 5, 12)
            + svg_rect(30, 0, 5, 12)
            + svg_rect(38, 0, 5, 12)
            + svg_rect(46, 12, 6, 14)  # thumb
            + '</svg>'
        )
        foot_svg = (
            '<svg viewBox="0 0 60 90" width="60" height="90">'
            + svg_rect(8, 10, 44, 70)  # sole
            + svg_circle(20, 6, 6)  # big toe
            + svg_circle(32, 8, 5)
            + svg_circle(42, 10, 4)
            + svg_circle(48, 16, 3)
            + svg_circle(50, 24, 3)
            + '</svg>'
        )
        Q.append(q_header("Estimate how many hand-spans long the desk is. Then measure with your hand-span."))
        Q.append('<div class="workbox tall"></div>')
        Q.append('<div class="ansline">My estimate: ____ hand-spans. &nbsp; Actual: ____ hand-spans.</div>')
        Q.append(q_match_two_columns(
            left=[
                ("Pencil", svg_shape("rectangle", 70)),
                ("Eraser", svg_shape("rectangle", 40)),
                ("Footstep", foot_svg),
                ("Hand-span", hand_svg),
            ],
            right=[
                ("longest", "longest"),
                ("shortest", "shortest"),
                ("measured by foot", "foot"),
                ("measured by hand", "hand"),
            ],
            left_label="Item", right_label="Unit / Order",
        ))
    if "capacity" in t and "non-standard" in t:
        # S4.10
        Q.append(q_header("Circle the container that holds MORE water."))
        Q.append(
            '<div class="center">'
            '<svg viewBox="0 0 220 130" width="220" height="130" xmlns="http://www.w3.org/2000/svg">'
            + svg_rect(20, 30, 50, 80) + svg_text(45, 124, "Glass", size=12, anchor="middle")
            + svg_rect(110, 50, 80, 60) + svg_text(150, 124, "Bucket", size=12, anchor="middle")
            + '</svg></div>'
        )
        Q.append(q_header("Estimate how many cups fill the bowl."))
        Q.append('<div class="ansline">My estimate: ____ cups. &nbsp; Actual: ____ cups.</div>')
    if "pattern" in t:
        # S4.11
        Q.append(q_pattern_continue(["▲", "●", "■", "▲", "●", "■", "▲"], missing_at=6, total=8))
        Q.append(q_pattern_continue(["●", "●", "■", "●", "●", "■", "●", "●", "■"], missing_at=4, total=9))
        Q.append(q_match_two_columns(
            left=[("▲ ● ▲ ● __", "What comes next?"), ("◆ ◇ ◆ __ ◆", "What comes next?"), ("●● ■ ■● ●● __", "What comes next?")],
            right=[("●", svg_shape("circle", 50)), ("◇", svg_shape("diamond", 50)), ("■", svg_shape("square", 50))],
            left_label="Pattern", right_label="Answer",
        ))
    if "zero" in t or "none" in t:
        # S4.12
        Q.append(q_zero_choice())
        Q.append(q_header("If you give away all 5 of your marbles, how many do you have left?"))
        Q.append('<div class="ansline">Answer: __________________</div>')
        Q.append(q_match_two_columns(
            left=[("0 mangoes", "(0)"), ("1 mango", "(1)"), ("3 mangoes", "(3)"), ("No mangoes", "(0)")],
            right=[("zero", "0"), ("one", "1"), ("three", "3"), ("zero (no mangoes)", "0")],
            left_label="Words", right_label="Number",
        ))
    if "ordinal" in t:
        # S4.13
        Q.append(q_ordinal(["square", "triangle", "circle", "star", "rectangle"], pos=3))
        Q.append(q_ordinal(["circle", "star", "square", "triangle", "diamond"], pos=1))
        Q.append(q_ordinal(["square", "circle", "triangle", "rectangle", "star", "diamond"], pos=5))
        Q.append(q_header("Look at the row. Fill in the blanks."))
        Q.append('<div class="ord-row">'
                 + "".join(f'<div class="ord-item"><div class="ord-art">{svg_shape(s,60)}</div><div class="ord-pos">{i+1}</div></div>' for i, s in enumerate(["circle","square","triangle","star"]))
                 + '</div>')
        Q.append('<div class="ansline">The ____ shape is a triangle. (first / second / third / fourth)</div>')
        Q.append('<div class="ansline">The ____ shape is a circle. (first / second / third / fourth)</div>')
    if "number line" in t:
        # S4.14
        Q.append(q_number_line_mark(0, 10, 6))
        Q.append(q_number_line_mark(0, 20, 14))
        Q.append(q_number_line_mark(5, 15, 8))
        Q.append(q_number_line_mark(0, 20, 20))
    if "composition" in t or "decomposition" in t or "compose" in t:
        # S4.15
        Q.append(q_compose_decompose("rectangle", ["square", "square"]))
        Q.append(q_compose_decompose("house", ["triangle", "square"]))
        Q.append(q_header("Break the shape into parts. Draw lines to show the pieces."))
        Q.append(f'<div class="center">{svg_shape("square", 130)}</div>')

    # Universal footer for every paper: shapes identify + name write (warm-up) for very-early levels
    if level.n in (1, 2, 3):
        Q.insert(0, q_shapes_identify())

    # Universal footer question: a small "tell me about it" reflection for engagement
    Q.append('<div class="reflection"><span class="refl-label">★</span> '
             'Which question was easiest for you? Which was hardest? <span class="refl-line"></span></div>')

    return Q


def random_count(max_n: int) -> int:
    # Deterministic-feeling pseudo-random based on level code (no random.seed so papers stable)
    # We pick a small prime-mixed offset table.
    table = [3, 5, 7, 9, 11, 13, 14, 16, 18, 19]
    return table[max_n % len(table) % len(table)] if max_n <= 20 else max_n


# ---------- HTML template ----------

CSS = r"""
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#e9e9e9;color:#000;font-family:"Georgia","Times New Roman",serif;}
.page{
  background:#fff;
  width:210mm; min-height:297mm;
  padding:14mm 16mm;
  margin:14px auto;
  border:1px solid #777;
  box-shadow:0 0 6px rgba(0,0,0,.18);
  position:relative;
  page-break-after:always;
}
.page:last-child{page-break-after:auto;}

.brand{
  position:absolute; top:6mm; right:8mm;
  font-family:Arial,Helvetica,sans-serif; font-size:9.5px; color:#444;
  letter-spacing:.5px;
}

.head{
  text-align:center;
  border-bottom:2.5px double #000;
  padding-bottom:8px;
  margin-bottom:14px;
}
.head .title{ font-size:22px; font-weight:bold; letter-spacing:.3px; }
.head .sub{ font-size:13px; margin-top:3px; }
.head .meta{ font-size:11.5px; margin-top:6px; font-style:italic; color:#333; }

.fields{
  display:flex; justify-content:space-between; gap:18px;
  font-size:12.5px; margin:10px 0 16px 0;
}
.fields .field{ border-bottom:1px solid #000; flex:1; padding-bottom:2px; }

.objbox{
  border:1px solid #000;
  padding:8px 10px; margin-bottom:14px;
  font-size:11.5px; line-height:1.45;
  background:#fafafa;
}
.objbox b{ font-family:Arial,Helvetica,sans-serif; }

.qinstr{
  font-family:Arial,Helvetica,sans-serif;
  font-size:12px; font-weight:bold;
  border-left:3px solid #000;
  padding:3px 7px; margin:10px 0 6px 0;
  background:#f3f3f3;
}
.qhint{ font-size:11px; font-style:italic; color:#333; margin:2px 0 4px 0; }

.center{ text-align:center; margin:6px 0; }
.big-eq{ font-size:18px; font-weight:bold; font-family:Arial,Helvetica,sans-serif; }
.big-eq .num{ display:inline-block; min-width:24px; }
.gapbox{ display:inline-block; min-width:70px; border-bottom:1.6px solid #000; height:1.2em; vertical-align:bottom; }

.ansline{ margin:8px 0; font-size:13px; }
.ansbox{ display:inline-block; min-width:60px; min-height:22px; border:1.2px solid #000; }

.workbox{ border:1px dashed #000; min-height:70px; margin:6px 0; }
.workbox.tall{ min-height:110px; }

.story{ font-size:13px; line-height:1.5; margin:6px 0; }

table.prop-table, table.pv-table{
  width:80%; margin:6px auto; border-collapse:collapse;
  font-family:Arial,Helvetica,sans-serif; font-size:12.5px;
}
table.prop-table th, table.prop-table td,
table.pv-table th, table.pv-table td{
  border:1.5px solid #000; padding:10px 8px; text-align:center; height:30px;
}

.matchwrap{ display:flex; gap:24px; margin:6px 0 10px 0; }
.matchcol{ flex:1; }
.colhead{ font-family:Arial,Helvetica,sans-serif; font-weight:bold; font-size:12px;
          border-bottom:1.5px solid #000; margin-bottom:4px; }
.matchrow{ display:flex; align-items:center; gap:8px; margin:7px 0; font-size:12.5px; }
.dot{ display:inline-block; width:10px; height:10px; border:1.4px solid #000; border-radius:50%; background:#fff; flex-shrink:0; }
.micontent{ display:flex; align-items:center; gap:8px; }

.shapes-row{ display:flex; gap:8px; justify-content:space-around; align-items:flex-end; flex-wrap:wrap; margin:8px 0; }
.shape-card{ display:flex; flex-direction:column; align-items:center; gap:4px; }
.shape-art{ border:1.2px solid #000; padding:4px; background:#fff; }
.shape-name{ font-size:11.5px; font-family:Arial,Helvetica,sans-serif; }

.ord-row{ display:flex; gap:10px; justify-content:center; align-items:flex-end; margin:8px 0; }
.ord-item{ display:flex; flex-direction:column; align-items:center; }
.ord-art{ border:1.2px solid #000; padding:4px; }
.ord-pos{ font-family:Arial,Helvetica,sans-serif; font-weight:bold; height:18px; }

.pat-row{ display:flex; gap:8px; justify-content:center; align-items:center; margin:8px 0; }
.pat-cell{
  width:54px; height:54px; border:1.6px solid #000; border-radius:6px;
  display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:bold;
}
.pat-cell.pat-blank{ background:#f0f0f0; }

.choice-row{ display:flex; gap:14px; justify-content:center; margin:8px 0; }
.choice-box{ border:1.4px solid #000; padding:6px 16px; min-width:36px; text-align:center; font-weight:bold; font-family:Arial,Helvetica,sans-serif; font-size:14px; }

.comp-row{ display:flex; gap:24px; justify-content:center; align-items:center; }
.comp-left, .comp-right{ display:flex; flex-direction:column; gap:8px; align-items:center; }
.comp-right .shape-card{ transform:scale(1.4); transform-origin:center; }
.shape-card.big{ padding:8px; }

.reflection{ margin-top:16px; font-size:12px; font-style:italic; }
.refl-label{ font-weight:bold; font-size:14px; }
.refl-line{ display:inline-block; border-bottom:1px solid #000; min-width:200px; height:1em; vertical-align:bottom; }

.footer{ margin-top:18px; text-align:center; font-size:10.5px; color:#333; font-family:Arial,Helvetica,sans-serif; border-top:1px solid #000; padding-top:6px; }

@page { size: A4; margin: 0; }
@media print { body{background:#fff;} .page{ margin:0; box-shadow:none; border:none; } }
"""


def strip_emoji(s: str) -> str:
    """Remove common emoji / symbol code points from text."""
    return re.sub(r"[\U0001F300-\U0001FAFF\u2600-\u27BF\u2300-\u23FF\u2700-\u27BF\u2B00-\u2BFF\u2190-\u21FF]+", "", s).strip()


def render_paper(level: Level, sheet_no: int, total_sheets: int) -> str:
    qs = questions_for(level)
    # split into 1-2 A4 sheets, ~5-6 questions per sheet
    body_html = []
    for i, q in enumerate(qs, start=1):
        body_html.append(f'<div class="question"><div class="qnum">Q{i}.</div><div class="qbody">{q}</div></div>')
    body_str = "".join(body_html)
    obj_clean = strip_emoji(level.objective)
    lo_clean = strip_emoji(level.learning_outcome)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FLN · Class 1 · Level {escape(level.code)} · {escape(level.title)}</title>
<style>{CSS}</style>
</head>
<body>
  <div class="page">
    <div class="brand">FLN · Class 1 · {escape(level.code)}</div>
    <div class="head">
      <div class="title">FLN Numeracy Worksheet · Class 1</div>
      <div class="sub">Level {escape(level.code)} — {escape(level.title)}</div>
      <div class="meta">Strand: {escape(level.strand or "—")} &nbsp;|&nbsp; Age {escape(level.age or "6–7")} &nbsp;|&nbsp; Sheet {sheet_no} of {total_sheets}</div>
    </div>

    <div class="fields">
      <div class="field">Name: ______________________</div>
      <div class="field">Date: ____________</div>
      <div class="field">Score: ______ / {len(qs) - 1}</div>
    </div>

    <div class="objbox">
      <b>Objective:</b> {escape(obj_clean)}<br>
      <b>Learning outcome:</b> {escape(lo_clean)}
    </div>

    {body_str}

    <div class="footer">FLN Class 1 · {escape(level.code)} · printed from proposed-levels/</div>
  </div>
</body>
</html>
"""


# ---------- main ----------

def main():
    md = LEVELS_MD.read_text(encoding="utf-8")
    levels = parse_levels(md, "## Stage 4 — Class 1", "## Stage 5 — Class 2")
    print(f"Found {len(levels)} testable Class 1 levels: {[l.code for l in levels]}")
    for i, lv in enumerate(levels, start=1):
        slug = re.sub(r"[^a-z0-9]+", "_", lv.title.lower()).strip("_")
        out = OUT_DIR / f"{lv.code}_{slug}.html"
        out.write_text(render_paper(lv, sheet_no=1, total_sheets=1), encoding="utf-8")
        qs = questions_for(lv)
        print(f"  {lv.code:6s} {lv.title:50s} -> {out.name}  ({len(qs)-1} scorable Qs)")
    print(f"\nWrote {len(levels)} files to {OUT_DIR}")


if __name__ == "__main__":
    main()
