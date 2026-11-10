# _build

## Overview
Python scripts that generate the HTML papers in the parent folder from JSON inputs. Run manually; they are not part of the npm build.

## Interface
- `generator.py`: per-level B&W papers for Class 1 Stage 4.x levels (writes `S4.<n>_<slug>.html`). Reads the syllabus in `ai-services/syllabus/class_1/` and `Research/fln_proposed_levels.md`; that path does not exist (the file is at `Research/02-93-levels/framework-build/fln_proposed_levels.md`), so it cannot run as written, and none of its `S4.*.html` outputs exist in the parent folder.
- `build_class_papers.py`: cognitive-progression diagnostic papers for Classes 2, 3 and 4 (one question per level, ordered Observe to Apply).
- `build_pre_class_papers.py`: the S1-S3 pre-class paper (`class-pre-diagnostic-cognitive.html`) and the S4 paper (`class1-diagnostic-extended.html`). Question bodies are hard-coded (S1-S4 are not in `levels.json`). Reads the same non-existent `Research/fln_proposed_levels.md` path (`:31`) and parses `../../icons.js`.
- `verify.py`: verification of the generated class, pre-class and extended papers. It executes `build_class_papers.py` first (`:25,98-106`), so it overwrites the Class 2-4 HTML in `../` and is not read-only.
- Data: `levels.json`, `cog_mapping.json`. `missing_levels_parsed.json` is read by no script here.

## Invariants
- Output is deterministic for `build_class_papers.py` and `build_pre_class_papers.py`. `generator.py` derives its pseudo-random counts from the level code (`random_count`, `:740`), so it is stable per level but not a function of the JSON alone.
- `cog_mapping.json` is the source of the level-to-cognitive-step mapping; `verify.py` must pass after any regeneration.
- Scripts read external research/syllabus inputs referenced in their headers (the code reads `Research/fln_proposed_levels.md`, which does not exist; the file is at `Research/02-93-levels/framework-build/fln_proposed_levels.md`).

## Side Effects
- Overwrite HTML files in `../` (and `build_pre_class_papers.py` reads `../../icons.js`). No network access.

## Verification
- Run: `python frontend/public/worksheets/proposed-levels/_build/verify.py` from the repo root.
