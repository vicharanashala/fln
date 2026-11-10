# proposed-levels

## Overview
Generated B&W A4 diagnostic papers for the proposed FLN levels (pre-class, Class 1 to 4, sample papers) plus `SPEC_missing_42_levels.md`, the spec for the 42 levels (S1-S4) that `_build/build_class_papers.py` does not cover. `_build/build_pre_class_papers.py` already implements them (`class-pre-diagnostic-cognitive.html`, `class1-diagnostic-extended.html`); `_build/cog_mapping.json` still holds only the S5-S7 mapping. Only some of the HTML files are build output of the scripts in [_build](./_build/README.md): `class-2/3/4-diagnostic-cognitive.html` (from `build_class_papers.py`) and `class-pre-diagnostic-cognitive.html` and `class1-diagnostic-extended.html` (from `build_pre_class_papers.py`) should not be hand-edited. `class1-diagnostic-cognitive.html`, `class1-diagnostic-mixed-levels.html`, `sample-15q-diagnostic*.html` and `class1.html` to `class4.html` have no generating script in `_build`.

## Interface
- `class-pre-diagnostic-cognitive.html`, `class1-diagnostic-cognitive.html`, `class-2-diagnostic-cognitive.html`, `class-3-diagnostic-cognitive.html`, `class-4-diagnostic-cognitive.html`, `class1-diagnostic-extended.html`, `class1-diagnostic-mixed-levels.html`.
- `sample-15q-diagnostic.html`, `sample-15q-diagnostic-bw.html` (style reference: `.q / .q-head / .q-body` blocks).
- `class1.html` to `class4.html`: per-class generators that randomize their numbers at load (`Math.random`, e.g. `class1.html:189-190`), not fixed papers.
- Subdirectory: [_build](./_build/README.md).

## Invariants
- The generated diagnostic papers have one question per level with hand-written text and fixed numbers (no randomness); `class1.html` to `class4.html` are the exception and are randomized. Visuals are inline SVG; print is black and white.
- Level ordering follows the cognitive progression documented in `_build/build_class_papers.py`.

## Side Effects
- None at runtime; static files served by Vite.

## Verification
- Run: `python frontend/public/worksheets/proposed-levels/_build/verify.py` from the repo root (checks the generated papers against `cog_mapping.json`). It first re-runs `build_class_papers.py`, so it overwrites the Class 2-4 HTML while verifying, and it also validates the pre-class and extended papers (S1/S4), which have no `cog_mapping.json` entries.
