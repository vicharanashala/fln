# FLN Level Networks & Diagnostic Testing Methodology

**Companion to `fln_framework_from_scratch.md`.** That document decomposed 7 stages into concepts, stage by stage. This document reorganizes the same concepts **by strand, as prerequisite chains across stages** — the actual network/graph structure — and then answers the practical question: *given this graph, how many questions, from which levels, make up a diagnostic test?*

**Core method (ALEKS / Knowledge Space Theory, `ALEKS_case_studies.md` §3–5, already in the repo's own Research/ folder):** a skill graph where each node is tagged with prerequisite skills; mastering an advanced node implies the prerequisite nodes are very likely already mastered. This is *why* a diagnostic doesn't need one question per skill — it needs enough well-chosen questions to narrow down the child's position in the graph. ALEKS does this live, question-by-question; this platform's SRS explicitly rules that out mid-worksheet (§1.5, "Adaptive mid-worksheet difficulty" — Out of Scope). The design below instead does the graph-driven selection **once, at worksheet-generation time**, and the graph-driven *inference* **once, at post-submission evaluation time** (SRS §9's Evaluation Engine) — both fully within current scope.

**Convention:** one *concept* from the companion document = one *level* = one *node* in the graph. A level can still have easy/moderate/hard difficulty variants as sub-items (matching the repo's existing N.0/N.1/N.2 sub-level pattern and `Child_psychology.md`'s 50/35/15 mix) — that's within-node variation, not a separate node.

---

## Part 1 — The Level Count, Per Stage

| Stage | Testable levels | Non-testable (oral-only) |
|---|---|---|
| 1 — Preschool 1 (age 3–4) | 7 | 0 |
| 2 — Preschool 2 (age 4–5) | 10 | 0 |
| 3 — Preschool 3 / Balvatika (age 5–6) | 10 | 0 |
| 4 — Class 1 (age 6–7) | 15 | 1 (poems) |
| 5 — Class 2 (age 7–8) | 19 | 1 (riddles) |
| 6 — Class 3 (age 8–9) ★ MPL | 14 | 0 |
| 7 — Class 4 (age 9–10) | 18 | 0 |
| **Total** | **93** | **2** |

This is a genuine count from decomposing the research, not a target to hit — it's organized by cognitive dependency within 10 strand-chains (see Part 2), not by an arbitrary sequential number, so it isn't directly comparable 1:1 to the repo's 59. **This count is not fixed and isn't expected to stay fixed** — it grew from 77→85 during the framework's own review rounds, and from 85→93 on 2026-07-19 after the repo comparison surfaced a genuine missing shape-composition sub-strand (Stage 2/3/4, +3 nodes) and four uncited-but-standard Class-4 topics plus the resolved Perimeter/Area gap (Stage 7, +5 nodes) — see the **Appendix: How These Documents Were Built** for the full history, and `fln_framework_evolution_log.md` for the repo-comparison reasoning specifically. Treat every count in this document as current-as-of-its-last-edit, not permanent.

**Note on Part 3's worked diagnostic example, below:** it predates the 2026-07-19 Stage 2/3 additions and has not yet been recomputed to include the new nodes (S2.10, S3.10) — flagged at the point it appears rather than silently left inconsistent.

---

## Part 2 — The Ten Strand Chains (the actual prerequisite graph)

Each of the 10 chains below is expressed as an **edge list** — (source, target, type) — rather than a single left-to-right string, because a graph with side-branches and long-range dependencies can't be written as one line without becoming ambiguous. The Evaluation Engine should consume the edge list; the compact string under each chain is a human-readable summary only, not the authoritative version.

Every edge is typed using Knowledge Space Theory's *surmise test*: **does passing the downstream node make upstream mastery near-certain?**
- **prereq (→)** — yes: a hard cognitive dependency. Part 3's inference logic is allowed to use these — success on the downstream node is real evidence for the upstream one.
- **sequence (⇢)** — no, but the source material happens to teach them in this order. Curricular ordering only; no inference should be drawn across this edge in either direction.
- **parallel (∥)** — co-equal nodes with no dependency relationship at all.

Getting this typing right matters: running the inference logic over a sequence-only edge as if it were a prerequisite produces false conclusions — for example, wrongly inferring that a child who estimates capacity well has probably also mastered length estimation, when the Lakshya lists those as independent, co-equal Class 1 targets.

### Chain A — Pre-Number Foundations (9 nodes; terminates at Stage 3, folds into Chain B after)

| Source | Target | Type | Note |
|---|---|---|---|
| S1.1 (1:1 correspondence) | S1.2 (Classification, single property) | ⇢ | Co-occur in Stage 1; no dependency established |
| S1.2 | S1.3 (Perceptual same/different) | ∥ | If anything S1.3 is more primitive — perceiving sameness/difference precedes sorting by attribute |
| S1.1 | S2.1 (Quantity comparison) | → | Pairwise matching (1:1 correspondence) is literally how a child judges "more/less" before counting |
| S1.3 | S2.1 | → | Must reliably perceive "different" before judging "more" |
| S2.1 | S2.2 (Seriation, 3 objects) | → | Seriation requires repeated pairwise comparison — a genuine extension of S2.1 |
| S2.2 | S2.3 (Classification, increasing complexity) | ⇢ | Ordering ability and classification complexity are independent skill lines |
| S2.1 | S3.3 (Numeral comparison, object-mediated) | → | S3.3 directly reuses the quantity-comparison skill, now object-mediated |
| S2.2 | S3.4 (Seriation w/ transitivity) | → | Transitivity is Piaget's own documented refinement of basic seriation |
| S2.3 | S3.5 (Classification, flexible) | → | Flexible re-sorting is a refinement of increasing-complexity classification |
| S3.3 | **S4.1** (Chain B) | → | **The Level-10-finding edge** — object-mediated comparison is the direct developmental predecessor of removing the object mediation |

*Terminal hand-off:* S3.4/S3.5 don't get Class-1+ successors of their own — Class 1 onward absorbs comparison/classification into Chain B and Chain J rather than continuing as a standalone strand. Worth checking during the repo comparison whether the repo's levels make this same hand-off.

### Chain B — Number Sense (the backbone; 28 nodes)

The number-line nodes (S4.14, S5.18) are sequence-typed side branches with no prereq edge into or out of the main trunk — the number line supports and reinforces the surrounding counting/place-value work, but isn't itself a gate on it.

| Source | Target | Type | Note |
|---|---|---|---|
| S1.4 (Rote counting to 10) | S1.5 (Counting 1–3, support) | ⇢ | Co-occur; rote recitation doesn't gate small-set counting |
| S1.5 | S2.4 (Counting to 5, cardinality) | → | |
| S2.4 | S2.5 (Counting 6–10, support) | → | |
| S1.7 (Perceptual subitizing) | — | ∥ | Runs alongside S1.4/S1.5, not chained in — C&S treat subitizing as its own trajectory |
| S1.7 | S2.9 (Conceptual subitizing) | → | The Clements & Sarama-documented prereq — perceptual subitizing precedes conceptual subitizing |
| S2.9 | — | ∥ | Runs alongside S2.4/S2.5, not chained in |
| S2.5 | S3.1 (Numeral recognition 1–10) | → | Solid counting-to-10 supports learning the written symbols for those counts |
| S3.1 | S3.2 (Numeral–quantity correspondence) | → | Must recognise a numeral before correlating it to a counted quantity |
| S3.2 | S3.6 (Sequencing) | → | Correspondence supports ordering numerals in sequence |
| S3.6 | S4.3 (Counting objects to 20) | → | The main trunk edge carrying Number Sense from Balvatika into Class 1 |
| S3.6 | S4.13 (Ordinal numbers) | → | Sequencing is ordinals' real parent — not zero. Ordinal position ("first, second, third") builds on the general ability to order things, which has nothing to do with the concept of zero |
| S2.4 | S4.12 (Zero, as "none") | → | Cardinality understanding required to grasp "none" as the count of an empty set |
| S3.2 | S4.12 | → | Numeral–quantity correspondence also required for zero-as-"none" — abstract numeral *comparison* (S4.1), by contrast, has nothing to do with zero and isn't a parent of this node |
| S4.3 | S4.14 (Number line, informal 0–20) | ⇢ | Side branch matching the counting-to-20 range — sequence only, no gate on anything downstream |
| S4.3 | S4.4 (Read/write to 99) | → | |
| S4.4 | S4.5 (Place value, face value only) | → | |
| S4.5 | S5.1 (Read/write to 999) | → | |
| S5.1 | S5.18 (Number line, extended 0–100) | ⇢ | Side branch, sequence only |
| S4.14 | S5.18 | ⇢ | The number-line sub-skill's own progression — side-branch to side-branch, never touching the main trunk |
| S5.1 | S5.2 (Place value, tens as groups) | → | |
| S5.2 | S5.17 (Zero, as placeholder) | → | Tens-as-groups understanding required before the placeholder role of zero makes sense |
| S4.12 | S5.17 | → | Zero-as-a-number required before zero-as-placeholder — you can't teach what zero *means when it holds a place* before the child knows zero is a number at all |
| S5.17 | S5.3 (Flexible decomposition, 2-digit) | ∥ | Co-equal Stage-5 refinements of place value; neither gates the other |
| S5.2 | S5.3 | → | |
| S5.3 | S6.1 (Place value, 3-digit) | → | Fuson's (1990) own cited dependency — 2-digit flexible decomposition is genuinely required before 3-digit place value makes sense. The single most load-bearing edge in this chain |
| S6.1 | S6.2 (Flexible decomposition, 3-digit) | → | |
| S6.2 | S6.3 (Comparison/ordering, 3-digit) | → | |
| S4.2 (Numeral comparison, close values) | S6.3 | → | Long-range edge: Class-1 abstract comparison skill is prerequisite for Class-3 3-digit comparison, even though it isn't re-tested in between |
| S6.3 | S6.4 (Read/write to 9999) | → | |
| S6.4 | S7.1 (Place value, thousands) | → | |
| S7.1 | S7.2 (Large numbers/regrouping) | → | |
| S4.1 (Numeral comparison, abstract) | S4.2 | → | |
| S7.1 | S7.15 (Decimals, introduction) *(added 2026-07-19)* | → | Decimal place value (tenths, hundredths) genuinely extends the same tens-grouping logic as whole-number place value — a child who doesn't yet grasp thousands-place grouping isn't ready to reinterpret that grouping running in the other direction (tenths, hundredths) |

*Compact summary string (for readability only — the table above is authoritative):* `S1.4⇢S1.5→S2.4→S2.5→S3.1→S3.2→S3.6→[S4.3→S4.4→S4.5→S5.1→S5.2→S5.3→S6.1→S6.2→S6.3→S6.4→S7.1→S7.2 (trunk)]`, with `S1.7→S2.9` (∥ to trunk), `S4.1→S4.2` (∥, long-range → S6.3), `S3.6→S4.13`, `{S2.4,S3.2}→S4.12→S5.17`, and `S4.14`/`S5.18` as non-gating side branches.

*Why this is still the backbone:* almost every other chain has a genuine prereq edge pointing into this one — it's the single point of failure if a node here is mis-sequenced, which is why the Level-10 finding (S3.3→S4.1) matters disproportionately.

### Chain C — Number Operations (14 nodes — grown from 13, see S7.14 below)

Backward inference within this chain works across every stage boundary — a same-family ladder connects 2-digit carrying/borrowing through to 3-digit word problems and beyond (S5.4/S5.5→S6.5→S7.3), and the multiplication-tables progression connects tables 2,3,4 through to tables 2–10 (S5.8→S6.6). This matters most precisely where ASER data says most children actually are: behind grade level in arithmetic, so a diagnostic needs to be able to infer backward reliably.

| Source | Target | Type | Note |
|---|---|---|---|
| S4.6 (Addition to 9) | S4.7 (Subtraction to 9) | ∥ | Co-equal Class 1 targets |
| S4.4 (Chain B) | S4.6 | → | Numeral literacy needed before written addition |
| S4.4 (Chain B) | S4.7 | → | Same, for subtraction |
| S4.6 | S5.4 (Addition to 99, carrying) | → | A child who computes 47+38 correctly can with near-certainty also compute 4+3 — a strong surmise edge |
| S4.7 | S5.5 (Subtraction to 99, borrowing) | → | **Added — was missing entirely.** Same logic as above |
| S5.2 (Chain B) | S5.4 | → | Fuson's (1990) specific finding — carrying requires tens-as-groups understanding |
| S5.4 | S5.6 (Multiplication, repeated addition) | → | Multiplication-as-repeated-addition depends on addition fluency, not on borrowing |
| S5.5 | S5.6 | ∥ | Taught in the same window; no dependency |
| S5.6 | S5.7 (Division, equal sharing) | ∥ | Taught together in NCERT; equal-sharing division is arguably *more* intuitive to young children than repeated-addition multiplication — no clear directional dependency, so typed parallel rather than forced into a direction |
| S5.6 | S5.8 (Tables 2,3,4) | → | Understanding what multiplication *is* is prerequisite to memorising tables of it |
| S5.19 (Chain F) | S5.8 | → | Skip-counting 2s/5s is the direct bridge into 2×/5× fact fluency |
| S5.7 | S5.8 | ⇢ | Division-by-sharing does not gate table fact-fluency; curricular-order only |
| S5.8 | S6.5 (Add/sub to 999, word problems) | ⇢ | Table fluency doesn't gate word-problem arithmetic; curricular-order only |
| S5.4 | S6.5 | → | A child solving 3-digit addition word problems with regrouping can, with near-certainty, do 2-digit carrying — the same surmise logic as S4.6→S5.4, one stage up |
| S5.5 | S6.5 | → | Same logic, for borrowing/subtraction |
| S6.1 (Chain B) | S6.5 | → | 3-digit place value required for 3-digit word problems |
| S6.5 | S6.6 (Tables 2–10) | ⇢ | No dependency, just adjacent in the curriculum |
| S5.8 | S6.6 | → | Tables 2,3,4 → tables 2–10 is a strict subset relation; passing the full range implies the subset about as cleanly as any edge in this graph |
| S6.6 | S6.7 (Division facts) | → | **Kept as genuine prereq** — division facts are literally the inverse lookups of the multiplication tables |
| S6.7 | S7.3 (Complex add/sub, multi-digit) | ⇢ | Division facts don't gate multi-digit addition/subtraction |
| S6.5 | S7.3 | → | 3-digit applied addition/subtraction is the direct extension into multi-digit complex addition/subtraction — the genuine same-family ladder edge |
| S7.1/S7.2 (Chain B) | S7.3 | → | Place-value-to-thousands required for multi-digit carrying |
| S7.3 | S7.4 (Tables to 15; mult. to 2-digit×2-digit) | ⇢ | Taught in the same window, no dependency |
| S7.4 | S7.5 (Formal division, 4 methods) | → | Multiplication fluency is a genuine prereq for the mult-division-relationship route, one of the four NCERT-named routes into division |
| S6.6/S6.7 | S7.14 (Factors & multiples) *(added 2026-07-19)* | → | Identifying factors/multiples of a number is built directly on the multiplication/division facts already fluent from Stage 6 — genuinely can't reliably find factors of 24 without knowing what multiplies to 24 |

*Boundary check, for completeness:* S5.6/S5.7 (multiplication/division concepts) correctly need no cross-stage successors beyond what's drawn above — the multiplication line is carried forward by S5.8→S6.6→...→S7.4→S7.5 and the equal-sharing line hands off into S7.5's four-routes node via S7.4, not via S5.7 directly. The reconnection gap was confined to the addition/subtraction ladder and the tables ladder.

### Chain D — Shapes & Spatial (13 nodes — grown from 8, see below)

**Updated 2026-07-19, driven by the repo comparison (`fln_framework_evolution_log.md`), not internal re-review.** This chain previously had no dependency-tested edges at all — every edge was typed sequence-only, and the note above literally called out the need for "a dedicated Shapes-strand cognitive-dependency study." Two sources now provide that:

- **The Van Hiele model of geometric thinking** (van Hiele & van Hiele-Geldof) — 5 levels, sequential by experience/instruction rather than age: Level 0 Visualization (holistic, "this looks like X"), Level 1 Analysis (property-based reasoning, "a triangle has 3 sides"), Level 2 Informal deduction (reasoning about how parts relate to compose wholes), Levels 3–4 (Deduction, Rigor — not reached at this age range). Because the levels are genuinely sequential — a child cannot reliably reason at Level 1 without having gone through Level 0 — this gives real **prereq** edges for the shape-identification/properties sub-thread, not just curricular convention.
- **Clements, Sarama, Baroody, Joswick & Wolfe (2019)'s shape-composition learning trajectory** (Piece Assembler → Picture Maker → Shape Composer/Decomposer) — an empirically-validated trajectory for a *different* skill (combining shapes into new shapes) that the original 8 nodes never covered at all. Three new nodes (S2.10, S3.10, S4.15) added to cover it — the same kind of "genuinely missing sub-strand" the framework's own Round-1 review found for subitizing/zero/the number line, just caught two rounds later by external comparison instead of internal re-review.

**Sub-thread 1 — shape identification & properties (Van Hiele-grounded, now partly a real prereq chain):**

| Source | Target | Type | Note |
|---|---|---|---|
| S1.6 (Shape matching, perceptual) | S2.6 (Shape identification, named) | ⇢ | Still both Van Hiele Level 0 (holistic/appearance-based) — naming builds on matching but NIPUN Bharat doesn't assert a hard gate here |
| S1.6 | S3.9 (Shape properties, basic) | → | **Retyped 2026-07-19, was ⇢.** Van Hiele Level 0 → Level 1 is a genuine sequential dependency — a child reliably reasoning about *why* a shape is a triangle (Level 1) has near-certainly already mastered holistic shape recognition (Level 0) |
| S2.6 | S4.8 (3D shape properties) | → | **Retyped 2026-07-19, was ⇢.** Same Level-0→Level-1 logic, extended to 3D property vocabulary |
| S3.9 | S4.8 | ⇢ | Both Level 1 (Analysis) — 2D-properties-first vs. 3D-properties-first isn't itself a hard dependency, just NIPUN Bharat's own sequencing (introduces 3D properties at Class 1, formalizes the 2D named set at Class 2 — genuinely not strictly 2D-before-3D, so this specific edge stays sequence-only) |
| S4.8 | S5.12 (2D shape ID, named set) | ⇢ | Curricular order only, same reasoning as above |
| S5.12 → S5.13 (Spatial vocabulary) | | ⇢ | Co-occurring Class-2 targets, no dependency |
| S4.8 | S6.9 (Relating 2D to 3D) | → | Van Hiele Level 1 → Level 2 — reasoning about how 2D faces *compose* a 3D solid (Level 2, informal deduction) requires the property vocabulary from Level 1 first |
| S6.9 | S7.9 (3D shapes, nets) | → | Level 2 skill, extended — unfolding a solid into its net requires the same part-whole reasoning as relating faces to solids, one step further |

**Sub-thread 2 — shape composition (new 2026-07-19, Clements & Sarama-grounded, independent of Sub-thread 1):**

| Source | Target | Type | Note |
|---|---|---|---|
| S2.10 (Shape composition, piece assembly) | S3.10 (Shape composition, picture making) | → | Direct trajectory dependency per Clements et al. (2019) — Picture Maker is documented as building on Piece Assembler, not a co-equal alternative |
| S3.10 | S4.15 (Shape composition & decomposition) | → | Same trajectory, one level further — Shape Composer/Decomposer is the documented next step after Picture Maker |
| S1.6 | S2.10 | ⇢ | Different skill (matching/naming vs. combining) taught in the same general window — no cross-thread dependency asserted |

**Sub-thread 3 — two new Class-4 topics, each with only a thin, single-edge connection back to Sub-thread 1 (not independently verified against a Van-Hiele-specific source):**

| Source | Target | Type | Note |
|---|---|---|---|
| S4.8 (3D shape properties) | S7.16 (Angles) *(added 2026-07-19)* | ⇢ | Angles plausibly extends Level-1 property-based reasoning to a new shape attribute (angle size), but this specific edge is asserted on general Van-Hiele grounds only, not a source that studied angles specifically — kept as sequence, not prereq, until that's checked |
| S6.9 (Relating 2D to 3D) | S7.17 (Symmetry & reflection) *(added 2026-07-19)* | ⇢ | Both involve reasoning about shape relationships, but no source consulted here asserts symmetry recognition depends on the 2D-3D relating skill specifically |

**Not yet resolved:** whether Sub-thread 2 (composition) has any real dependency *into* Sub-thread 1 (identification/properties) — e.g., whether reliably composing shapes requires Level-1 property knowledge — isn't addressed by either source consulted here and is left as a genuinely open question, not assumed either way.

### Chain E — Measurement (9 nodes — grown from 8, see S7.18 below)

| Source | Target | Type | Note |
|---|---|---|---|
| S2.8 (Comparative vocab, informal) | S3.7 (Comparative vocab, formalizing) | → | |
| S3.7 | S4.9 (Length estimation) | → | |
| S3.7 | S4.10 (Capacity estimation) | → | |
| S4.9 | S4.10 | ∥ | Co-equal Class 1 targets, no dependency |
| S4.9 | S5.11 (Length/capacity, uniform non-standard) | → | |
| S4.10 | S5.11 | → | |
| S5.11 | S6.8 (Standard units) | → | |
| S6.8 | S7.7 (Unit conversion) | → | |
| S6.8 | S7.8 (Measurement word problems) | → | Standard units are genuinely required for word problems |
| S7.7 | S7.8 | ⇢ | Not every measurement word problem requires unit conversion (e.g. "a rope is 4m, another is 7m, total?" needs none at all), so passing S7.8 doesn't certify S7.7 — the two are taught in the same window without one gating the other |
| Chain C (add/sub fluency, matching stage) | S6.8, S7.8 | → | A measurement word problem is an arithmetic word problem wearing a measurement costume |
| S6.8 | S7.18 (Perimeter & area) *(added 2026-07-19 — resolves what was previously a flagged gap, not a node)* | → | Both perimeter and area calculations assume standard-unit fluency; area additionally leans on Chain C's multiplication (length×width) | 

*Flagged gap (not a fillable node):* Weight has no non-standard-measurement step between Stage 2's vocabulary and Stage 6's standard units — inherited honestly from the Lakshya, which only lists length/capacity for non-standard estimation.

### Chain F — Patterns (7 nodes)

| Source | Target | Type | Note |
|---|---|---|---|
| S2.7 (2-item pattern) | S3.8 (2-item indep. + 3-item intro) | → | |
| S3.8 | S4.11 (3-item independent) | → | |
| S4.11 | S5.16 (Number-sequence patterns) | ⇢ | Different modality (shape vs. number) — S5.16's real prereq is Chain B's numeral fluency, not shape-pattern independence |
| S4.4 (Chain B) | S5.16 | → | Numeral fluency genuinely required to read a *number*-sequence pattern |
| S5.16 | S5.19 (Skip counting 2s/5s) | → | Skip-counting is itself a constant-interval number pattern — general pattern recognition supports it |
| S5.19 | S6.13 (Pattern rules + skip-count by 10) | → | Direct extension |
| S6.13 | S7.12 (Number patterns/rule ID) | → | |

### Chain G — Money (3 nodes)

| Source | Target | Type | Note |
|---|---|---|---|
| S5.9 (Currency recognition) | S6.11 (Money arithmetic) | → | Recognition is a genuine prereq for arithmetic with the recognized objects |
| Chain C (add/sub to 999) | S6.11 | → | Rupee/paise regrouping is place-value regrouping wearing a currency costume |
| S6.11 | S7.11 (Complex money word problems) | → | |

### Chain H — Calendar & Time (3 nodes)

| Source | Target | Type | Note |
|---|---|---|---|
| S5.14 (Calendar, days/months) | S6.10 (Clock, hours/half-hours) | ⇢ | Different sub-skills — calendar reading doesn't gate clock reading |
| S6.10 | S7.10 (Time, hours/minutes/AM-PM) | → | Direct refinement of the same clock-reading skill |

*Self-contained chain* — a child could plausibly be strong here while weak elsewhere; shouldn't be treated as a proxy for overall numeracy the way Chain B can be.

### Chain I — Fractions (3 nodes)

| Source | Target | Type | Note |
|---|---|---|---|
| Chain E (equal-parts intuition) | S5.10 (Informal fractions, folding) | → | |
| S5.10 | S6.12 (Fractions, formal — half/quarter/three-quarter) | → | |
| Chain B (counting-of-collections, matching stage) | S6.12 | → | Needed specifically for the "of a collection" variant |
| S6.12 | S7.6 (Fractions, numerical notation + equivalence) | → | |

### Chain J — Data Handling (3 nodes)

| Source | Target | Type | Note |
|---|---|---|---|
| S5.15 (Object/picture sorting) | S6.14 (Tally/pictograph/bar, 4 categories) | → | |
| Chain B (counting, matching stage) | S6.14 | → | Needed to read a tally/bar value |
| Chain A (classification) | S6.14 | → | Needed to sort into categories in the first place |
| S6.14 | S7.13 (Bar graphs, reading/interpreting) | → | |

---

## Part 3 — Worked Example: A Stage-3 (Balvatika) Diagnostic

You asked specifically: *if I'm generating 20 questions for a diagnostic on Stage 3, how many levels are in Stage 3, and how do I decide how many questions per level?*

**Stage 3 has 9 levels**, drawn from 5 of the **10** chains (Chain C/Money/Calendar/Fractions/Data Handling — i.e. Number Operations, Money, Calendar & Time, Fractions, Data Handling — haven't entered yet at this stage; note Number Operations, not just the four late-entering strands, is also absent):
- Chain A: S3.3 (numeral comparison, object-mediated), S3.4 (seriation w/ transitivity), S3.5 (classification, flexible)
- Chain B: S3.1 (numeral recognition), S3.2 (numeral–quantity correspondence), S3.6 (sequencing)
- Chain D: S3.9 (shape properties, basic)
- Chain E: S3.7 (comparative vocabulary, formalizing)
- Chain F: S3.8 (patterns, 2-item independent + 3-item intro)

**A note on misconceptions at this stage:** the framework doc's Stage 1–3 tables don't carry a "Common misconception" column at all — that column only starts at Stage 4. This is an honest limitation, not an oversight to paper over: the misconception literature this framework cites (Battista, Fuson, Rittle-Johnson) is about place value and arithmetic errors from Grade 1 onward, not preschool pre-number concepts. Practical consequence: DP10 (misconception-targeting items) can be implemented using the forward-check nodes below (S4.1, S4.6 — which do have documented misconceptions), and at **one exception among the at-level anchors themselves — S3.3**, whose misconception (premature abstraction, comparing bare numerals before object mediation is solid) is documented not in a table cell but in this framework's own prose via the Level-10 finding. Row 10 of the blueprint below uses it. Every other Stage-3 anchor is without a documented misconception to draw on.

**The real design constraint: item count is capped by *time*, not by the graph.** SRS §6.5's exam window is 45 minutes total, but only **30 minutes is actual answering time** (the other 15 is a commute/settling buffer, not test time) — 1800 seconds. That number, divided by a realistic per-item time for the stage's item complexity, sets the actual ceiling on how many of these questions can exist at all, before graph efficiency even enters the picture:

| Stage complexity | Realistic sec/item | 1800-sec item ceiling |
|---|---|---|
| Preschool (concrete, single-step — Stage 1–3) | ~50–60 sec | ~30–36 items |
| Class 1–2 (mixed concrete/abstract, still short — Stage 4–5) | ~70–80 sec | ~22–25 items |
| Class 3–4 (word problems, multi-step — Stage 6–7) | ~90–110 sec | ~16–20 items |

This cuts against the intuitive assumption that a stage with more levels (like Stage 6) needs proportionally more items than a stage with fewer (like Stage 3) — Stage 6's items are also individually slower to answer, so its item *ceiling* is actually **lower** than Stage 3's, not higher. More levels to cover, in less usable item budget. That's the actual design problem for later stages, addressed below.

**The 24-item Stage-3 diagnostic, one row per item** — stated as a literal table rather than prose, since a table that states each item's node and tier individually can't drift out of sync with the totals the way a paragraph summarizing them could:

| # | Node | Tier | Purpose |
|---|---|---|---|
| 1 | S3.1 (numeral recognition) | Easy | Anchor |
| 2 | S3.1 | Moderate | Anchor |
| 3 | S3.2 (numeral–quantity correspondence) | Easy | Anchor |
| 4 | S3.2 | Moderate | Anchor |
| 5 | S3.2 | Hard | Anchor (backbone deep-probe) |
| 6 | S3.6 (sequencing) | Easy | Anchor |
| 7 | S3.6 | Moderate | Anchor |
| 8 | S3.6 | Hard | Anchor (backbone deep-probe) |
| 9 | S3.3 (numeral comparison, object-mediated) | Easy | Anchor |
| 10 | S3.3 | Moderate | Anchor — **DP10 misconception-distractor** (wrong options built from the premature-abstraction error this node exists to catch — see the Level-10 finding) |
| 11 | S3.4 (seriation w/ transitivity) | Easy | Anchor |
| 12 | S3.4 | Moderate | Anchor |
| 13 | S3.5 (classification, flexible) | Easy | Anchor |
| 14 | S3.5 | Moderate | Anchor |
| 15 | S3.9 (shape properties, basic) | Easy | Anchor |
| 16 | S3.9 | Moderate | Anchor |
| 17 | S3.7 (comparative vocabulary) | Easy | Anchor |
| 18 | S3.7 | Moderate | Anchor |
| 19 | S3.8 (patterns) | Easy | Anchor (single item — see note below) |
| 20 | S2.4 (Stage 2: counting to 5) | Easy | Backward check |
| 21 | S2.1 (Stage 2: quantity comparison) | Easy | Backward check |
| 22 | S2.5 (Stage 2: counting 6–10) | Easy | Backward check |
| 23 | S4.1 (Stage 4: numeral comparison, abstract) | Hard | Forward check — **DP10 misconception-distractor** (wrong options built from the documented "finger-count crutch" error) |
| 24 | S4.6 (Stage 4: addition to 9) | Hard | Forward check |

**How this blueprint is built:** every one of Stage 3's 9 levels gets at least one anchor row (rows 1–19 cover all 9); Chain B — the backbone — gets 2–3 items per node instead of 1 (rows 1–8), since it's the single point of failure if a diagnostic gets it wrong; both of Chain B's own predecessor nodes get a backward check each (rows 20, 22), plus one from Chain A (row 21); and both DP10 misconception items (rows 10, 23) land on nodes that actually have documented misconceptions to draw on, honoring the Stage 1–3 misconception-column gap noted above rather than glossing over it. **Note on row 19 (S3.8):** it gets only 1 item, not 2 like its neighbors — the one deliberate asymmetry in this table, made to keep the total at 24 rather than 25; if forced to cut further, this is the next item to go.

**Counting the tiers directly from the table:** Easy = rows 1,3,6,9,11,13,15,17,19,20,21,22 = **12**. Moderate = rows 2,4,7,10,12,14,16,18 = **8**. Hard = rows 5,8,23,24 = **4**. 12+8+4 = 24, exactly DP8's 50/35/15 target.

**Total: 24 items — within ALEKS's cited 20–25 sufficiency range** (`ALEKS_case_studies.md` §5), and comfortably inside Stage 3's ~30–36 item time-budget ceiling from the table above, with headroom to spare.

**How the 24 responses get turned into a level recommendation (post-submission, in the Python Evaluation Engine, SRS §9 — not during the exam):**
1. Score each chain's anchors independently (per the table above: Chain B's 3 nodes get 2–3 items each, most other nodes get 2, S3.8 gets 1) — this gives a per-chain, not global, "how many of Stage 3's own levels did this child clear."
2. Apply the graph's *typed* implication logic (Part 2) to backward/forward checks — inference only flows across **prereq (→)** edges, never across sequence (⇢) or parallel (∥) ones. If a child fails a Stage-3 Chain-B anchor **and** its Stage-2 backward check, place them at Stage 2 **for Chain B specifically**, not globally.
3. If a child passes a Stage-3 anchor **and** its Stage-4 forward check, flag that specific chain for accelerated placement, independent of other chains.
4. **Open decision for the platform team, not resolved here:** the "recommended next level" this produces isn't one number — per DP9 (levels are milestones, not gates) and the per-chain logic above, a child can legitimately be Stage 4 in Number Sense while staying Stage 3 in Patterns. SRS §9's own worked output already gestures at this ("Counting: Strong | Patterns: Needs Practice"), but the schema (§10's Students collection: a single "current/target level" field) doesn't yet support it. This is a real architectural fork — per-chain recommendations vs. one collapsed number — and this framework's default recommendation is per-chain, but it needs an explicit decision from whoever owns the Evaluation Engine and Students schema, not a silent assumption either way.

**Generalizing to other stages — the scaling rule:**
1. Compute the stage's item ceiling from its realistic sec/item (table above) — not from its level count, since those move in opposite directions at later stages.
2. Build the placement core first: 1 item per non-backbone node, 2 items per backbone-chain (Chain B) node at that stage.
3. If backward/forward checks and the difficulty-mix pass fit within the ceiling after the placement core, add them in this priority order — **backward checks on Chain B are cut last; forward checks are cut first** (missing a genuinely advanced child is lower-stakes than missing the ASER-documented reality that most children are behind, and the platform can catch acceleration at the *next* cycle instead): forward checks → difficulty-mix/misconception items → non-backbone backward checks → Chain-B backward checks.
4. **Structural relief for the tight later-stage budget:** SRS's own 3-cycle design (Baseline = previous class's full syllabus, Mid-Year = previous + partial current, End-Year = previous + full current — SRS §1.4) already performs a full-coverage backward check once a year, at whatever stage a class's Baseline targets. A within-cycle diagnostic doesn't need to re-derive backward coverage from a handful of sampled items — Stage 6's own Baseline exam already **is** a complete backward check on Stage 5. This is what actually resolves the tight Class 3–4 budget: those stages' diagnostics can spend nearly their whole item ceiling on at-level anchors and forward checks, leaning on the Baseline cycle itself for backward coverage instead of squeezing it into the same sitting.

---

## Part 4 — What This Still Doesn't Resolve (open, not silently assumed)

1. **Cross-chain interaction effects aren't modeled here.** A child weak in Chain B (Number Sense) will *also* struggle with Chain C, E, G, I, J questions purely because those chains borrow Chain B prerequisites — this graph documents *that* the dependency exists but doesn't yet quantify *how much* a Chain-B gap should discount a same-stage question in a dependent chain. ALEKS's actual KST implementation solves this with a formal feasible-states model (`ALEKS_case_studies.md` §6); replicating that exactly would need either a probabilistic model (BKT-style, §8 of the same doc) or a simpler manual rule, and that's a deliberate design choice, not something this framework should silently pick.
2. **The backward/forward-check item counts in Part 3 are a reasoned default, not an empirically-tuned number.** ALEKS's own 20–25-question sufficiency claim comes from live adaptive testing where each question is chosen based on the *previous* answer; this framework's fixed-in-advance version — with explicit time-budget math and a stated drop-priority order — is a defensible adaptation, but hasn't been validated against real student response data the way ALEKS's has.
3. **Numbered open decision for whoever owns the Evaluation Engine / Students schema:** should the platform's level recommendation be per-chain (a child can be Stage 4 in Number Sense, Stage 3 in Patterns) or a single collapsed number, as the current schema's singular "current level" field implies? This document's default is per-chain, per DP9 and SRS §9's own worked example — but it's a real architectural fork, not a detail, and needs an explicit decision rather than inheriting whichever the schema happens to support today.
4. **This document, like the companion framework, has not yet been compared against the repo's actual 59 levels.** That comparison is still the next step whenever you're ready for it.

---

## Appendix: How These Documents Were Built

This document and its companion (`fln_framework_from_scratch.md`) went through three rounds of external review before reaching the versions above. The body states only the final, settled position — this appendix is the drafting history: what was wrong, how it was caught, and what changed. It's kept separate from the main text deliberately, so using the graph doesn't require reading "this used to say X" along the way.

### Round 1 — first full review

**The single biggest structural problem: prerequisite and sequence edges were conflated.** The first draft presented every chain as a plain left-to-right arrow chain, implying every arrow was a hard cognitive prerequisite — the kind Knowledge Space Theory allows you to infer *across* (success on the later node implies the earlier one is very likely mastered). Several of those arrows were really just the order rows happened to appear in the source tables — real curricular sequencing, but not something you can infer across. Concretely: the draft had classification chained before perceptual same/different (backwards, if anything — perceiving sameness/difference is more primitive), length estimation chained before capacity estimation (the Lakshya lists them as co-equal, no dependency), and multiplication chained as if borrowing were its prerequisite (it isn't — multiplication-as-repeated-addition depends on addition fluency, not borrowing). Fixed by introducing the three-way typing system (prereq / sequence / parallel) used throughout Part 2, and re-running every edge through the surmise test.

**Two related citation problems, from checking `Child_psychology.md` and NCERT sources directly:**
- DP8's 50/35/15 question-mix ratio was presented with the same citation weight as peer-reviewed sources elsewhere in the framework, but `Child_psychology.md` §8.2 gives no primary source for it. Relabeled explicitly as a platform convention.
- The Level-10 finding's prerequisite chain was incomplete — it hadn't drawn the edge from numeral recognition (S3.1) into object-mediated numeral comparison (S3.3), even though you obviously can't compare numerals you can't read. Added.

### Round 2 — a second, independent review of the round-1 fixes

**A genuine structural bug the round-1 fix introduced, caught by re-parsing every edge:** the newly-added gap nodes (the number-line nodes specifically) got spliced *into* Chain B's main trunk instead of drawn as side-branches off it — severing two real trunk edges in the process (S3.6→S4.3 and S5.3→S6.1, the second one being Fuson's own cited dependency between 2-digit and 3-digit place value). This happened because a single inline string like `A ⇢ B ∥ C → D` can't express branching without becoming ambiguous or silently wrong. Fixed two ways: restoring the severed trunk edges, and abandoning the inline-string format in favor of the explicit (source, target, type) edge-list tables used throughout Part 2 now — a format that can't hide this kind of error the way a string can.

**The Part 3 diagnostic blueprint contradicted itself.** The original blueprint was three prose paragraphs describing which nodes get how many items at which difficulty tier — and the paragraphs didn't agree with each other on the actual numbers. Fixed by replacing the prose entirely with the 24-row item table used now: a format where each item is a single stated row, which can't drift out of sync with itself the way a paragraph reconciling totals can.

**The overclaimed verification — the one real integrity problem found in this process** (documented in the companion framework's own appendix): a cell describing "tables to 15" as independently confirmed against a primary source, when that verification hadn't actually been performed with that rigor. Retracted and relabeled honestly once caught.

**Two more corrections from re-checking Chain C specifically:** the review caught that fixing the mis-typed edges in Chain C had gone too far in two places — subtraction-to-9 had no edge at all into borrowing-to-99 (added), and single-digit addition into 2-digit carrying had been mistakenly typed as sequence-only when it's actually one of the strongest surmise edges in the whole graph (retyped to prereq).

### Round 3 — pre-finalization check

**A trunk-severance pattern recurred, this time in Chain C.** Demoting Chain C's mis-typed prereq edges to sequence (round 2's fix) correctly removed the wrong edges, but left Number Operations disconnected across every stage boundary above Stage 5 — the same underlying mistake as Chain B's severed trunk, just discovered a round later. Fixed by adding back three genuine same-family ladder edges: 2-digit carrying/borrowing into 3-digit word-problem arithmetic (S5.4/S5.5→S6.5), tables 2,3,4 into the full 2–10 range as a strict subset relation (S5.8→S6.6), and 3-digit arithmetic into multi-digit complex arithmetic (S6.5→S7.3). This mattered more than a typical cleanup, since it's exactly the strand where ASER data says most children are functioning behind grade level — a diagnostic needs to be able to infer backward here reliably.

**Four smaller polish fixes**, all caught by the same close re-read:
- Chain E's S7.7→S7.8 edge was over-typed as prereq — not every measurement word problem requires unit conversion, so it was retyped to sequence.
- A note/type mismatch in Chain C (a row's note said "left untyped" while its type column said parallel) was reworded for consistency.
- Part 3's misconception note said DP10 items couldn't be placed on Stage-3 anchors, while the blueprint table then placed one there anyway (row 10, on S3.3) — not actually a contradiction, since S3.3's misconception is documented in prose via the Level-10 finding rather than in a table cell, but the note was rewritten to say so explicitly instead of reading as self-contradicting.
- The framework document's numeral-recognition cell said "decoupled from counting," while this document's S2.5→S3.1 edge draws counting as a genuine prerequisite of numeral recognition — the two documents read as disagreeing with each other. Fixed by softening the framework document's wording (see its own appendix).

### What was flagged but deliberately left open, not fixed

- **Cross-chain interaction effects** (how much a weakness in one chain should discount confidence in a dependent chain) are documented as existing but not quantified — a deliberate scope decision, not an oversight, since doing this properly needs either a probabilistic model or a considered manual rule.
- **The item counts in the diagnostic blueprint** are a reasoned default, not validated against real student data.
- **The per-chain-vs-single-number recommendation question** is flagged as a genuine open architectural decision for the platform team, not resolved here one way or the other.

### Round 4 — driven by the 2026-07-19 repo comparison, growing Chain D, C, E, and B

Same trigger as the companion framework document's own Round 4 (see its appendix for the full reasoning) — external comparison against the repo, not internal re-review. Applied here:

- **Chain D grew from 8 to 13 nodes and gained its first genuine prereq edges**, sourced to the Van Hiele model (shape-identification/properties sub-thread: S1.6→S3.9 and S2.6→S4.8 retyped from sequence to prereq; S4.8→S6.9→S7.9 given a citable Level-1→Level-2 rationale) and to Clements, Sarama, Baroody, Joswick & Wolfe (2019)'s shape-composition trajectory (an entirely new sub-thread: S2.10→S3.10→S4.15). Two further nodes (S7.16 Angles, S7.17 Symmetry) were added with only thin sequence-only connections back to the main sub-thread — flagged honestly as not independently verified against a Van-Hiele-specific source, rather than forcing a prereq typing the sources don't actually support.
- **Chain C gained S7.14 (Factors & Multiples)**, a genuine prereq off the Stage-6 multiplication/division facts.
- **Chain E gained S7.18 (Perimeter & Area)**, resolving what the companion document previously carried only as a flagged, uncited gap — the repo comparison confirmed the content is actually taught (Level 56), and the citation trail already existed (GPF + Math Magic's "Fields and Fences"/tiling chapters), so this was a matter of promoting a known gap to a real, cited node.
- **Chain B gained S7.15 (Decimals)**, a prereq off the thousands-place-value node (S7.1).
- **Total node count: 85 → 93.** Not treated as a new fixed number — see the note at the top of Part 1.
- **Not yet done, flagged rather than silently skipped:** Part 3's worked Stage-3 diagnostic blueprint (24 items, tier counts 12/8/4) predates the Stage-2/3 shape-composition additions (S2.10, S3.10) and has not been recomputed to include them. Whoever picks this up next should treat that blueprint as stale until it's redone, not as still-authoritative.
