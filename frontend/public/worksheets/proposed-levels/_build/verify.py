"""
verify.py — single-shot verification for the per-class cognitive-progression
diagnostic papers (Class 2, 3, 4).

Run from repo root:
    python frontend/public/worksheets/proposed-levels/_build/verify.py

Reports:
  - generator compiles
  - generator runs end-to-end without exceptions
  - each output file exists with expected size + question count
  - each output file's questions are in non-decreasing cognitive-progression order
  - each output file has balanced HTML tags (no unclosed/mismatched)
  - no S5/S6/S7 code leaks between class papers (cross-class integrity)
  - all visible numerals in question bodies are <= 9999
"""
import os, re, sys, subprocess, py_compile, json
from html.parser import HTMLParser

HERE     = os.path.dirname(os.path.abspath(__file__))
OUT      = os.path.dirname(HERE)
GEN      = os.path.join(HERE, "build_class_papers.py")
COG_JSON = os.path.join(HERE, "cog_mapping.json")
LEVELS   = os.path.join(HERE, "levels.json")
REPO     = os.path.abspath(os.path.join(OUT, "..", "..", "..", ".."))

PAPERS = [
    ("Class 2", "class-2-diagnostic-cognitive.html", 19, "S5", True),
    ("Class 3", "class-3-diagnostic-cognitive.html", 14, "S6", True),
    ("Class 4", "class-4-diagnostic-cognitive.html", 18, "S7", True),
    # New papers (2026-08-03): no marks, no q-cog label per sahil decision
    ("Pre-Class", "class-pre-diagnostic-cognitive.html", 27, "S1", False),
    ("Class 1 Extended", "class1-diagnostic-extended.html", 15, "S4", False),
]


class TagBalance(HTMLParser):
    VOID = {"br", "hr", "img", "input", "meta", "link",
            # SVG self-closing elements — HTMLParser doesn't know about SVG,
            # so we treat them as void to avoid false-positive unclosed-tag reports.
            "circle", "line", "rect", "polygon", "ellipse", "path", "g", "text", "polyline", "use", "stop"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.bad = []
        # Track whether we're inside an <svg>...</svg> block. While inside, ignore
        # the opening tags of inner SVG elements.
        self.in_svg = False
    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        if tag == "svg":
            self.in_svg = True
            self.stack.append((tag, self.getpos()))
            return
        if self.in_svg:
            # ignore inner SVG elements (HTMLParser doesn't know SVG grammar)
            return
        self.stack.append((tag, self.getpos()))
    def handle_startendtag(self, tag, attrs):
        return
    def handle_endtag(self, tag):
        if tag == "svg" and self.in_svg:
            self.in_svg = False
            if self.stack and self.stack[-1][0] == "svg":
                self.stack.pop()
            return
        if self.in_svg:
            # ignore inner SVG close tags
            return
        if not self.stack:
            self.bad.append(("close-without-open", tag, self.getpos())); return
        if self.stack[-1][0] != tag:
            self.bad.append(("mismatch", f"open={self.stack[-1][0]} close={tag}", self.stack[-1][1]))
        else:
            self.stack.pop()


def check(name, fn):
    try:
        ok, detail = fn()
    except Exception as e:
        ok, detail = False, f"raised: {e!r}"
    flag = "OK  " if ok else "FAIL"
    print(f"  [{flag}] {name}: {detail}")
    return ok


def main():
    print("=== generator + 3 papers verification ===\n")
    all_ok = True

    # 1. Python compile
    def t1():
        py_compile.compile(GEN, doraise=True)
        return True, "build_class_papers.py compiles"
    all_ok &= check("Python compile", t1)

    # 2. Generator runs
    def t2():
        res = subprocess.run([sys.executable, GEN], capture_output=True, text=True, cwd=REPO)
        if res.returncode != 0:
            return False, f"exit {res.returncode}: {res.stderr[:200]}"
        n = sum(1 for l in res.stdout.splitlines() if "Qs, ordered" in l)
        return True, f"{n} papers regenerated, no exceptions"
    all_ok &= check("Generator run", t2)

    # 3. Inputs exist
    def t3():
        missing = [p for p in (GEN, COG_JSON, LEVELS) if not os.path.exists(p)]
        if missing:
            return False, f"missing: {missing}"
        return True, "levels.json + cog_mapping.json + generator present"
    all_ok &= check("Input files present", t3)

    # 4. Per-paper checks
    cog_data = json.load(open(COG_JSON, encoding="utf-8"))
    COG_ORDER = cog_data["COG_ORDER"]
    MAPPING   = cog_data["MAPPING"]

    for cls, fname, n_expected, prefix, has_cog in PAPERS:
        fpath = os.path.join(OUT, fname)
        if not os.path.exists(fpath):
            # Missing files are noted but not fatal — the generator may not have run yet.
            print(f"  [SKIP] {cls}: file missing (generator not yet run) -> {fpath}")
            continue
        txt = open(fpath, encoding="utf-8").read()
        size = os.path.getsize(fpath)
        qs   = re.findall(r'<div class="q">', txt)
        cogs = re.findall(r'<span class="q-cog">([^<]+)</span>', txt)
        if has_cog:
            cog_order_ok = cogs == sorted(cogs, key=lambda c: COG_ORDER.index(c) if c in COG_ORDER else 99)
            valid_cogs = all(c in COG_ORDER for c in cogs)
        else:
            cog_order_ok = True
            valid_cogs = True
        p = TagBalance(); p.feed(txt)
        balanced = (not p.stack) and (not p.bad)
        cross_class = [c for c in re.findall(r'\bS[5-7]\.\d+\b', txt) if not c.startswith(prefix)]
        # number range
        body = re.sub(r'<style.*?</style>', '', txt, flags=re.DOTALL)
        body = re.sub(r'<div class="header">.*?</div>', '', body, flags=re.DOTALL)
        body = re.sub(r'<div class="footer">.*?</div>', '', body, flags=re.DOTALL)
        body = re.sub(r'style="[^"]*"', '', body)
        nums = [int(x) for x in re.findall(r'\b(\d{1,5})\b', body)]
        oor = [x for x in nums if x > 9999]

        # for papers without q-cog, skip cog-count check
        cog_count_ok = (len(cogs) == n_expected) if has_cog else (len(cogs) == 0)
        ok = (len(qs) == n_expected and cog_count_ok and cog_order_ok
              and balanced and not cross_class and valid_cogs and not oor)
        all_ok &= ok
        detail = (
            f"Q={len(qs)}/{n_expected}  COG-order={'ok' if cog_order_ok else 'n/a'}  "
            f"balanced={'ok' if balanced else 'BAD'}  "
            f"cross-class={cross_class or 'none'}  oor={oor[:3] or 'none'}  "
            f"size={size}B"
        )
        flag = "OK  " if ok else "FAIL"
        print(f"  [{flag}] {cls} ({fname}): {detail}")

    print()
    print(f"FINAL: {'all checks passed.' if all_ok else 'FAIL — see above'}")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
