"""
Build two new diagnostic papers for the 42 levels missing from
build_class_papers.py (which covers S5.x / S6.x / S7.x).

Outputs:
  frontend/public/worksheets/proposed-levels/class-pre-diagnostic-cognitive.html
      Stages S1 + S2 + S3 (27 levels, pre-numeracy + early class 1)
  frontend/public/worksheets/proposed-levels/class1-diagnostic-extended.html
      Stage S4 (15 levels, Class 1 abstract numbers + operations)

Design follows SPEC_missing_42_levels.md (sahil-approved 2026-08-03).
Same B&W / Times New Roman / .q block aesthetic as build_class_papers.py.
No marks, no cog label (per sahil: only track right/wrong/skip per Q).
All numbers are fixed literals; no Math.random anywhere.

Design rule for THIS file: every question body is a plain triple-quoted
regular string with `{...}` interpolation done by explicit .format() or
by string concatenation of pieces. NO f-strings with `{...}` inside the
body — that path caused the previous version to break under python 3.14.
"""

import json
import re
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEVELS_JSON = HERE / "levels.json"
ICONS_JS    = HERE.parent.parent / "icons.js"
OUT_DIR     = HERE.parent
RESEARCH_MD = HERE.parent.parent.parent.parent.parent / "Research" / "fln_proposed_levels.md"


# ---------- load levels + parse icons ----------

data = json.load(open(LEVELS_JSON, encoding="utf-8"))
LEVELS_BY_CODE = {}
for _stage_key, lv_list in data.items():
    for lv in lv_list:
        LEVELS_BY_CODE[lv["code"]] = lv

# S1-S4 are NOT in levels.json (that file only has S5-S7).
_blocks = re.split(r"^### Level ", RESEARCH_MD.read_text(encoding="utf-8"), flags=re.MULTILINE)
for _block in _blocks[1:]:
    _head, _, _rest = _block.partition("\n")
    _code, _, _title = _head.partition(" \u2014 ")
    _code = _code.strip()
    if _code in LEVELS_BY_CODE:
        continue
    _lo_m = re.search(r"\*\*Learning Outcome:\*\*\s*(.+?)(?=\n\*\*|\n---)", _rest, re.DOTALL)
    _topics_m = re.search(r"\*\*Topics Covered:\*\*\s*(.+?)(?=\n\*\*|\n---)", _rest, re.DOTALL)
    LEVELS_BY_CODE[_code] = {
        "code": _code,
        "title": _title.strip(),
        "learning_outcome": _lo_m.group(1).strip() if _lo_m else "",
        "topics": _topics_m.group(1).strip() if _topics_m else "",
    }


def _parse_icons():
    """Return {name: svg_inner_body_str} from icons.js ICONS = {...} block."""
    text = ICONS_JS.read_text(encoding="utf-8")
    m = re.search(r"const ICONS\s*=\s*\{(.+?)\n\};", text, re.DOTALL)
    block = m.group(1)
    icons = {}
    for em in re.finditer(r"(\w+)\s*:\s*\(\s*\)\s*=>\s*'(.*?)'\s*,?\s*$", block, re.MULTILINE | re.DOTALL):
        icons[em.group(1)] = em.group(2)
    return icons


ICONS = _parse_icons()


# ---------- SVG helpers ----------

def _svg_count(n, box_w=160, box_h=44, dot_r=4):
    """Small cluster of filled dots."""
    parts = ['<rect x="0" y="0" width="' + str(box_w) + '" height="' + str(box_h) + '" fill="none" stroke="#000" stroke-width="1.4"/>']
    if n == 0:
        parts.append('<text x="' + str(box_w/2) + '" y="' + str(box_h/2+5) + '" font-family="Arial" font-size="12" text-anchor="middle" fill="#000">(none)</text>')
    else:
        sp = 9
        per_row = max(1, (box_w - 20 + sp) // sp)
        for i in range(n):
            r, c = divmod(i, per_row)
            cx = 10 + c*sp
            cy = 14 + r*10
            if cy > box_h - 6:
                break
            parts.append('<circle cx="' + str(cx) + '" cy="' + str(cy) + '" r="' + str(dot_r) + '" fill="#000"/>')
    return '<svg viewBox="0 0 ' + str(box_w) + ' ' + str(box_h) + '" width="' + str(box_w) + '" height="' + str(box_h) + '" xmlns="http://www.w3.org/2000/svg">' + "".join(parts) + '</svg>'


def _svg_count_pattern(n, box_w=80, box_h=80, dot_r=5):
    """Larger, structured dot pattern for subitizing."""
    if n == 1:
        coords = [(box_w/2, box_h/2)]
    elif n == 2:
        coords = [(box_w*0.35, box_h/2), (box_w*0.65, box_h/2)]
    elif n == 3:
        coords = [(box_w/2, box_h*0.30), (box_w*0.30, box_h*0.70), (box_w*0.70, box_h*0.70)]
    elif n == 4:
        coords = [(box_w*0.30, box_h*0.30), (box_w*0.70, box_h*0.30),
                  (box_w*0.30, box_h*0.70), (box_w*0.70, box_h*0.70)]
    elif n == 5:
        coords = [(box_w*0.30, box_h*0.30), (box_w*0.70, box_h*0.30),
                  (box_w/2, box_h*0.50),
                  (box_w*0.30, box_h*0.75), (box_w*0.70, box_h*0.75)]
    else:
        coords = []
        for r in range(2):
            for c in range(3):
                coords.append((box_w*(0.25 + c*0.25), box_h*(0.30 + r*0.40)))
    body = "".join('<circle cx="' + str(round(cx,1)) + '" cy="' + str(round(cy,1)) + '" r="' + str(dot_r) + '" fill="#000"/>' for cx, cy in coords)
    return '<svg viewBox="0 0 ' + str(box_w) + ' ' + str(box_h) + '" width="' + str(box_w) + '" height="' + str(box_h) + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>'


def _svg_shape(s, size=56):
    """2D primitive shape."""
    s = s.lower()
    half = size/2
    if s == "circle":
        body = '<circle cx="' + str(half) + '" cy="' + str(half) + '" r="' + str(half-3) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "square":
        body = '<rect x="4" y="4" width="' + str(size-8) + '" height="' + str(size-8) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "rectangle":
        body = '<rect x="4" y="' + str(half-10) + '" width="' + str(size-8) + '" height="20" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "triangle":
        body = '<polygon points="' + str(half) + ',4 ' + str(size-4) + ',' + str(size-4) + ' 4,' + str(size-4) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "oval":
        body = '<ellipse cx="' + str(half) + '" cy="' + str(half) + '" rx="' + str(half-4) + '" ry="' + str(half-2) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "diamond":
        body = '<polygon points="' + str(half) + ',4 ' + str(size-4) + ',' + str(half) + ' ' + str(half) + ',' + str(size-4) + ' 4,' + str(half) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    else:
        body = '<rect x="4" y="4" width="' + str(size-8) + '" height="' + str(size-8) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    return '<svg viewBox="0 0 ' + str(size) + ' ' + str(size) + '" width="' + str(size) + '" height="' + str(size) + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>'


def _svg_icon(name, size=40):
    """Look up an icon from icons.js and render at the given size."""
    body = ICONS.get(name)
    if body is None:
        return '<svg viewBox="0 0 24 24" width="' + str(size) + '" height="' + str(size) + '" xmlns="http://www.w3.org/2000/svg"></svg>'
    return '<svg viewBox="0 0 24 24" width="' + str(size) + '" height="' + str(size) + '" xmlns="http://www.w3.org/2000/svg" class="ic">' + body + '</svg>'


def _svg_stick(length_px, label=""):
    """Horizontal stick/bar for seriation questions."""
    h = 14
    text = ""
    if label:
        text = '<text x="' + str(length_px/2) + '" y="' + str(h+12) + '" font-family="Arial" font-size="10" text-anchor="middle" fill="#000">' + escape(label) + '</text>'
    return '<svg viewBox="0 0 ' + str(length_px) + ' ' + str(h+16) + '" width="' + str(length_px) + '" height="' + str(h+16) + '" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="' + str(length_px-1) + '" height="' + str(h-1) + '" fill="none" stroke="#000" stroke-width="1.4"/>' + text + '</svg>'


def _svg_star(cx, cy, r=8):
    """5-pointed star outline."""
    import math
    pts = []
    for i in range(10):
        ang = -math.pi/2 + i*math.pi/5
        rr = r if i % 2 == 0 else r*0.42
        pts.append(str(round(cx + rr*math.cos(ang),1)) + "," + str(round(cy + rr*math.sin(ang),1)))
    return '<polygon points="' + " ".join(pts) + '" fill="none" stroke="#000" stroke-width="1.4"/>'


def _svg_3d_cube(size=80):
    """Isometric cube outline."""
    s = size
    front = '<rect x="' + str(round(s*0.20,1)) + '" y="' + str(round(s*0.30,1)) + '" width="' + str(round(s*0.45,1)) + '" height="' + str(round(s*0.45,1)) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    back_x = s*0.50
    back_y = s*0.10
    back = '<rect x="' + str(round(back_x,1)) + '" y="' + str(round(back_y,1)) + '" width="' + str(round(s*0.45,1)) + '" height="' + str(round(s*0.45,1)) + '" fill="none" stroke="#000" stroke-width="1.4"/>'
    e1 = (s*0.65, s*0.30, back_x+s*0.45, back_y)
    e2 = (s*0.65, s*0.75, back_x+s*0.45, back_y+s*0.45)
    e3 = (s*0.20, s*0.75, back_x, back_y+s*0.45)
    lines = "".join('<line x1="' + str(round(a,1)) + '" y1="' + str(round(b,1)) + '" x2="' + str(round(c,1)) + '" y2="' + str(round(d,1)) + '" stroke="#000" stroke-width="1.4"/>' for a,b,c,d in [e1,e2,e3])
    return '<svg viewBox="0 0 ' + str(s) + ' ' + str(s) + '" width="' + str(s) + '" height="' + str(s) + '" xmlns="http://www.w3.org/2000/svg">' + front + back + lines + '</svg>'


# ---------- Q-block helpers ----------

def _ans(w=70, h=26):
    h_style = (' height:' + str(h) + 'px;') if h != 26 else ''
    return '<span class="answer-box" style="width:' + str(w) + 'px;' + h_style + '"></span>'


def _q(num, title, body_html):
    return ('<div class="q">'
            '<div class="q-head">'
            '<span class="q-num">' + str(num) + '</span>'
            '<span class="q-title">' + escape(title) + '</span>'
            '</div>'
            '<div class="q-body">' + body_html + '</div>'
            '</div>')


# ---------- per-level question generators ----------

PRE_CLASS_CODES = [
    "S1.1","S1.2","S1.3","S1.4","S1.5","S1.6","S1.7",
    "S2.1","S2.2","S2.3","S2.4","S2.5","S2.6","S2.7","S2.8","S2.9","S2.10",
    "S3.1","S3.2","S3.3","S3.4","S3.5","S3.6","S3.7","S3.8","S3.9","S3.10",
]
S4_CODES = [
    "S4.1","S4.2","S4.3","S4.4","S4.5","S4.6","S4.7","S4.8",
    "S4.9","S4.10","S4.11","S4.12","S4.13","S4.14","S4.15",
]


def _row(items, sep='<span style="display:inline-block;width:18px;"></span>'):
    """Helper: join icon/html fragments with a small horizontal gap."""
    return sep.join(items)


# ----- S1 -----
def q_S1_1(_t):
    return _row([_svg_icon("ball", 36)] * 3) + '<br>' + _row([
        '<span style="display:inline-block;width:60px;border-top:1.5px solid #000;margin:0 18px 0 0;"></span>',
        '<span style="display:inline-block;width:60px;border-top:1.5px solid #000;margin:0 18px 0 0;"></span>',
        '<span style="display:inline-block;width:60px;border-top:1.5px solid #000;margin:0 18px 0 0;"></span>',
        '<span style="display:inline-block;width:60px;border-top:1.5px solid #000;margin:0;"></span>',
    ])


def q_S1_2(_t):
    return ('<div style="display:flex;gap:18px;margin:10px 0;flex-wrap:wrap;align-items:center;">'
            + _row([_svg_icon("apple", 48), _svg_icon("ball", 48), _svg_icon("banana", 48),
                    _svg_icon("car", 48), _svg_icon("mango", 48), _svg_icon("kite", 48)])
            + '</div>')


def q_S1_3(_t):
    return ('<div style="margin:10px 0;font-size:14px;">'
            '<div style="margin:6px 0;">Pair A: ' + _svg_icon("apple", 36) + ' &nbsp; vs &nbsp; ' + _svg_icon("apple", 36)
            + ' &nbsp;&nbsp; ' + _ans(48) + ' Yes &nbsp;&nbsp; ' + _ans(48) + ' No</div>'
            '<div style="margin:6px 0;">Pair B: ' + _svg_icon("ball", 36) + ' &nbsp; vs &nbsp; ' + _svg_icon("kite", 36)
            + ' &nbsp;&nbsp; ' + _ans(48) + ' Yes &nbsp;&nbsp; ' + _ans(48) + ' No</div>'
            '</div>')


def q_S1_4(_t):
    boxes = "".join('<span class="answer-box" style="width:42px;height:34px;font-size:14px;line-height:34px;">' + str(n) + '</span>' for n in range(1, 11))
    return ('<div style="display:flex;gap:8px;margin:14px 0;flex-wrap:wrap;">' + boxes + '</div>'
            '<div style="font-size:11px;font-style:italic;">(10 small boxes; teacher marks each one spoken correctly.)</div>')


def q_S1_5(_t):
    return ('<div style="margin:14px 0;line-height:2.2;">' + _row([_svg_icon("star", 28)] * 3) + '</div>'
            '<div style="margin:10px 0;font-size:22px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:6px;">'
            '<span style="border:1.5px dashed #000;padding:4px 10px;">3</span>'
            '&nbsp;&#8594;&nbsp;'
            + _ans(70, 36) + '</div>')


def q_S1_6(_t):
    left = _svg_shape("circle") + _svg_shape("square") + _svg_shape("triangle") + _svg_shape("rectangle")
    right = _svg_shape("triangle", 40) + _svg_shape("circle", 40) + _svg_shape("rectangle", 40) + _svg_shape("square", 40)
    return ('<div style="display:flex;justify-content:space-around;align-items:center;margin:14px 0;gap:20px;">'
            '<div style="display:flex;flex-direction:column;gap:18px;">' + left + '</div>'
            '<div style="display:flex;flex-direction:column;gap:18px;">' + right + '</div>'
            '</div>')


def q_S1_7(_t):
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;flex-wrap:wrap;">'
            '<div style="text-align:center;">' + _svg_count_pattern(3, 80, 80)
            + '<div style="margin-top:6px;">Answer = ' + _ans(60, 32) + '</div></div>'
            '<div style="text-align:center;">' + _svg_count_pattern(2, 80, 80)
            + '<div style="margin-top:6px;">Answer = ' + _ans(60, 32) + '</div></div>'
            '</div>'
            '<div style="font-size:11px;font-style:italic;margin-top:6px;">(Look quickly &#8212; do not count one by one.)</div>')


# ----- S2 -----
def q_S2_1(_t):
    left = "".join(_svg_icon("apple", 28) for _ in range(4))
    right = "".join(_svg_icon("apple", 28) for _ in range(6))
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;justify-content:center;">'
            '<div style="border:1.5px solid #000;border-radius:8px;padding:10px 14px;">' + left + '</div>'
            '<span style="font-size:18px;font-weight:bold;">vs.</span>'
            '<div style="border:1.5px solid #000;border-radius:8px;padding:10px 14px;">' + right + '</div>'
            '</div>')


def q_S2_2(_t):
    return ('<div style="display:flex;gap:36px;align-items:flex-end;margin:14px 0;flex-wrap:wrap;">'
            '<div style="text-align:center;">' + _svg_stick(120) + '<div style="margin-top:6px;">' + _ans(48, 30) + '</div></div>'
            '<div style="text-align:center;">' + _svg_stick(200) + '<div style="margin-top:6px;">' + _ans(48, 30) + '</div></div>'
            '<div style="text-align:center;">' + _svg_stick(160) + '<div style="margin-top:6px;">' + _ans(48, 30) + '</div></div>'
            '</div>')


def q_S2_3(_t):
    icons_row = "".join(_svg_icon(n, 36) for n in ["cat", "car", "dog", "bus", "bird", "bike"])
    return ('<div style="margin:14px 0;line-height:2.4;">' + icons_row + '</div>'
            '<div style="display:flex;gap:30px;margin-top:14px;">'
            '<div style="flex:1;border:2px solid #000;padding:14px;text-align:center;font-weight:bold;font-size:14px;">Box A &#8212; Animals</div>'
            '<div style="flex:1;border:2px solid #000;padding:14px;text-align:center;font-weight:bold;font-size:14px;">Box B &#8212; Vehicles</div>'
            '</div>')


def q_S2_4(_t):
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;flex-wrap:wrap;">'
            '<div style="text-align:center;">' + _svg_count(2) + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '<div style="text-align:center;">' + _svg_count(5) + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '<div style="text-align:center;">' + _svg_count(4) + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '</div>')


def q_S2_5(_t):
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;flex-wrap:wrap;">'
            '<div style="text-align:center;">' + _svg_count(6, 140, 60) + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '<div style="text-align:center;">' + _svg_count(8, 140, 60) + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '<div style="text-align:center;">' + _svg_count(10, 140, 60) + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '</div>')


def q_S2_6(_t):
    cells = []
    for sh in ["circle", "square", "triangle", "rectangle"]:
        cells.append('<div style="text-align:center;">' + _svg_shape(sh)
                     + '<div style="margin-top:8px;border-bottom:1.5px solid #000;width:90px;height:22px;"></div></div>')
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;flex-wrap:wrap;justify-content:center;">'
            + "".join(cells)
            + '</div>'
            '<div style="font-size:11px;font-style:italic;margin-top:6px;">(Use: circle, square, triangle, rectangle)</div>')


def q_S2_7(_t):
    cells = ""
    for sh in ["\u25b2", "\u25a0", "\u25b2", "\u25a0", "\u25b2", "\u25a0"]:
        cells += ('<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
                  'vertical-align:middle;text-align:center;line-height:30px;">' + sh + '</span> &nbsp;')
    blanks = ('<span style="display:inline-block;width:44px;height:34px;border:2px dashed #000;vertical-align:middle;"></span> &nbsp;'
              ) * 2
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:32px;letter-spacing:14px;'
            'font-weight:bold;line-height:1.6;">' + cells + blanks + '</div>')


def q_S2_8(_t):
    return ('<div style="display:flex;gap:30px;align-items:center;margin:14px 0;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;transform:scale(0.45);transform-origin:center;">' + _svg_icon("elephant", 80) + '</div>'
            '<div style="text-align:center;transform:scale(1.4);transform-origin:center;">' + _svg_icon("rabbit", 50) + '</div>'
            '</div>'
            '<div style="margin-top:10px;">Answer: ' + _ans(140, 30) + '</div>'
            '<div style="font-size:11px;font-style:italic;margin-top:4px;">(Use: big, bigger, biggest)</div>')


def q_S2_9(_t):
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;">' + _svg_count_pattern(4, 100, 100) + '<div style="margin-top:6px;">' + _ans(60, 32) + '</div></div>'
            '<div style="text-align:center;">' + _svg_count_pattern(6, 100, 100) + '<div style="margin-top:6px;">' + _ans(60, 32) + '</div></div>'
            '</div>')


def q_S2_10(_t):
    choices = []
    for sh in ["triangle", "triangle", "square", "rectangle"]:
        lbl = sh
        choices.append('<div style="text-align:center;border:1.5px solid #000;border-radius:6px;padding:6px;">'
                       + _svg_shape(sh, 60) + '<div style="font-size:10px;margin-top:2px;">' + lbl + '</div></div>')
    return ('<div style="display:flex;gap:40px;margin:14px 0;align-items:center;justify-content:center;flex-wrap:wrap;">'
            '<div style="text-align:center;"><div style="font-size:11px;margin-bottom:4px;">Target:</div>' + _svg_shape("square", 70) + '</div>'
            '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:300px;">'
            + "".join(choices) + '</div></div>')


# ----- S3 -----
def q_S3_1(_t):
    bubbles = "".join('<span style="display:inline-block;width:46px;height:46px;border:1.5px solid #000;'
                      'border-radius:50%;line-height:46px;text-align:center;">' + str(n) + '</span> '
                      for n in [3, 7, 9, 5])
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:36px;font-weight:bold;'
            'letter-spacing:30px;text-align:center;">' + bubbles + '</div>')


def q_S3_2(_t):
    return ('<div style="display:grid;grid-template-columns:auto 60px auto;gap:14px 24px;margin:14px 0;'
            'align-items:center;font-size:18px;font-family:Arial,sans-serif;font-weight:bold;">'
            '<div style="text-align:right;">4</div><div></div><div>' + _svg_count(7) + '</div>'
            '<div style="text-align:right;">7</div><div></div><div>' + _svg_count(9) + '</div>'
            '<div style="text-align:right;">9</div><div></div><div>' + _svg_count(4) + '</div>'
            '</div>'
            '<div style="font-size:11px;font-style:italic;">(Draw a line from each number on the left to its group on the right.)</div>')


def q_S3_3(_t):
    apples_a = "".join(_svg_icon("apple", 24) for _ in range(5))
    apples_b = "".join(_svg_icon("apple", 24) for _ in range(3))
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:16px;line-height:2;">'
            '<div style="margin:8px 0;">Group A: ' + apples_a
            + ' <span style="display:inline-block;border:1.5px solid #000;width:34px;height:34px;vertical-align:middle;margin:0 6px;"></span> '
            'Group B: ' + apples_b + '</div></div>')


def q_S3_4(_t):
    return ('<div style="display:flex;gap:36px;align-items:flex-end;margin:14px 0;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;">' + _svg_stick(100) + '</div>'
            '<div style="text-align:center;">' + _svg_stick(240) + '</div>'
            '<div style="text-align:center;">' + _svg_stick(160) + '</div>'
            '</div>')


def q_S3_5(_t):
    bubbles = ""
    for label in ["Colour", "Size", "Shape"]:
        bubbles += ('<span style="display:inline-block;width:18px;height:18px;border:1.5px solid #000;'
                    'border-radius:50%;vertical-align:middle;margin-right:6px;"></span> ' + label + ' &nbsp;&nbsp;&nbsp;')
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:18px;line-height:2;">'
            '<div>Row 1: ' + _svg_icon("apple", 32) + ' ' + _svg_icon("ball", 32) + ' '
            + _svg_icon("apple", 32) + ' ' + _svg_icon("ball", 32) + '</div>'
            '<div style="margin-top:10px;font-size:14px;">' + bubbles + '</div>'
            '<div style="font-size:11px;font-style:italic;margin-top:6px;">(All objects are the same size and shape. They differ in one thing only.)</div>'
            '</div>')


def q_S3_6(_t):
    cells = []
    for ic, lbl in [("flower", "seed"), ("tree", "sprout"), ("leaf", "tree"), ("apple", "fruit")]:
        cells.append('<div style="text-align:center;"><div style="width:80px;height:80px;border:1.5px solid #000;'
                     'border-radius:50%;display:flex;align-items:center;justify-content:center;">'
                     + _svg_icon(ic, 50) + '</div><div style="margin-top:6px;">' + _ans(48, 28) + '</div></div>')
    return ('<div style="display:flex;gap:30px;margin:14px 0;flex-wrap:wrap;align-items:center;justify-content:center;">'
            + "".join(cells) + '</div>'
            '<div style="font-size:11px;font-style:italic;margin-top:6px;">(Seed &#8594; Sprout &#8594; Tree &#8594; Fruit)</div>')


def q_S3_7(_t):
    return ('<div style="display:flex;gap:30px;margin:14px 0;align-items:center;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;transform:scale(0.55);transform-origin:center;">' + _svg_icon("cat", 60) + '</div>'
            '<div style="text-align:center;transform:scale(0.85);transform-origin:center;">' + _svg_icon("dog", 60) + '</div>'
            '<div style="text-align:center;transform:scale(1.5);transform-origin:center;">' + _svg_icon("elephant", 60) + '</div>'
            '</div>')


def q_S3_8(_t):
    patA = ('<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9679;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9675;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9679;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9675;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9679;</span> '
            '<span style="display:inline-block;width:44px;height:34px;border:2px dashed #000;vertical-align:middle;"></span>')
    patB = ('<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9679;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9675;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9651;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9679;</span> '
            '<span style="display:inline-block;width:34px;height:34px;border:1.5px solid #000;border-radius:6px;'
            'vertical-align:middle;text-align:center;line-height:30px;background:#fff;">&#9675;</span> '
            '<span style="display:inline-block;width:44px;height:34px;border:2px dashed #000;vertical-align:middle;"></span>')
    return ('<div style="margin:14px 0;font-size:24px;font-family:Arial,sans-serif;line-height:2;">'
            '<div><b>Pattern A</b> (2-item): ' + patA + '</div>'
            '<div style="margin-top:10px;"><b>Pattern B</b> (3-item): ' + patB + '</div>'
            '</div>'
            '<div style="font-size:11px;font-style:italic;margin-top:6px;">'
            'Fill the dashed box with: &#9679; (solid circle), &#9675; (empty circle), or &#9651; (triangle)</div>')


def q_S3_9(_t):
    return ('<div style="display:flex;gap:40px;margin:14px 0;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;">'
            '<svg viewBox="0 0 80 80" width="100" height="100" xmlns="http://www.w3.org/2000/svg">'
            '<polygon points="40,8 76,72 4,72" fill="none" stroke="#000" stroke-width="1.6"/>'
            '<circle cx="40" cy="8" r="3.5" fill="#000"/>'
            '<circle cx="76" cy="72" r="3.5" fill="#000"/>'
            '<circle cx="4" cy="72" r="3.5" fill="#000"/>'
            '</svg>'
            '<div style="margin-top:6px;font-size:13px;">Sides = ' + _ans(48, 28)
            + ' &nbsp;&nbsp; Corners = ' + _ans(48, 28) + '</div>'
            '</div></div>')


def q_S3_10(_t):
    choices = []
    for sh in ["triangle", "circle", "square", "rectangle"]:
        choices.append('<div style="text-align:center;border:1.5px solid #000;border-radius:6px;padding:6px;">'
                       + _svg_shape(sh, 60) + '<div style="font-size:10px;margin-top:2px;">' + sh + '</div></div>')
    return ('<div style="display:flex;gap:40px;margin:14px 0;flex-wrap:wrap;justify-content:center;align-items:center;">'
            '<div style="text-align:center;"><div style="font-size:11px;margin-bottom:4px;">House:</div>'
            '<svg viewBox="0 0 100 100" width="120" height="120" xmlns="http://www.w3.org/2000/svg">'
            '<rect x="20" y="50" width="60" height="45" fill="none" stroke="#000" stroke-width="1.6"/>'
            '<polygon points="10,52 50,12 90,52" fill="none" stroke="#000" stroke-width="1.6"/>'
            '<rect x="42" y="68" width="16" height="27" fill="none" stroke="#000" stroke-width="1.4"/>'
            '</svg></div>'
            '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:300px;">'
            + "".join(choices) + '</div></div>')


# ----- S4 -----
def q_S4_1(_t):
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:24px;font-weight:bold;letter-spacing:10px;">'
            '7 <span style="display:inline-block;width:38px;height:34px;border:1.5px solid #000;vertical-align:middle;"></span> 3<br>'
            '4 <span style="display:inline-block;width:38px;height:34px;border:1.5px solid #000;vertical-align:middle;"></span> 8'
            '</div>')


def q_S4_2(_t):
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:24px;font-weight:bold;letter-spacing:10px;">'
            '8 <span style="display:inline-block;width:38px;height:34px;border:1.5px solid #000;vertical-align:middle;"></span> 9<br>'
            '6 <span style="display:inline-block;width:38px;height:34px;border:1.5px solid #000;vertical-align:middle;"></span> 4'
            '</div>')


def q_S4_3(_t):
    stars_a = "".join('<g transform="translate(' + str(10 + (i%5)*26) + ',' + str(15 + (i//5)*26) + ')">'
                      + _svg_star(0, 0, 8) + '</g>' for i in range(13))
    stars_b = "".join('<g transform="translate(' + str(10 + (i%5)*26) + ',' + str(15 + (i//5)*26) + ')">'
                      + _svg_star(0, 0, 8) + '</g>' for i in range(17))
    return ('<div style="display:flex;gap:36px;margin:14px 0;align-items:center;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;"><div style="margin-bottom:6px;">Stars (10+3):</div>'
            '<svg viewBox="0 0 130 90" width="160" height="110" xmlns="http://www.w3.org/2000/svg">' + stars_a + '</svg>'
            '<div style="margin-top:6px;">' + _ans(60, 32) + '</div></div>'
            '<div style="text-align:center;"><div style="margin-bottom:6px;">Stars (10+7):</div>'
            '<svg viewBox="0 0 180 90" width="200" height="110" xmlns="http://www.w3.org/2000/svg">' + stars_b + '</svg>'
            '<div style="margin-top:6px;">' + _ans(60, 32) + '</div></div>'
            '</div>')


def q_S4_4(_t):
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:16px;line-height:2.2;">'
            '<div>twenty-three: ' + _ans(80, 30) + '</div>'
            '<div>forty-seven: ' + _ans(80, 30) + '</div>'
            '<div>fifty-eight: ' + _ans(80, 30) + '</div>'
            '<div>ninety-one: ' + _ans(80, 30) + '</div>'
            '</div>')


def q_S4_5(_t):
    digits = ""
    for a, b in [("4", "7"), ("2", "3"), ("5", "8"), ("9", "1")]:
        digits += ('<span style="display:inline-block;width:48px;height:48px;border:2px solid #000;border-radius:50%;'
                   'line-height:48px;text-align:center;margin:0 6px;">' + a + '</span>')
        digits += ('<span style="display:inline-block;width:48px;height:48px;border:2px solid #000;border-radius:50%;'
                   'line-height:48px;text-align:center;margin:0 6px;">' + b + '</span><br>')
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:32px;font-weight:bold;'
            'letter-spacing:14px;line-height:2.2;">' + digits + '</div>')


def q_S4_6(_t):
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:6px;line-height:2.2;">'
            '3 + 4 = ' + _ans(70, 32) + '<br>'
            '5 + 2 = ' + _ans(70, 32) + '<br>'
            '2 + 6 = ' + _ans(70, 32) + '<br>'
            '4 + 5 = ' + _ans(70, 32)
            + '</div>')


def q_S4_7(_t):
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:6px;line-height:2.2;">'
            '7 &#8722; 3 = ' + _ans(70, 32) + '<br>'
            '5 &#8722; 5 = ' + _ans(70, 32) + '<br>'
            '9 &#8722; 4 = ' + _ans(70, 32) + '<br>'
            '8 &#8722; 6 = ' + _ans(70, 32)
            + '</div>')


def q_S4_8(_t):
    return ('<div style="display:flex;gap:30px;margin:14px 0;flex-wrap:wrap;justify-content:center;align-items:center;">'
            '<div style="text-align:center;">' + _svg_3d_cube(120) + '<div style="font-size:11px;margin-top:6px;">(a cube)</div></div>'
            '<div style="line-height:2.2;font-size:14px;">'
            'Name: ' + _ans(110, 30) + '<br>'
            'Faces: ' + _ans(70, 30) + '<br>'
            'Edges: ' + _ans(70, 30)
            + '</div></div>')


def q_S4_9(_t):
    return ('<div style="display:flex;gap:30px;align-items:center;margin:14px 0;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;">'
            '<svg viewBox="0 0 240 30" width="280" height="36" xmlns="http://www.w3.org/2000/svg">'
            '<rect x="2" y="10" width="220" height="10" fill="none" stroke="#000" stroke-width="1.4"/>'
            '<polygon points="222,8 236,15 222,22" fill="none" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>'
            '<rect x="0" y="8" width="6" height="14" fill="#000"/>'
            '</svg>'
            '<div style="font-size:11px;margin-top:4px;">a pencil</div></div>'
            '<div style="text-align:center;">' + _svg_icon("paperclip", 40)
            + '<div style="font-size:11px;margin-top:4px;">1 paper clip</div></div>'
            '<div style="text-align:center;font-size:18px;">&#8776; ' + _ans(70, 34) + ' paper clips</div>'
            '</div>')


def q_S4_10(_t):
    return ('<div style="display:flex;gap:40px;align-items:flex-end;margin:14px 0;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;">' + _svg_icon("bucket", 100)
            + '<div style="font-size:11px;margin-top:4px;">a jug</div></div>'
            '<div style="text-align:center;">' + _svg_icon("cup", 60)
            + '<div style="font-size:11px;margin-top:4px;">1 cup</div></div>'
            '<div style="text-align:center;font-size:18px;">&#8776; ' + _ans(70, 34) + ' cups</div>'
            '</div>')


def q_S4_11(_t):
    return ('<div style="margin:14px 0;font-family:Arial,sans-serif;font-size:24px;letter-spacing:14px;line-height:1.8;">'
            + _svg_shape("diamond", 40) + ' '
            + _svg_shape("circle", 40) + ' '
            + _svg_shape("triangle", 40) + ' '
            + _svg_shape("diamond", 40) + ' '
            + _svg_shape("circle", 40) + ' '
            + _svg_shape("triangle", 40) + ' '
            + _svg_shape("diamond", 40) + ' '
            + _ans(80, 34)
            + '</div>')


def q_S4_12(_t):
    apples = "".join(_svg_icon("apple", 30) for _ in range(3))
    return ('<div style="display:flex;gap:24px;margin:14px 0;flex-wrap:wrap;justify-content:center;">'
            '<div style="text-align:center;border:1.5px solid #000;padding:10px 16px;border-radius:8px;">'
            + apples + '<div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '<div style="text-align:center;border:1.5px solid #000;padding:10px 16px;border-radius:8px;'
            'min-width:90px;min-height:50px;display:flex;align-items:center;justify-content:center;">'
            '<i>(empty)</i><div style="margin-top:6px;">' + _ans(54, 30) + '</div></div>'
            '</div>')


def q_S4_13(_t):
    animals = ""
    for n, label in [("cat", "cat"), ("dog", "dog"), ("bird", "bird"), ("fish", "fish"), ("cow", "cow")]:
        animals += ('<div style="text-align:center;">' + _svg_icon(n, 50)
                    + '<div style="font-size:11px;margin-top:4px;">' + label + '</div></div>')
    return ('<div style="display:flex;gap:18px;margin:14px 0;flex-wrap:wrap;justify-content:center;align-items:center;">'
            + animals + '</div>'
            '<div style="margin-top:14px;font-size:14px;">Answer: ' + _ans(140, 30) + '</div>')


def q_S4_14(_t):
    ticks = ""
    for i in range(0, 21):
        label = str(i) if i % 5 == 0 else ""
        ticks += ('<div class="tick" style="position:absolute;left:' + str(i*5)
                  + '%;top:-7px;width:1.5px;height:14px;background:#000;"></div>'
                  '<div class="label" style="position:absolute;left:' + str(i*5)
                  + '%;top:14px;transform:translateX(-50%);font-size:11px;font-weight:bold;'
                  'font-family:Arial,sans-serif;">' + label + '</div>')
    return ('<div class="numberline-wrap">'
            '<div class="numberline" style="width:100%;height:28px;border-top:1.5px solid #000;position:relative;margin-top:18px;">'
            + ticks + '</div></div>'
            '<div style="font-size:11px;font-style:italic;margin-top:6px;">'
            '(Marks are at every number 0&#8211;20. Labels are at 0, 5, 10, 15, 20.)</div>')


def q_S4_15(_t):
    return ('<div style="text-align:center;margin:14px 0;">'
            '<svg viewBox="0 0 160 90" width="200" height="110" xmlns="http://www.w3.org/2000/svg">'
            '<rect x="2" y="2" width="156" height="86" fill="none" stroke="#000" stroke-width="1.6"/>'
            '<line x1="2" y1="2" x2="158" y2="88" stroke="#000" stroke-width="1.4" stroke-dasharray="4 3"/>'
            '</svg>'
            '<div style="margin-top:10px;font-size:14px;">Answer: ' + _ans(70, 30) + '</div>'
            '</div>')


# ---------- dispatcher ----------

PRE_Q = {
    "S1.1": q_S1_1, "S1.2": q_S1_2, "S1.3": q_S1_3, "S1.4": q_S1_4, "S1.5": q_S1_5,
    "S1.6": q_S1_6, "S1.7": q_S1_7,
    "S2.1": q_S2_1, "S2.2": q_S2_2, "S2.3": q_S2_3, "S2.4": q_S2_4, "S2.5": q_S2_5,
    "S2.6": q_S2_6, "S2.7": q_S2_7, "S2.8": q_S2_8, "S2.9": q_S2_9, "S2.10": q_S2_10,
    "S3.1": q_S3_1, "S3.2": q_S3_2, "S3.3": q_S3_3, "S3.4": q_S3_4, "S3.5": q_S3_5,
    "S3.6": q_S3_6, "S3.7": q_S3_7, "S3.8": q_S3_8, "S3.9": q_S3_9, "S3.10": q_S3_10,
}
S4_Q = {
    "S4.1": q_S4_1, "S4.2": q_S4_2, "S4.3": q_S4_3, "S4.4": q_S4_4, "S4.5": q_S4_5,
    "S4.6": q_S4_6, "S4.7": q_S4_7, "S4.8": q_S4_8, "S4.9": q_S4_9, "S4.10": q_S4_10,
    "S4.11": q_S4_11, "S4.12": q_S4_12, "S4.13": q_S4_13, "S4.14": q_S4_14, "S4.15": q_S4_15,
}


def q_pre(code):
    title = LEVELS_BY_CODE[code]["title"]
    body_fn = PRE_Q[code]
    body = body_fn(title)
    return (title, "Match the picture or count carefully.<br>" + body)


def q_s4(code):
    title = LEVELS_BY_CODE[code]["title"]
    body_fn = S4_Q[code]
    body = body_fn(title)
    return (title, body)


# ---------- CSS (verbatim from build_class_papers.py) ----------

CSS = r"""
*{box-sizing:border-box;}
body{font-family:"Times New Roman",Times,serif;background:#fff;color:#000;margin:0;padding:0;line-height:1.5;}
.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:16mm 18mm;}
.header{text-align:center;border:2px solid #000;padding:10px 8px;margin-bottom:14px;}
.header .top-line{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;display:flex;justify-content:space-between;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px;}
.header h1{font-size:22px;margin:0;letter-spacing:1px;font-weight:bold;text-transform:uppercase;}
.header .subtitle{font-size:13px;margin-top:4px;font-style:italic;}
.header .meta{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;border-top:1px solid #000;padding-top:6px;}
.student-info{border:1.5px solid #000;padding:8px 12px;margin-bottom:18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;font-size:13px;}
.student-info .field{display:flex;align-items:baseline;gap:6px;}
.student-info .field b{font-weight:bold;}
.student-info .line{flex:1;border-bottom:1.5px solid #000;height:18px;}
.instructions{border:1px solid #000;padding:8px 12px;margin-bottom:18px;font-size:12px;background:#fff;}
.instructions b{text-transform:uppercase;letter-spacing:0.5px;}
.instructions ol{margin:4px 0 0 18px;padding:0;}
.instructions li{margin:2px 0;}
.q{margin:0 0 13px 0;padding:0;page-break-inside:avoid;}
.q-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;}
.q-num{border:1.5px solid #000;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;flex-shrink:0;font-family:Arial,sans-serif;}
.q-title{font-weight:bold;font-size:14px;flex:1;padding-top:4px;}
.q-body{margin-left:38px;font-size:13.5px;}
.objects{font-size:22px;letter-spacing:6px;margin:8px 0;line-height:1.5;}
.boxed{font-size:14px;margin:6px 0;}
.answer-box{display:inline-block;border:1.5px solid #000;min-width:46px;height:26px;vertical-align:middle;margin:0 3px;text-align:center;line-height:26px;}
.numberline-wrap{margin:14px 0 10px 0;position:relative;padding-bottom:30px;}
.numberline{position:relative;height:24px;border-top:1.5px solid #000;}
.numberline .tick{position:absolute;top:-7px;width:1.5px;height:14px;background:#000;}
.numberline .label{position:absolute;top:14px;transform:translateX(-50%);font-size:11px;font-weight:bold;font-family:Arial,sans-serif;}
svg.ic{display:inline-block;vertical-align:middle;}
.pagebreak{page-break-after:always;break-after:page;}
.footer{margin-top:24px;border-top:2px solid #000;padding-top:8px;display:flex;justify-content:space-between;font-size:11px;}
@page{size:A4;margin:0;}
@media print{body{margin:0;}.sheet{padding:14mm 16mm;}.q{page-break-inside:avoid;}}
"""


# ---------- sheet assembly ----------

def render_paper(title, subtitle, codes, code_to_question, paper_filename):
    questions = []
    n = len(codes)
    for i, code in enumerate(codes, start=1):
        qtitle, body = code_to_question(code)
        questions.append(_q(i, qtitle, body))

    PER_PAGE = 14
    sheets_html = []
    page_starts = list(range(0, n, PER_PAGE))
    for pi, start in enumerate(page_starts):
        chunk = questions[start:start+PER_PAGE]
        sheets_html.append('<div class="sheet">')
        if pi == 0:
            header_html = (
                '<div class="header">'
                '<div class="top-line">'
                '<span>FLN Assessment Programme</span>'
                '<span>' + escape(paper_filename) + '</span>'
                '</div>'
                '<h1>' + escape(title) + '</h1>'
                '<div class="subtitle">' + escape(subtitle) + '</div>'
                '<div class="meta">'
                '<span>Levels: <b>' + codes[0] + '</b> &mdash; <b>' + codes[-1] + '</b> (' + str(n) + ' questions)</span>'
                '<span>Date: ______________</span>'
                '</div>'
                '</div>'
                '<div class="student-info">'
                '<div class="field"><b>Name:</b><span class="line"></span></div>'
                '<div class="field"><b>Class:</b><span class="line"></span></div>'
                '<div class="field"><b>Roll No:</b><span class="line"></span></div>'
                '</div>'
                '<div class="instructions">'
                '<b>Instructions</b>'
                '<ol>'
                '<li>Write your name, class, and roll number in the boxes above.</li>'
                '<li>Answer each question in the space given. Do each one carefully.</li>'
                '<li>If you cannot answer a question, leave it blank and move on.</li>'
                '</ol>'
                '</div>'
            )
            sheets_html.append(header_html)
        for q in chunk:
            sheets_html.append(q)
        footer_html = (
            '<div class="footer">'
            '<span>' + escape(paper_filename) + ' &mdash; page ' + str(pi+1) + ' of ' + str(len(page_starts)) + '</span>'
            '<span>FLN Assessment Programme</span>'
            '</div>'
        )
        sheets_html.append(footer_html)
        sheets_html.append('</div>')
        if pi < len(page_starts) - 1:
            sheets_html.append('<div class="pagebreak"></div>')

    body = "\n".join(sheets_html)
    return ('<!DOCTYPE html>\n'
            '<html lang="en">\n'
            '<head>\n'
            '<meta charset="UTF-8">\n'
            '<title>' + escape(title) + ' &mdash; FLN Assessment</title>\n'
            '<style>' + CSS + '</style>\n'
            '</head>\n'
            '<body>\n'
            + body + '\n'
            '</body>\n'
            '</html>\n')


def main():
    missing = [c for c in PRE_CLASS_CODES + S4_CODES if c not in LEVELS_BY_CODE]
    if missing:
        raise SystemExit("levels not in research: " + str(missing))

    pre_html = render_paper(
        title="Pre-Class Diagnostic Paper",
        subtitle="Stages S1, S2, S3 \u2014 Pre-Numeracy and Numeral Introduction",
        codes=PRE_CLASS_CODES,
        code_to_question=q_pre,
        paper_filename="class-pre-diagnostic-cognitive.html",
    )
    pre_path = OUT_DIR / "class-pre-diagnostic-cognitive.html"
    pre_path.write_text(pre_html, encoding="utf-8")

    s4_html = render_paper(
        title="Class 1 Diagnostic Paper (Extended)",
        subtitle="Stage S4 \u2014 Early Class 1 / Abstract Numbers",
        codes=S4_CODES,
        code_to_question=q_s4,
        paper_filename="class1-diagnostic-extended.html",
    )
    s4_path = OUT_DIR / "class1-diagnostic-extended.html"
    s4_path.write_text(s4_html, encoding="utf-8")

    print("Wrote " + str(pre_path) + " (" + str(len(pre_html)) + " bytes, " + str(len(PRE_CLASS_CODES)) + " questions)")
    print("Wrote " + str(s4_path) + " (" + str(len(s4_html)) + " bytes, " + str(len(S4_CODES)) + " questions)")


if __name__ == "__main__":
    main()