"""
Build per-class cognitive-progression diagnostic papers for Classes 2, 3, 4.

For each class:
  - One question per level
  - Levels are sorted by the 12-step cognitive progression:
        Observe -> Recognize -> Recall -> Sequence -> Compare -> Represent
        -> Combine -> Take Away -> Classify -> Relate -> Generalize -> Interpret -> Apply
  - The level -> cognitive-level mapping lives in cog_mapping.json
  - Source: levels.json (parsed from Research/fln_proposed_levels.md)

Output:
  frontend/public/worksheets/proposed-levels/class2-diagnostic-cognitive.html
  frontend/public/worksheets/proposed-levels/class3-diagnostic-cognitive.html
  frontend/public/worksheets/proposed-levels/class4-diagnostic-cognitive.html

Each HTML reuses the B&W / Times New Roman / paper format of the Class 1
cognitive-progression paper (class1-diagnostic-cognitive.html).
"""

import json
import re
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEVELS_JSON = HERE / "levels.json"
COG_JSON    = HERE / "cog_mapping.json"
OUT_DIR     = HERE.parent  # proposed-levels/

# ---------- load ----------
data  = json.load(open(LEVELS_JSON, encoding="utf-8"))
cog   = json.load(open(COG_JSON,    encoding="utf-8"))
COG_ORDER = cog["COG_ORDER"]
MAPPING   = cog["MAPPING"]

# ---------- per-level question generators (one per level) ----------
# Each returns an HTML <div class="q"> block matching the sample/Class 1 style.
# All numbers stay within the class's stated number range; word problems and
# other context reference the level's title and learning outcome.

def _q(num, title, marks, body_html, level_code):
    return (
        f'<div class="q">'
        f'<div class="q-head">'
        f'<span class="q-num">{num}</span>'
        f'<span class="q-title">{escape(title)}</span>'
        f'<span class="q-marks">[{marks} mark{"s" if marks!="1" else ""}]</span>'
        f'</div>'
        f'<div class="q-body">{body_html}</div>'
        f'</div>'
    )

def _ans(w=70, h=26):
    return f'<span class="answer-box" style="width:{w}px;{f"height:{h}px;" if h!=26 else ""}"></span>'

def _objects(s, font="22px", sp="6px"):
    return f'<div class="objects" style="font-size:{font};letter-spacing:{sp};">{s}</div>'

def _mcq(opts):
    items = "".join(
        f'<li><span class="bubble"></span>({chr(65+i)}) {escape(o)}</li>'
        for i, o in enumerate(opts)
    )
    return f'<ul class="mcq-list">{items}</ul>'

def _pattern_row(seq, blank_idx, cell_size=38, font=24, sp=10):
    pad = (8 - len(seq)) // 2
    cells = ["&middot;"] * pad + seq + ["&middot;"] * (8 - pad - len(seq))
    out = "".join(
        f'<div class="pat-cell {"pat-blank" if i==blank_idx else ""}" style="width:{cell_size}px;height:{cell_size}px;font-size:{font}px;">{c if i!=blank_idx else "&nbsp;"}</div>'
        for i, c in enumerate(cells)
    )
    return f'<div class="pat-row">{out}</div>'

def _numberline(start, end, target=None, marks=None, label_step=1):
    n_steps = end - start
    inner_w = 400
    pad = 20
    parts = []
    for i in range(n_steps + 1):
        x = pad + (inner_w * i / max(1, n_steps))
        parts.append(f'<div class="tick" style="left:{x}px;"></div>')
        if (start + i) % label_step == 0 or i in (0, n_steps):
            parts.append(f'<div class="label" style="left:{x}px;">{start + i}</div>')
    return f'<div class="numberline-wrap"><div class="numberline">{"".join(parts)}</div></div>'

def _svg_count(n, box_w=160, box_h=44, dot_r=4):
    parts = [f'<rect x="0" y="0" width="{box_w}" height="{box_h}" fill="none" stroke="#000" stroke-width="1.4"/>']
    if n == 0:
        parts.append(f'<text x="{box_w/2}" y="{box_h/2+5}" font-family="Arial" font-size="12" text-anchor="middle" fill="#000">(none)</text>')
    else:
        sp = 9
        per_row = max(1, (box_w - 20 + sp) // sp)
        for i in range(n):
            r, c = divmod(i, per_row)
            cx = 10 + c*sp
            cy = 14 + r*10
            if cy > box_h - 6: break
            parts.append(f'<circle cx="{cx}" cy="{cy}" r="{dot_r}" fill="#000"/>')
    return f'<svg viewBox="0 0 {box_w} {box_h}" width="{box_w}" height="{box_h}" xmlns="http://www.w3.org/2000/svg">{"".join(parts)}</svg>'

def _svg_shape(s, size=56):
    s = s.lower()
    if s == "circle":
        body = f'<circle cx="{size/2}" cy="{size/2}" r="{size/2-3}" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "square":
        body = f'<rect x="4" y="4" width="{size-8}" height="{size-8}" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "rectangle":
        body = f'<rect x="4" y="{size/2-10}" width="{size-8}" height="20" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "triangle":
        body = f'<polygon points="{size/2},4 {size-4},{size-4} 4,{size-4}" fill="none" stroke="#000" stroke-width="1.4"/>'
    elif s == "oval":
        body = f'<ellipse cx="{size/2}" cy="{size/2}" rx="{size/2-4}" ry="{size/2-2}" fill="none" stroke="#000" stroke-width="1.4"/>'
    else:
        body = f'<rect x="4" y="4" width="{size-8}" height="{size-8}" fill="none" stroke="#000" stroke-width="1.4"/>'
    return f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">{body}</svg>'


# ---------- per-level question bank ----------

def q_for_level(lv):
    """Return (question_title, marks, body_html) for one level."""
    code = lv["code"]
    t    = lv["topics"].lower()
    title = lv["title"]

    # ---- Class 2 ----
    if code == "S5.1":   # Read/write to 999
        return ("Read and Write Numbers", "2", (
            "Write the number <b>two hundred and thirty-four</b> in numerals."
            f'<div class="boxed" style="font-size:20px;margin-top:8px;font-family:Arial,sans-serif;">'
            f'In numerals: {_ans(80)}</div>'
        ))
    if code == "S5.2":   # Place value: tens as groups
        return ("Place Value (Groups of Ten)", "2", (
            'Look at the number <b style="font-size:18px;">53</b>. '
            'How many <b>groups of ten</b> and how many <b>ones</b>?'
            f'<div class="boxed" style="margin-top:8px;font-family:Arial,sans-serif;">'
            f'Tens: {_ans(50)}&nbsp;&nbsp; Ones: {_ans(50)}</div>'
        ))
    if code == "S5.3":   # Flexible decomposition
        return ("Flexible Decomposition", "2", (
            'Show <b>two</b> different ways to make the number 47 using tens and ones. '
            'Example: 47 = 30 + 17.'
            f'<div class="boxed" style="margin-top:8px;">'
            f'Way 1: 47 = {_ans(40)} + {_ans(40)}<br>'
            f'Way 2: 47 = {_ans(40)} + {_ans(40)}</div>'
        ))
    if code == "S5.4":   # Addition with carrying
        return ("Addition (with carrying)", "2", (
            'Add these two 2-digit numbers. Show your regrouping.'
            f'<div class="boxed" style="font-size:20px;margin-top:8px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'&nbsp;{_ans(50,32)}<br>'
            f'&nbsp;{_ans(50,32)}<br>'
            f'+ 4 7<br>'
            f'________<br>'
            f'&nbsp;{_ans(70,32)}</div>'
        ))
    if code == "S5.5":   # Subtraction with borrowing
        return ("Subtraction (with borrowing)", "2", (
            'Subtract. Regroup when you need to.'
            f'<div class="boxed" style="font-size:20px;margin-top:8px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'&nbsp;{_ans(50,32)}<br>'
            f'&nbsp;{_ans(50,32)}<br>'
            f'- 1 8<br>'
            f'________<br>'
            f'&nbsp;{_ans(70,32)}</div>'
        ))
    if code == "S5.6":   # Multiplication as repeated addition
        return ("Multiplication as Repeated Addition", "2", (
            'Write this multiplication as repeated addition, then find the answer.'
            f'<div class="boxed" style="font-size:18px;margin-top:8px;font-family:Arial,sans-serif;">'
            f'4 × 3 = {_ans(40)} + {_ans(40)} + {_ans(40)} = {_ans(50)}</div>'
        ))
    if code == "S5.7":   # Division as equal sharing
        return ("Division as Equal Sharing", "2", (
            'Share <b>12 apples</b> equally among <b>3 children</b>. '
            'How many apples does each child get?'
            f'<div class="boxed" style="margin-top:8px;">'
            f'12 ÷ 3 = {_ans(60)}<br>Each child gets {_ans(40)} apples.</div>'
        ))
    if code == "S5.8":   # Multiplication tables 2/3/4
        return ("Multiplication Tables (2, 3, 4)", "1", (
            'Fill in the missing number.'
            f'<div class="boxed" style="font-size:18px;margin-top:8px;font-family:Arial,sans-serif;">'
            f'3 × {_ans(50)} = 12</div>'
        ))
    if code == "S5.9":   # Currency recognition
        return ("Currency Recognition", "1", (
            'Which of these is a <b>₹10</b> coin?'
            + _mcq(["A round coin with the number 10", "A round coin with the number 5", "A note with the number 10", "A note with the number 20"])
        ))
    if code == "S5.10":  # Fractions via folding (half/quarter)
        return ("Halves and Quarters (Folding)", "2", (
            'A roti is folded into <b>2 equal parts</b>. What is each part called?'
            f'<div class="boxed" style="margin-top:8px;">Each part is a <b>{_ans(80)}</b>.</div>'
            f'<div style="margin-top:6px;font-style:italic;font-size:11px;">Hint: if folded into 4 equal parts, each part is a <b>quarter</b>.</div>'
        ))
    if code == "S5.11":  # Length/capacity, uniform non-standard units
        return ("Length (Uniform Non-Standard Unit)", "2", (
            'Measure the line below using <b>paper clips</b> as your unit. '
            'Count how many paper clips fit end to end.'
            f'<div style="margin:8px 0;"><svg viewBox="0 0 200 30" width="200" height="30" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="15" x2="196" y2="15" stroke="#000" stroke-width="1.6"/><line x1="4" y1="9" x2="4" y2="21" stroke="#000" stroke-width="1.6"/><line x1="196" y1="9" x2="196" y2="21" stroke="#000" stroke-width="1.6"/></svg></div>'
            f'<div class="boxed">Length = {_ans(50)} paper clips.</div>'
        ))
    if code == "S5.12":  # 2D shape identification (named set)
        return ("Identify 2D Shapes", "2", (
            'Look at the shape on the left. Tick the correct name.'
            f'<div style="margin:10px 0;display:flex;gap:18px;align-items:center;">'
            f'<div>{_svg_shape("oval", 60)}</div>'
            f'<div style="font-size:14px;">Name: <b>______</b></div></div>'
            + _mcq(["Circle", "Square", "Triangle", "Oval"])
        ))
    if code == "S5.13":  # Spatial vocabulary
        return ("Spatial Vocabulary", "1", (
            'Look at the picture: a ball is <b>under</b> the table, a cat is <b>on</b> the table, '
            'a book is <b>between</b> the ball and the cat. '
            'Fill in the blanks using <b>under / on / between</b>.'
            f'<div class="boxed" style="margin-top:6px;">'
            f'The ball is _____ the table. ({_ans(80)})<br>'
            f'The book is _____ the ball and the cat. ({_ans(80)})</div>'
        ))
    if code == "S5.14":  # Calendar
        return ("Calendar (Days and Months)", "2", (
            'How many days are in <b>one week</b>? How many months are in <b>one year</b>?'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Week = {_ans(50)} days. &nbsp; Year = {_ans(50)} months.</div>'
        ))
    if code == "S5.15":  # Sort by category
        return ("Sort by Category", "2", (
            'Look at the objects: ★, ●, ◆, ★, ●, ★, ◆, ●. '
            'How many of each shape are there?'
            f'<div class="boxed" style="margin-top:6px;font-family:Arial,sans-serif;">'
            f'Stars (★) = {_ans(40)}<br>'
            f'Circles (●) = {_ans(40)}<br>'
            f'Diamonds (◆) = {_ans(40)}</div>'
        ))
    if code == "S5.16":  # Number-sequence patterns
        return ("Number Pattern", "2", (
            'What is the rule? Continue the sequence.'
            f'<div class="boxed" style="font-size:18px;margin-top:6px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'2, 4, 6, 8, {_ans(50)}, {_ans(50)}</div>'
            f'<div style="font-size:11px;font-style:italic;margin-top:4px;">Rule: add <b>2</b> each time.</div>'
        ))
    if code == "S5.17":  # Zero as place-value placeholder
        return ("Zero as Placeholder", "1", (
            'Why do we write <b>40</b> for "forty" instead of just <b>4</b>?'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Because the 0 shows there are <b>{_ans(60)}</b> tens and <b>{_ans(60)}</b> ones.</div>'
        ))
    if code == "S5.18":  # Number line 0-100
        return ("Number Line (0–100)", "2", (
            'Mark the position of <b>35</b> on the number line below (×).'
            + _numberline(0, 100, target=35, label_step=10)
        ))
    if code == "S5.19":  # Skip counting by 2s/5s
        return ("Skip Counting by 5s", "1", (
            'Continue the skip-counting sequence.'
            f'<div class="boxed" style="font-size:18px;margin-top:6px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'5, 10, 15, 20, {_ans(50)}, {_ans(50)}</div>'
        ))

    # ---- Class 3 ----
    if code == "S6.1":   # 3-digit place value
        return ("3-Digit Place Value", "2", (
            'Look at <b style="font-size:18px;">347</b>. Write the value of each digit.'
            f'<div class="boxed" style="margin-top:6px;font-family:Arial,sans-serif;">'
            f'Hundreds digit: {_ans(50)}<br>'
            f'Tens digit: {_ans(50)}<br>'
            f'Ones digit: {_ans(50)}</div>'
        ))
    if code == "S6.2":   # Flexible 3-digit decomposition
        return ("Flexible 3-Digit Decomposition", "2", (
            'Show <b>two</b> different ways to make 325 using hundreds, tens, and ones.'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Way 1: 325 = {_ans(40)} + {_ans(40)} + {_ans(40)}<br>'
            f'Way 2: 325 = {_ans(40)} + {_ans(40)} + {_ans(40)}</div>'
        ))
    if code == "S6.3":   # Compare/order 3-digit
        return ("Compare 3-Digit Numbers", "1", (
            'Write <b>&gt;</b>, <b>&lt;</b>, or <b>=</b> between the numbers.'
            f'<div class="boxed" style="font-size:24px;margin-top:6px;font-family:Arial,sans-serif;text-align:center;letter-spacing:8px;">'
            f'472 &nbsp;{_ans(50,32)}&nbsp; 427</div>'
        ))
    if code == "S6.4":   # Read/write to 9999
        return ("Read and Write (up to 9999)", "2", (
            'Write the number <b>two thousand, four hundred and twelve</b> in numerals.'
            f'<div class="boxed" style="font-size:20px;margin-top:8px;font-family:Arial,sans-serif;">'
            f'In numerals: {_ans(90)}</div>'
        ))
    if code == "S6.5":   # 3-digit add/sub word problems
        return ("Word Problem (Add/Sub)", "3", (
            '<div class="wordbox">'
            'A shop had <b>485 apples</b> in the morning. By evening, <b>127</b> were sold. '
            'How many apples are left?</div>'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Number sentence: {_ans(60)} − {_ans(60)} = {_ans(60)}<br>'
            f'Answer: {_ans(80)} apples.</div>'
        ))
    if code == "S6.6":   # Multiplication tables 2-10
        return ("Multiplication Tables (2–10)", "1", (
            'Fill in the missing number.'
            f'<div class="boxed" style="font-size:18px;margin-top:6px;font-family:Arial,sans-serif;">'
            f'7 × {_ans(50)} = 56</div>'
        ))
    if code == "S6.7":   # Division facts
        return ("Division Facts", "1", (
            'Fill in the missing number.'
            f'<div class="boxed" style="font-size:18px;margin-top:6px;font-family:Arial,sans-serif;">'
            f'48 ÷ 6 = {_ans(50)}</div>'
        ))
    if code == "S6.8":   # Standard units
        return ("Standard Units", "1", (
            'Which unit is best to measure the length of a <b>pencil</b>?'
            + _mcq(["Kilometre (km)", "Metre (m)", "Centimetre (cm)", "Millimetre (mm)"])
        ))
    if code == "S6.9":   # 2D <-> 3D shapes
        return ("2D and 3D Shapes", "1", (
            'A <b>cube</b> has 6 flat surfaces. What shape is each surface?'
            + _mcq(["Circle", "Square", "Triangle", "Oval"])
        ))
    if code == "S6.10":  # Clock hours/half-hours
        return ("Clock Reading (Hour / Half-Hour)", "2", (
            'What time does this clock show? Write it in numbers.'
            '<div style="text-align:center;margin:8px 0;">'
            '<svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">'
            '<circle cx="60" cy="60" r="56" fill="none" stroke="#000" stroke-width="1.6"/>'
            '<line x1="60" y1="60" x2="60" y2="20" stroke="#000" stroke-width="3" stroke-linecap="round"/>'
            '<line x1="60" y1="60" x2="92" y2="60" stroke="#000" stroke-width="2" stroke-linecap="round"/>'
            '<circle cx="60" cy="60" r="3" fill="#000"/>'
            '<text x="60" y="14" font-family="Arial" font-size="11" text-anchor="middle">12</text>'
            '<text x="110" y="64" font-family="Arial" font-size="11" text-anchor="middle">3</text>'
            '<text x="60" y="116" font-family="Arial" font-size="11" text-anchor="middle">6</text>'
            '<text x="10" y="64" font-family="Arial" font-size="11" text-anchor="middle">9</text>'
            '</svg></div>'
            f'<div class="boxed">Time = {_ans(40)} : {_ans(40)}</div>'
        ))
    if code == "S6.11":  # Money arithmetic
        return ("Money Arithmetic", "2", (
            'Riya has <b>₹85</b>. Her mother gives her <b>₹40</b> more. How much does Riya have now?'
            f'<div class="boxed" style="margin-top:6px;">'
            f'₹{_ans(60)} + ₹{_ans(60)} = ₹{_ans(60)}<br>'
            f'Riya has ₹{_ans(80)} now.</div>'
        ))
    if code == "S6.12":  # Fractions of whole / of collection
        return ("Fractions of a Collection", "2", (
            'There are <b>12 marbles</b> in a bag. <b>One-fourth</b> of them are red. '
            'How many red marbles?'
            f'<div class="boxed" style="margin-top:6px;">'
            f'12 ÷ 4 = {_ans(60)} red marbles.</div>'
        ))
    if code == "S6.13":  # Pattern rule + skip-counting by 10
        return ("Pattern Rule", "2", (
            'What is the rule? Continue the sequence.'
            f'<div class="boxed" style="font-size:18px;margin-top:6px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'15, 25, 35, 45, {_ans(50)}, {_ans(50)}</div>'
            f'<div class="boxed" style="margin-top:4px;">Rule: add <b>10</b> each time. ({_ans(80)})</div>'
        ))
    if code == "S6.14":  # Tally/pictograph/bar graph
        return ("Read a Bar Graph", "2", (
            'A bar graph shows: Apples = 5, Bananas = 8, Cherries = 3, Dates = 6. '
            'Which fruit was sold the <b>most</b>?'
            f'<div class="boxed" style="margin-top:6px;">Most sold: {_ans(80)}</div>'
            f'<div style="font-size:11px;font-style:italic;margin-top:4px;">How many bananas? {_ans(60)}</div>'
        ))

    # ---- Class 4 ----
    if code == "S7.1":   # Place value thousands
        return ("Place Value (Thousands)", "2", (
            'In the number <b style="font-size:18px;">4 3 7 2</b>, what digit is in the <b>thousands</b> place?'
            f'<div class="boxed" style="margin-top:6px;">Thousands digit = {_ans(50)}</div>'
        ))
    if code == "S7.2":   # Read/write/regroup 4-digit
        return ("Read and Write (4-digit)", "2", (
            'Regroup <b>3 thousands 14 tens 6 ones</b> as a single 4-digit number.'
            f'<div class="boxed" style="font-size:20px;margin-top:6px;font-family:Arial,sans-serif;">'
            f'In numerals: {_ans(90)}</div>'
        ))
    if code == "S7.3":   # Multi-digit word problems
        return ("Word Problem (Multi-Digit)", "3", (
            '<div class="wordbox">'
            'A library has <b>2 4 5 6</b> books. <b>1 1 8 7</b> were borrowed this month. '
            'How many books are still on the shelf?</div>'
            f'<div class="boxed" style="margin-top:6px;">'
            f'{_ans(70)} − {_ans(70)} = {_ans(70)}<br>'
            f'{_ans(80)} books are on the shelf.</div>'
        ))
    if code == "S7.4":   # Multi-digit multiplication
        return ("Multiplication (2-digit × 1-digit)", "3", (
            'Multiply.'
            f'<div class="boxed" style="font-size:20px;margin-top:6px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'&nbsp;&nbsp;{_ans(50,32)}<br>'
            f'×&nbsp;&nbsp;&nbsp;{_ans(40,32)}<br>'
            f'________<br>'
            f'&nbsp;{_ans(70,32)}</div>'
            f'<div style="font-size:11px;font-style:italic;margin-top:4px;">e.g. 23 × 4</div>'
        ))
    if code == "S7.5":   # Formal division
        return ("Division (2-digit ÷ 1-digit)", "3", (
            'Divide and show the remainder if any.'
            f'<div class="boxed" style="font-size:20px;margin-top:6px;font-family:Arial,sans-serif;">'
            f'75 ÷ 4 = {_ans(50)} remainder {_ans(50)}</div>'
        ))
    if code == "S7.6":   # Fractions equivalence
        return ("Equivalent Fractions", "2", (
            'Fill the blank to make the fractions equivalent.'
            f'<div class="boxed" style="font-size:20px;margin-top:6px;font-family:Arial,sans-serif;">'
            f'1 / 2 = {_ans(50)} / 4</div>'
        ))
    if code == "S7.7":   # Unit conversion
        return ("Unit Conversion", "1", (
            'How many centimetres are in <b>1 metre</b>?'
            f'<div class="boxed" style="margin-top:6px;">1 m = {_ans(50)} cm</div>'
        ))
    if code == "S7.8":   # Measurement word problems
        return ("Measurement Word Problem", "3", (
            '<div class="wordbox">'
            'A rope is <b>3 m 40 cm</b> long. <b>1 m 25 cm</b> is cut off. '
            'How much rope is left?</div>'
            f'<div class="boxed" style="margin-top:6px;">'
            f'3 m 40 cm − 1 m 25 cm = {_ans(50)} m {_ans(50)} cm</div>'
        ))
    if code == "S7.9":   # 3D shapes and nets
        return ("Nets of 3D Shapes", "1", (
            'Which flat shape, when folded, makes a <b>cube</b>?'
            + _mcq([
                "A row of 4 squares in a line",
                "A cross-shape of 6 squares (T-shape)",
                "A 2×3 rectangle of 6 squares",
                "All of the above can make a cube",
            ])
        ))
    if code == "S7.10":  # Time intervals / AM/PM
        return ("Time Intervals (AM/PM)", "2", (
            'A movie starts at <b>2:30 PM</b> and ends at <b>4:45 PM</b>. How long is the movie?'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Start: 2:30 PM &nbsp; End: 4:45 PM<br>'
            f'Duration: {_ans(50)} hours {_ans(50)} minutes</div>'
        ))
    if code == "S7.11":  # Complex money word problems
        return ("Money Word Problem (Multi-Step)", "3", (
            '<div class="wordbox">'
            'Sohan has <b>₹500</b>. He buys a book for <b>₹185</b> and a pencil box for <b>₹62</b>. '
            'How much money is left?</div>'
            f'<div class="boxed" style="margin-top:6px;">'
            f'₹{_ans(60)} − ₹{_ans(60)} − ₹{_ans(60)} = ₹{_ans(60)}<br>'
            f'Money left: ₹{_ans(70)}.</div>'
        ))
    if code == "S7.12":  # Number pattern rule
        return ("Number Pattern Rule", "2", (
            'What is the rule? Continue the sequence.'
            f'<div class="boxed" style="font-size:18px;margin-top:6px;font-family:Arial,sans-serif;letter-spacing:4px;">'
            f'3, 6, 12, 24, {_ans(50)}, {_ans(50)}</div>'
            f'<div class="boxed" style="margin-top:4px;">Rule: multiply by <b>{_ans(50)}</b> each time.</div>'
        ))
    if code == "S7.13":  # Bar graphs
        return ("Read and Interpret Bar Graph", "2", (
            'A bar graph shows scores: Maths = 85, Science = 72, English = 90, Hindi = 68. '
            'In which subject did the student score the <b>highest</b>?'
            f'<div class="boxed" style="margin-top:6px;">Highest score: <b>{_ans(80)}</b></div>'
        ))
    if code == "S7.14":  # Factors & multiples
        return ("Factors and Multiples", "2", (
            'List all factors of <b>12</b>. Then write the first three multiples of <b>5</b>.'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Factors of 12: {_ans(120)}<br>'
            f'First 3 multiples of 5: {_ans(120)}</div>'
        ))
    if code == "S7.15":  # Decimals
        return ("Decimals (Tenths)", "2", (
            'Which decimal is the same as <b>3/10</b>?'
            + _mcq(["0.03", "0.3", "3.0", "30.0"])
        ))
    if code == "S7.16":  # Angles
        return ("Angle Types", "1", (
            'A clock showing <b>3:00</b> has what kind of angle between the hands?'
            + _mcq(["Acute", "Right", "Obtuse", "Straight"])
        ))
    if code == "S7.17":  # Symmetry & reflection
        return ("Line of Symmetry", "1", (
            'How many lines of symmetry does a <b>square</b> have?'
            f'<div class="boxed" style="margin-top:6px;font-size:20px;font-family:Arial,sans-serif;">'
            f'A square has <b>{_ans(50)}</b> lines of symmetry.</div>'
        ))
    if code == "S7.18":  # Perimeter & area
        return ("Perimeter and Area", "3", (
            'A rectangle is <b>5 cm</b> long and <b>3 cm</b> wide. Find its <b>perimeter</b> and <b>area</b>.'
            f'<div class="boxed" style="margin-top:6px;">'
            f'Perimeter = {_ans(70)} cm<br>'
            f'Area = {_ans(70)} sq cm</div>'
        ))

    # Fallback
    return (title, "2", f'<div class="boxed">No question body generated for {code}.</div>')


# ---------- sheet assembly ----------

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
.cog-legend{border:1px solid #000;padding:6px 10px;margin-bottom:14px;font-size:11.5px;}
.q{margin:0 0 13px 0;padding:0;page-break-inside:avoid;}
.q-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;}
.q-num{border:1.5px solid #000;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;flex-shrink:0;font-family:Arial,sans-serif;}
.q-title{font-weight:bold;font-size:14px;flex:1;padding-top:4px;}
.q-cog{font-size:10.5px;font-style:italic;color:#222;border:1px solid #000;padding:1px 6px;margin-top:4px;flex-shrink:0;}
.q-marks{font-size:11px;font-style:italic;border:1px solid #000;padding:1px 6px;margin-top:4px;flex-shrink:0;margin-left:6px;}
.q-body{margin-left:38px;font-size:13.5px;}
.objects{font-size:22px;letter-spacing:6px;margin:8px 0;line-height:1.5;}
.boxed{font-size:14px;margin:6px 0;}
.answer-box{display:inline-block;border:1.5px solid #000;min-width:46px;height:26px;vertical-align:middle;margin:0 3px;}
.mcq-list{margin:6px 0 0 0;list-style:none;padding:0;}
.mcq-list li{margin:3px 0;padding-left:24px;text-indent:-24px;}
.mcq-list .bubble{display:inline-block;width:14px;height:14px;border:1.5px solid #000;border-radius:50%;margin-right:8px;vertical-align:middle;}
.numberline-wrap{margin:14px 0 10px 0;position:relative;}
.numberline{position:relative;height:24px;}
.numberline .tick{position:absolute;top:0;width:1.5px;height:14px;background:#000;}
.numberline .label{position:absolute;top:16px;transform:translateX(-50%);font-size:13px;font-weight:bold;font-family:Arial,sans-serif;}
.mark-here{font-size:11px;margin-top:4px;font-style:italic;}
.shape-cell{width:60px;height:60px;display:inline-block;position:relative;}
.compare-groups{display:flex;align-items:center;gap:14px;margin:8px 0;flex-wrap:wrap;}
.compare-group{border:2px solid #000;padding:8px 14px;font-size:22px;letter-spacing:4px;background:#fff;}
.compare-vs{font-size:14px;font-weight:bold;}
.pat-row{display:flex;gap:8px;justify-content:center;align-items:center;margin:8px 0;}
.pat-cell{width:54px;height:54px;border:1.6px solid #000;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:bold;}
.pat-cell.pat-blank{background:#f0f0f0;}
.pattern-row{font-size:24px;letter-spacing:10px;margin:8px 0;font-family:Arial,sans-serif;}
.pattern-blank{display:inline-block;width:38px;height:38px;border:2px solid #000;vertical-align:middle;margin:0 2px;}
.wordbox{border:1.5px solid #000;padding:10px 14px;margin:6px 0;font-size:14px;background:#fff;}
.footer{margin-top:24px;border-top:2px solid #000;padding-top:8px;display:flex;justify-content:space-between;font-size:11px;}
.pagebreak{page-break-after:always;break-after:page;}
@page{size:A4;margin:0;}
@media print{body{margin:0;}.sheet{padding:14mm 16mm;}.q{page-break-inside:avoid;}}
"""


def render_paper(class_name, level_objs):
    """level_objs: list of dicts in the order they should appear (already sorted by cog)."""
    questions = []
    n = len(level_objs)
    total_marks = 0
    for i, lv in enumerate(level_objs, start=1):
        title, marks, body = q_for_level(lv)
        try:
            m_int = int(marks)
            total_marks += m_int
        except Exception:
            m_int = 2; total_marks += 2
        cog_label = MAPPING[lv["code"]]
        questions.append(
            f'<div class="q">'
            f'<div class="q-head">'
            f'<span class="q-num">{i}</span>'
            f'<span class="q-title">{escape(title)}</span>'
            f'<span class="q-cog">{escape(cog_label)}</span>'
            f'<span class="q-marks">[{marks} mark{"s" if marks!="1" else ""}]</span>'
            f'</div>'
            f'<div class="q-body">{body}</div>'
            f'</div>'
        )
    # split across two A4 pages: 8 then rest
    if n <= 8:
        page1, page2 = questions, []
    else:
        # try to break at a sensible point
        page1, page2 = questions[:8], questions[8:]
    sheets_html = []
    # page 1
    sheets_html.append(f'<div class="sheet">')
    sheets_html.append(f'''
      <div class="header">
        <div class="top-line">
          <span>FLN Assessment Programme</span>
          <span>Session: 2025–26</span>
        </div>
        <h1>{class_name} — FLN Diagnostic Paper</h1>
        <div class="subtitle">One question per level, ordered by cognitive progression</div>
        <div class="meta">
          <span>Total Questions: <b>{n}</b></span>
          <span>Maximum Marks: <b>{total_marks}</b></span>
          <span>Time Allowed: <b>60 minutes</b></span>
        </div>
      </div>
      <div class="student-info">
        <div class="field"><b>Name:</b><span class="line"></span></div>
        <div class="field"><b>Roll No.:</b><span class="line"></span></div>
        <div class="field"><b>Date:</b><span class="line"></span></div>
      </div>
      <div class="instructions">
        <b>Instructions to the Student:</b>
        <ol>
          <li>Each question tests a different skill (level). Read each one carefully.</li>
          <li>Write all answers in the space provided. Do not write outside the boxes.</li>
          <li>For multiple choice questions, tick (✓) only one option.</li>
          <li>You may use your fingers or a pencil to count. Do <b>not</b> use a calculator.</li>
          <li>If you cannot answer a question, move on to the next one and come back later.</li>
        </ol>
      </div>
      <div class="cog-legend">
        <b>Cognitive order:</b> every question is tagged with the cognitive skill it tests
        (Observe → Recognize → Recall → Sequence → Compare → Represent → Combine →
        Take Away → Classify → Relate → Generalize → Interpret → Apply). Questions are
        presented in that order so the difficulty progression is from concrete observation
        to abstract application.
      </div>
    ''')
    sheets_html.append("".join(page1))
    sheets_html.append('</div>')
    if page2:
        sheets_html.append('<div class="sheet pagebreak">')
        sheets_html.append("".join(page2))
        sheets_html.append(f'''
          <div class="footer">
            <span>FLN · {class_name} · Diagnostic Paper</span>
            <span>End of Paper · {n} Questions · {total_marks} Marks</span>
          </div>
        ''')
        sheets_html.append('</div>')
    else:
        sheets_html.append(f'''
          <div class="footer">
            <span>FLN · {class_name} · Diagnostic Paper</span>
            <span>End of Paper · {n} Questions · {total_marks} Marks</span>
          </div>
        ''')
    body = "".join(sheets_html)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{class_name} — FLN Diagnostic Paper</title>
<style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>
"""


# ---------- main ----------

def main():
    for class_name, levels in data.items():
        # sort by cognitive order, preserving level number as tiebreaker
        def sort_key(lv):
            cog = MAPPING.get(lv["code"])
            ci = COG_ORDER.index(cog) if cog in COG_ORDER else 99
            num = int(lv["code"].split(".")[1])
            return (ci, num)
        ordered = sorted(levels, key=sort_key)
        slug = re.sub(r"[^a-z0-9]+", "-", class_name.lower()).strip("-")
        out = OUT_DIR / f"{slug}-diagnostic-cognitive.html"
        out.write_text(render_paper(class_name, ordered), encoding="utf-8")
        print(f"  {class_name}: {len(ordered)} Qs, ordered by cognitive progression -> {out.name}")
    print(f"\nWrote {sum(len(v) for v in data.values())} questions across {len(data)} papers.")


if __name__ == "__main__":
    main()
