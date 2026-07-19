# FLN Framework Evolution Log

**Purpose:** a single running record of how the from-scratch numeracy framework (`fln_framework_from_scratch.md` + its companion `fln_level_networks.md`) has evolved through research, review, and — starting with the entry below — comparison against the platform's actual 59-level `FLN Levels Structure/`.

**How this file relates to the other two:** `fln_framework_from_scratch.md` and `fln_level_networks.md` are current-state reference documents — their own bodies state only the final, settled position, with their own "Appendix: How This/These Document(s) Were Built" holding the drafting history for *that specific document*. This file is different: it's the log of comparison work — checking the framework against the real repo — which is a separate kind of activity from drafting the framework itself, and will keep generating findings across many future sessions as more of the repo gets checked, more sub-levels get opened, and more decisions get made about what changes as a result. When a finding here leads to an actual edit in one of the two reference documents, that edit still gets recorded in *that document's own* appendix (so the doc stays self-contained) — this file just cross-references it.

**Status tags used below:**
- **CONFIRMED** — checked against actual worksheet/sub-level file content, not just the level's title or stated objective.
- **REVISED** — an initial hypothesis (title-level or first-pass) turned out to be wrong in some specific way once the files were actually read; the corrected version is what's stated.
- **RETRACTED** — a claim recorded in an *earlier session's memory* turned out not to match the actual file content on re-check; stated explicitly rather than quietly dropped.
- **OPEN** — flagged, not yet resolved either way; needs a decision from Pavani/the platform team, not something to invent unilaterally.

---

## Entry: 2026-07-19 — First full comparison pass, Levels 1–59 vs. the 85-node framework

**Method:** the framework's 7 stages line up with the repo's Preschool 1/2/3 + Class 1–4 age bands exactly (verified from each level's own "Class / Age Group" header) — so the comparison was done stage-by-stage, node-by-node, then the highest-stakes claims were re-verified by opening the actual level `.md` and sub-level (`N.0`/`N.1`/`N.2`/`N.3`) files rather than trusting titles/objectives alone. Several sub-level files contain large embedded base64 image data (600KB+ per file despite ~70 lines of real text) — `awk 'length($0)<1000'` strips those lines cleanly before reading; `rg` (ripgrep) handles whole-repo keyword scans that hang plain `grep` on these files.

### RETRACTED — Level 1 ("Quantity Comparison")

A prior session's memory recorded: *"Level 1 tests visual same/different matching, not more/less."* Re-reading `Level 1_ Quantity Comparison/1.0.md` directly: the level has an explicit **Section A (Equal)** — match equal-quantity groups — and **Section B (More/Less)** — "the questions will be given in pairs, and the child has to circle the one with the greater value." That *is* genuine more/less quantity comparison, not same/different matching. The earlier characterization does not match the file content. Retracted.

**The corrected, framework-grounded finding:** Level 1's more/less comparison is well-executed, but it sits at Preschool 1 (age 3–4). The framework (Piaget-sourced: comparison precedes counting) places *true group-quantity* comparison at **Stage 2 (age 4–5)** — S2.1 — specifically because Stage 1 should instead carry a lower-order "perceptual same/different" judgment (S1.3, not yet a quantity judgment). The repo has no distinct level for that Stage-1 precursor; Level 1 goes straight to the harder, later skill, one stage early.

### REVISED — the Level-10 finding flips direction

Prior review: Level 10 ("Comparison – Numeral") "never actually tests abstract numeral comparison — sub-levels stay at object-count comparison throughout," recorded as a shortfall. The framework's own S3.3 node (added/refined during the framework's own 3-round review) says object-mediated numeral comparison **is** the correct Balvatika (age 5–6) target — fully abstract bare-numeral comparison is explicitly a Class-1 concept (S4.1). So Level 10 not testing abstract comparison looks developmentally appropriate, not a gap. No repo fix indicated here; the earlier finding needed reframing, not action.

### CONFIRMED — front-loading in the core number ladder (checked against sub-level files)

| Repo level | Age band | Content confirmed in file | Framework's placement |
|---|---|---|---|
| Level 4 (Numbers 1–10) | 4–5 | `4.0.md`: writes numerals from finger-gestures, matches numerals to number-name words | S3.1 Numeral recognition — Balvatika (age 5–6) |
| Level 6 (After/Between/Before) | 4–5 | `6.0.md`: bare numeral sequences ("5, __", "__, 8") | S3.6 Sequencing — Balvatika (age 5–6) |
| Levels 7–8 (Addition/Subtraction) | 5–6 | Both reach full concrete→numerical arc, within 10, no carry/borrow | S4.6/S4.7 — Class 1 (age 6–7); NIPUN Bharat's Balvatika Lakshya has **no arithmetic operations at all** |

### CONFIRMED — five strands missing their Class-2 "informal" precursor, landing three different ways (not one uniform pattern — an earlier hypothesis assumed uniformity and was wrong)

| Strand | What's missing | What actually happens once it starts | Verdict |
|---|---|---|---|
| Money (L46) | No Class-2 "recognition only" level (S5.9) anywhere | L46 (Class 3) does full arithmetic + change-making — lands exactly on framework's Class-3 target (S6.11) | Precursor missing; landing level correctly calibrated |
| Measurement (L34/L43) | No Class-2 uniform-non-standard-only step | L34 (Class 2) already has kids reading a standard-unit scale ("pointer at 2 kg, write the value" — a Class-3/S6.8 target); L43 (Class 3) does unit conversion (100cm=__m — a Class-4/S7.7 target) | Precursor missing **and** overshoots by a full stage at both points |
| Data Handling (L30/L47) | No Class-2 pre-tally object-sorting step (S5.15) | L30 (Class 2) already does full tally-mark creation/reading — a Class-3/S6.14 target — then L47 (Class 3) repeats it alongside genuinely new pictograph/bar-graph content matching S6.14 almost verbatim ("4 categories") | Precursor's *replacement* (tally marks) itself front-loaded a stage early |
| Division (L42) | No Class-2 equal-sharing-only level (S5.7) | L42 (Class 3) merges equal-sharing/grouping (Class-2 target) with division facts + mult÷div relationship (Class-3/S6.7 target) into one level | Precursor missing, compressed into the correct stage (no overshoot) |
| Fractions (L45) | No Class-2 informal-folding-only level (S5.10) | L45 (Class 3) uses real fraction notation (½, ¾) and includes an "Equal or Not Equal" section (45.3) that directly targets the exact misconception the framework flags for this stage — genuinely well-aligned there. But: no "of a collection" variant anywhere across all 4 sub-levels (only of-a-whole/shape, checked 45.0–45.3), and tests thirds (⅓, ⅔), which don't appear in the framework's Fractions chain (Chain I) at any stage | Mixed: one well-aligned misconception target, two confirmed gaps |

### CONFIRMED — Shapes & Spatial is nearly an empty strand

Repo-wide `rg -il "shape"` hits only Levels 2, 3, 9, 14 (all Preschool) — nothing dedicated again until incidental shape use inside Fractions (45), Area & Perimeter (56), and Symmetry (58) at Class 3–4. Six of the framework's eight Chain-D nodes (S2.6, S3.9, S4.8, S5.12/S5.13, S6.9, S7.9) have zero repo coverage — nothing between Preschool and Class 4 teaches shape identification or properties as its own topic. Level 3's shape content (`shape recognition`, matching real objects to shapes) does correctly match S1.6 (perceptual shape matching, Stage 1).

### CONFIRMED / REVISED — Subitizing and the Number Line

- **Subitizing:** confirmed true zero — no hits anywhere in the repo (`rg -il "subitiz"` across the whole `FLN Levels Structure/` returns nothing).
- **Number line:** **not** a total absence as first assumed from titles alone — `rg -il "number line"` returns 6 files (Levels 20, 22, 28, 29). In every case it's used only as a scaffold/support visual for *another* skill (skip-counting jumps, ordering remediation, comparison remediation) — never as its own assessed skill (placing/reading a numeral's approximate position on a blank line, the way the framework's S4.14/S5.18 nodes describe it).

### CONFIRMED — Ordinal Positions (L32) placed one stage late, with no prerequisite excuse

L32 ("Ordinal Positions 1st–10th") sits at Class 2 (age 7–8); the framework places ordinals at Class 1 (S4.13), reasoning that their real prerequisite is sequencing (S3.6), not zero. The repo's own sequencing content (L6) was already done two full stages earlier (age 4–5), so there's no readiness reason for the Class-1→Class-2 delay.

### CONFIRMED — five Class-4 levels with no framework counterpart at all

Maps & Directions (L52), Factors & Multiples (L53), Decimals (L55), Angles (L57), Symmetry (L58) — all read directly, all genuinely distinct content, not hidden matches to an existing node. Likely explanations, not resolved either way:
- Factors & Multiples and Decimals are almost certainly **framework gaps** — standard NCERT Class-4 topics the synthesis document's Grade-4 topic map probably just didn't capture.
- Angles and Symmetry plausibly extend **Chain D**, which the framework's own authors already flagged as its weakest, least-developed chain ("no edge here is asserted as a hard cognitive dependency, pending a dedicated Shapes-strand cognitive-dependency study").
- Maps & Directions has no clear framework-chain home at all (cardinal directions / navigation isn't shape geometry) — genuinely outside the current 10 chains.

**One resolution in the other direction:** L56 (Area & Perimeter) — read directly — covers exactly both concepts (perimeter via side-length addition, area via square-unit counting + rectangle/square formulas) that the framework's own Stage-7 appendix flagged as *"not found in any source read for this document."* The repo does teach this; the framework's synthesis document just lacked the citation trail (NCERT's "Fields and Fences" / tiling chapters, per the framework's own Stage-7 textbook-generation note).

### OPEN — decisions not resolved by this comparison pass

1. Which findings above become actual repo-fix PRs (e.g., re-sequencing the Preschool-1/Balvatika/Class-1 front-loaded concepts) vs. which become framework edits (e.g., adding Factors & Multiples, Decimals, Angles, Symmetry as new framework nodes; adding a citation for Area/Perimeter) vs. which just get flagged for the platform team without unilateral action.
2. Whether the "front-loading" pattern (numeral recognition, sequencing, addition/subtraction all landing one stage early) reflects a deliberate platform design choice (e.g., a faster-paced numeracy on-ramp than NIPUN Bharat's statutory floor) or an unintentional drift — this needs Pavani's/the team's read, not an assumption either way.
3. The Chain D (Shapes & Spatial) gap is large enough that it may warrant its own dedicated research pass (the framework's own text already flags Chain D as needing "a dedicated Shapes-strand cognitive-dependency study") rather than being folded into this comparison's fixes.
4. Not yet checked in this pass: Levels 11/23/35/48/59 (the five Review Assessment levels) against the framework's own per-stage node lists, to confirm the reviews actually cover what their own stage introduced (the original Level-11 finding — "omits Classification and Addition/Subtraction from its own topic list" — predates this framework and hasn't been re-checked against it).
