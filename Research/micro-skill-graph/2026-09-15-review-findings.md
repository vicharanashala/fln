# Micro-Skill Prerequisite Graph — 2026-09-15 Review Findings

Pavani and Amritha reviewed the FLN Micro-Skill Prerequisite Graph (`fln-micro-skill-graph.html`, in this same folder) and sent back a list of corrections. This document records what was checked, what was decided, and — for the items still open — the actual curriculum evidence gathered so the next reviewer isn't starting from zero. It supersedes chat history as the citable record of this review pass.

**Companion reading:** `Research/fln_level_networks.md` (the original graph-structure design rationale) and `docs/question-authoring-and-assets.md` (why artwork/markup lives in files, not inline). The graph itself is the visualization; this file is why it changed.

---

## 1. Terminology fix: "tree" → graph/DAG

The graph was originally titled and labeled as a "tree" throughout (title, `aria-label`, section headers, even the filename). This is wrong, not just informal — checked directly: **30 of the 93 Level nodes already have two or more incoming prerequisite edges**, which is impossible in a tree by definition (a tree gives every node exactly one parent). The file's own layout note ("layers by longest-path depth") is itself a DAG-layout technique, not a tree one.

This is the same class of naming problem Pavani flagged separately with "Levels" implying `L(n+1)` comes after `L(n)` — a label that quietly teaches everyone reading it the wrong mental model, badly enough that it once misled an automated reviewer into flagging a real prerequisite edge as backwards.

**Fixed**: title, `aria-label`, section headers, and the filename itself (`fln-micro-skill-tree.html` → `fln-micro-skill-graph.html`) all now say graph/DAG, with the 30/93 figure written directly into the page so the claim is verifiable by anyone reading it, not just asserted.

## 2. Four wrong-skill corrections — verified against the live file before fixing, not assumed from the report

| Level | Was | Now |
|---|---|---|
| L59 "Zero as a Placeholder" | `SK11.03` Tens as bundles | `SK11.04` Zero as placeholder |
| L65 "Reading & Writing 4-Digit Numbers" | `SK08.07` (three-digit) | `SK08.08` (four-digit) |
| L55 "Spatial Vocabulary" | `SK19.09` Relate 2D faces to 3D solids | `SK19.08` Spatial vocabulary |
| L70 "Relating 2D Faces to 3D Solids" | `SK19.12` Angles and turns | `SK19.09` Relate 2D faces to 3D solids |

All 4 target codes already existed correctly in `frontend/src/data/skillProgressionMap.ts` — these were pure diagram-labeling errors, not taxonomy gaps.

## 3. Missing required edge: L61 → L50

L61 "Skip Counting (2s, 5s, 10s)" is a genuine prerequisite for L50 "Multiplication Tables" — L50 already lists `SK15.03 Skip-count connection` as a required skill — but had no drawn edge between them. Added, matching the graph's existing dashed "edge skipping a layer" convention.

## 4. Four new micro-skills added, one explicitly rejected — with citations

Checked `skillProgressionMap.ts` for the real next-free number before proposing anything (SK08 ended `.08`, SK11 `.09`, SK15 `.07`, SK17 `.05`). All four approved and shipped in [FLN PR #501](https://github.com/vicharanashala/fln/pull/501), closing [FLN #500](https://github.com/vicharanashala/fln/issues/500):

- **`SK08.09` — Zero as "none"** (L39, Concept of Zero) — the cardinality meaning, distinct from `SK11.04` Zero as placeholder (the positional meaning).
- **`SK11.10` — Face value**, distinct from place value — recurred as an unresolved gap on **22 different Levels** across the graph (found by a full-file search, not the 2–3 originally named in the report).
- **`SK15.08` — Factors and multiples** (L89).
- **`SK17.06` — Decimal notation (tenths and hundredths)** (L90).

**Fifth item, deliberately not added — recognising operator symbols `+ − × ÷`.** Researched against the actual government documents rather than guessing a placement:

- NCERT's *Learning Outcomes at the Elementary Stage* (`ncert.nic.in/dee/pdf/tilops101.pdf`) never lists symbol-recognition as its own outcome anywhere in the mainstream curriculum. The Class I addition outcome writes *"constructs addition facts up to 9... 3+3 counts 3 steps forward from 3 and concludes that 3+3=6"* — using `+`/`=` directly inline, no separate "recognises +" step before or alongside it, at any grade.
- The only place "operational symbols" is named at all in that document is the appendix for children with cognitive impairments, listed as a noted **difficulty** ("Confusion in operational symbols, such as + for ×") — not a mainstream learning target.
- NIPUN Bharat's guidelines (`static.pib.gov.in/.../doc20217531.pdf`) mention "symbols" exactly once, and it's about phonics (letter-sound correspondence for reading), not math at all.

**Decision (Jinal, 2026-09-15): follow NCERT — no standalone subskill.** Symbol recognition stays implicit inside each operation's own subskill (SK13.03, SK15.01, etc.), matching how the source treats it. This recurred on **16 different Levels**; all 16 "MISSING" gap markers were removed from the graph rather than filled in.

## 5. Open questions — evidence gathered, decision NOT yet made

These need a curriculum-placement ruling, not a code addition — the codes involved already exist.

**Early symmetry node.** NCERT: Class IV introduces symmetry informally (*"shows through paper folding/paper cutting, ink blots, etc. the concept of symmetry by reflection"*); Class V does the formal version (*"identifies 2D shapes... that have rotation and reflection symmetry"*). Both fall inside L92's own age band (`ageGroup: "9-10"`, stage 7). `SK19.13 Symmetry` already exists and is unused anywhere in the graph — the natural fit for an early node, immediately before L92, which would keep `SK19.14 Reflection` exactly as it is today. **Not yet placed at a specific Level number.**

**Early perimeter node.** NCERT does **not** mention perimeter anywhere before Class IV — first appearance in the whole document is Class IV, already paired with area (*"explores the area and perimeter of simple geometrical shapes... the number of books that can completely fill the top of a table"*). Checked FLN's own level map: **L36/L37/L53 (the levels originally suggested as neighbors) are the wrong age band** — they're `ageGroup: "6-7"`/`"7-8"` (stage 4–5), doing non-standard length/capacity estimation, roughly two years younger than where NCERT places perimeter. `SK20.11 Perimeter` already exists (used today only at L93). If an earlier scaffold is wanted, the evidence points to placing it immediately before L93 within the same stage-7 neighborhood — not back near L36/L37/L53. **Not yet placed at a specific Level number.**

**Six-digit place value.** NCERT explicitly assigns six-digit numbers to **Class V**, not Class IV — *"represents numbers beyond 1000 (up to 100000)"* appears under the Class V outcomes, not Class IV. NIPUN Bharat's own numeracy target caps at three-digit numbers (end of Class III), so it has no bearing either way on six digits specifically. **Conclusion: Class 4 does not need six-digit place value per the government sequence** — `L76` (five-digit) already appears correctly scoped as the ceiling for FLN's current apparent Class-IV coverage; six digits would be a Class V addition, not a Class IV gap-fill.

## 6. The "no single Math Level" citation — could not be found

A separate, related discussion proposed replacing the single "Current Level: N" UI display with a per-concept mastery view, citing "SRS §17" as already having settled that a single Math Level isn't needed. Checked directly: **`SRS.md` §17 (Acceptance Criteria) does not say this** — nor does `PRD.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `MIGRATION_PLAN.md`, or `AUDIT.md`. In fact `SRS.md` and `PRD.md` both say close to the opposite — *"one worksheet per student at their current level"* — near-verbatim in both documents.

This may not be a citable existing decision at all; it may have been discussed verbally and never written down. Flagging here so it isn't cited with a section number that doesn't actually support it. If the mastery-view direction is confirmed, **this document plus a real decision-register entry should become the citation**, not a guessed section number.

## Related GitHub items

- [FLN #500](https://github.com/vicharanashala/fln/issues/500) / [PR #501](https://github.com/vicharanashala/fln/pull/501) — the 4 new micro-skills.
- [FLN #502](https://github.com/vicharanashala/fln/issues/502) — bringing this graph into version control (this PR).
