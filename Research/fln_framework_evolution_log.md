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

---

## Entry: 2026-07-19 (continued) — Targeted research on the three flagged gaps

Following the comparison pass above, Pavani asked to research the specific gaps it surfaced, rather than a generic re-review. Three threads, each via web search (current as of July 2026):

### Chain D (Shapes & Spatial) — a real fix, not just a citation patch

The framework's own text flagged Chain D as having no dependency-tested edges ("pending a dedicated Shapes-strand cognitive-dependency study"). Two genuine, citable sources close this:

- **The Van Hiele model of geometric thinking** (van Hiele & van Hiele-Geldof, 1950s Netherlands; still the standard developmental model for geometric reasoning) — 5 levels, sequential by *experience/instruction*, not age: Level 0 (Visualization — holistic "this looks like a window"), Level 1 (Analysis — attaching properties, "a triangle has 3 sides"), Level 2 (Informal deduction), Level 3 (Deduction), Level 4 (Rigor). Children reach Level 1 in elementary school given rich enough geometric experience. This gives Chain D its first genuine **prereq** edge, not just curricular sequence: Level-0 shape identification (S1.6, S2.6 — matching/naming by holistic appearance) must precede Level-1 property-based reasoning (S3.9, S4.8 — "why is it a triangle," 3D properties) — passing a Level-1 item is real evidence Level-0 is mastered, the same surmise-test logic already used elsewhere in the graph.
- **Clements & Sarama's shape-composition learning trajectory** (Piece Assembler → Picture Maker → Shape Composer/Decomposer, empirically validated per Clements, Sarama, Baroody, Joswick & Wolfe, 2019) — the same research group already cited for Chain B's counting trajectory. This is a **different skill entirely** from shape identification: combining shapes into pictures/new shapes, not naming or describing them. Chain D's current 8 nodes (S1.6 → S7.9) don't cover this at all — it's a genuine missing sub-strand, structurally the same kind of gap subitizing/zero/the-number-line were for Chain B before round-1 review added them.

**Proposed, not yet applied:** (1) retype S1.6→S3.9 and S2.6→S4.8 as `→` (prereq) rather than `⇢` (sequence) in `fln_level_networks.md`, citing Van Hiele; (2) add citations to the existing Chain D nodes in `fln_framework_from_scratch.md`; (3) **decide** whether to add a new shape-composition sub-strand (3-4 new nodes) — this changes the framework's total node count (currently 85) and therefore the diagnostic-blueprint item-ceiling math in `fln_level_networks.md` Part 3, so it needs your sign-off before being added, the same way subitizing/zero/number-line went through your review rounds rather than being added unilaterally.

### The 5 uncited Class-4 repo topics — mostly resolved, one genuine scope question

- **Factors & Multiples, Decimals, Angles: all confirmed standard, current CBSE Class 4 topics** (2026 syllabus) — the framework's synthesis document simply didn't capture them; these were never actually ungrounded content, just uncited in this framework specifically.
- **Symmetry: confirmed via NCERT's newer "Maths Mela" Class 4 textbook** (replacing the outgoing Math Magic series the framework's citations are built on) — Chapter 11 is literally titled "Fun with Symmetry." This is a clean, direct explanation for why the framework missed it: its sourcing predates the textbook generation that introduced this chapter. (The older Math Magic's Chapter 8, "Carts and Wheels," also touches symmetry via circles/curves, so it isn't entirely new content either — just not framed as its own topic there.)
- **Maps & Directions: genuinely different** — cardinal directions/map-reading is standard *Social Studies/Geography* curriculum content (confirmed — CBSE Class 4 Geography covers this explicitly), not Mathematics. The framework's "Mathematics only" scope (stated in its own Scope section, matching PRD.md) is the reason this was never going to have a citation from a math-specific source. **Open question worth surfacing, not resolved here:** is this level intentional cross-curricular enrichment inside a platform whose own stated scope is math-only, or should it be reconsidered? Not something to decide unilaterally.

**Proposed, not yet applied:** add Factors & Multiples, Decimals, Angles, and Symmetry as new Stage-7 framework nodes with the citations above (raising the total from 85 to 89) — again, a count change that needs your sign-off before touching the actual documents.

### Front-loading pattern — real precedent exists, doesn't resolve the decision but informs it

Montessori curricula (hands-on, concrete-to-abstract) introduce concrete addition/subtraction and numeral work by age 5–6.5, and Singapore-style preschool curricula introduce single-digit addition/subtraction with concrete objects/fingers at preschool age — both ahead of NIPUN Bharat's Class-1 (age 6–7) floor for the same content. This doesn't prove the repo's front-loading is *correct*, but it does mean it isn't developmentally reckless by international standards — it's a legitimate design choice with precedent, not an obvious error. Combined with the framework's own already-stated point that NIPUN Bharat's Lakshya is a statutory *minimum*, not a ceiling: the repo's earlier introduction is defensible **provided** the concrete-before-abstract progression is maintained (which Phase 1's file verification already confirmed it is, for Levels 4/6/7/8). Still an open decision for the team — this research gives evidence for the "intentional accelerated pacing" reading, it doesn't settle it.

---

## Entry: 2026-07-19 (continued) — Research findings applied to all three documents

Pavani's explicit instruction after the research round above: this framework is never "finished" — apply well-researched changes freely, even when they change node counts or structure, rather than treating every change as needing a big separate approval gate. Applied immediately, same session:

- **`fln_framework_from_scratch.md`**: added citations (Van Hiele) to existing Chain-D-adjacent nodes; added 3 new shape-composition nodes (Stage 2/3/4, Clements et al. 2019); added 5 new Stage-7 nodes (Factors & Multiples, Decimals, Angles, Symmetry, and Perimeter & Area — the last one promoted from a flagged gap to a real cited node). Own Round-4 appendix entry added.
- **`fln_level_networks.md`**: Chain D rebuilt with two sub-threads (identification/properties, now partly Van-Hiele-grounded prereq edges; composition, entirely new) plus a thin third sub-thread for Angles/Symmetry; Chain B, C, E each gained one new node/edge (Decimals, Factors & Multiples, Perimeter & Area respectively). Part 1's count table updated (85→93). Own Round-4 appendix entry added. **Flagged, not yet done:** Part 3's worked Stage-3 diagnostic blueprint predates the Stage-2/3 additions and needs recomputation.
- **`fln_proposed_levels.md`**: all 8 new levels added in place (verified: `grep -c "^### Level S"` returns 93, matching the claimed total); existing S3.9/S4.8/S6.9 entries got their Van Hiele citations added to match the framework document; summary table updated.

**Not resolved, by design, not oversight:** Maps & Directions was not added to any document as a framework node — confirmed via research to be Social Studies/Geography content, not Mathematics, so its absence from the framework isn't a gap to close. Whether it belongs in a "Mathematics only" platform at all is a product-scope question for the team (item 7 below), separate from whether it's *citable* within this framework (it isn't, and shouldn't be forced to be).

### OPEN — decisions not resolved by this comparison pass

1. Which findings above become actual repo-fix PRs (e.g., re-sequencing the Preschool-1/Balvatika/Class-1 front-loaded concepts) vs. which become framework edits (e.g., adding Factors & Multiples, Decimals, Angles, Symmetry as new framework nodes; adding a citation for Area/Perimeter) vs. which just get flagged for the platform team without unilateral action.
2. Whether the "front-loading" pattern (numeral recognition, sequencing, addition/subtraction all landing one stage early) reflects a deliberate platform design choice (e.g., a faster-paced numeracy on-ramp than NIPUN Bharat's statutory floor) or an unintentional drift — this needs Pavani's/the team's read, not an assumption either way.
3. ~~The Chain D (Shapes & Spatial) gap is large enough that it may warrant its own dedicated research pass~~ — **done 2026-07-19**, see the research-round entry above and the applied changes in all three documents.
4. Not yet checked in this pass: Levels 11/23/35/48/59 (the five Review Assessment levels) against the framework's own per-stage node lists, to confirm the reviews actually cover what their own stage introduced (the original Level-11 finding — "omits Classification and Addition/Subtraction from its own topic list" — predates this framework and hasn't been re-checked against it).
5. ~~Whether to add a shape-composition sub-strand to Chain D~~ — **done 2026-07-19**, added as S2.10/S3.10/S4.15 across all three documents.
6. ~~Whether to add Factors & Multiples, Decimals, Angles, and Symmetry as new Stage-7 framework nodes~~ — **done 2026-07-19**, added as S7.14–S7.17 (plus S7.18 Perimeter & Area, resolving a separate pre-existing flagged gap) across all three documents. Total node count is now 93, not 89 as originally estimated (the Perimeter/Area resolution added a 5th new Stage-7 node beyond the four originally scoped).
7. **Still open:** whether Maps & Directions belongs in a "Mathematics only" platform at all, given it's confirmed standard Social Studies/Geography content, not Math, in the CBSE curriculum — genuinely a product-scope question, not something this framework should resolve unilaterally either way.
8. **New, from applying the above:** Part 3's worked Stage-3 diagnostic blueprint in `fln_level_networks.md` (24 items, tier counts 12/8/4) predates the S2.10/S3.10 additions and needs recomputation — flagged inline in that document, listed here so it isn't lost.
9. ~~The newly-added nodes (S2.10, S3.10, S4.15, S7.14–S7.18) have not yet been checked against the repo the way the original 85 were~~ — **done 2026-07-20**, see the entry below.

---

## Entry: 2026-07-20 — File-verification pass on the 8 nodes added 2026-07-19

Resolves OPEN item 9 above. Note: PR #73 (carrying all three documents through the 85→93 growth) merged into `vicharanashala/fln` main this same day, before this pass started — this verification is against the now-upstream version of the documents, not a pre-merge draft.

### CONFIRMED — S7.14–S7.18 (the five Stage-7 nodes) genuinely match their claimed repo levels, with one exception

Opened every file (main + all sub-levels) for repo Levels 53, 55, 56, 57, 58 — not just the level titles the proposed-levels doc's "Sourced, and matches the repo well" annotations were resting on.

- **S7.15 (Decimals) ↔ L55, S7.16 (Angles) ↔ L57, S7.17 (Symmetry) ↔ L58, S7.18 (Perimeter & Area) ↔ L56 — all four are strong, genuine matches.** Objectives, Learning Outcomes, and actual worksheet sections (checked across all 3 sub-levels of each) line up with the node's stated scope in every case. No discrepancies found.
- **S7.14 (Factors & Multiples) ↔ L53 — partial match, one real gap.** The node's stated Topics Covered include "prime/composite distinction," and its Common Misconception line is specifically about factor/multiple confusion (which L53 *does* test well — Sections A–C across all 3 sub-levels cover factors, multiples, factor pairs, common factors/multiples). But prime/composite numbers do not appear anywhere in L53's main file or any of its 3 sub-levels (53.0–53.2) — checked directly, not inferred. The "matches the repo well" annotation overstates the match on this one point; the repo doesn't yet test the prime/composite half of what the node claims.

### CONFIRMED — S2.10, S3.10, S4.15 (the shape-composition sub-strand) genuinely have zero repo coverage, checked two ways

The original 2026-07-19 pass established this via `rg -il "shape"` (hits: Levels 2, 3, 9, 14, plus incidental use in 45/56/58). Re-verified now with two additional checks, since a keyword search for "shape" alone could miss composition activities described without that word:
1. Re-ran `rg -il "shape"` — same result, unchanged.
2. Broadened the search to composition-adjacent vocabulary that wouldn't necessarily contain "shape" — `tangram|pattern block|combine.*picture|assemble|puzzle|composing|decompos`. Only hit: Level 25 (Place Value), which uses "compose/decompose" for *numbers*, not shapes — a false positive, not a real match.
3. Read the actual shape-related passages inside Levels 2, 3, 9, 14 in context (not just the keyword hit) — all four are identification/matching/recognition/tracing ("recognizing a different shape," "shape recognition," "trace shapes"). None involve combining shapes into a new picture or shape.

No repo content anywhere tests piece-assembly, picture-making, or shape composition/decomposition. The "not yet cross-referenced... unlikely to have a match" language on S2.10/S3.10/S4.15 in `fln_proposed_levels.md` is now confirmed, not just predicted — this is a genuine, verified gap, not an assumption.

### Applied

Updated the three "Not yet cross-referenced" notes on S2.10/S3.10/S4.15 in `fln_proposed_levels.md` to state the gap as confirmed. Updated S7.14's citation note to flag the prime/composite gap explicitly rather than letting the blanket "matches the repo well" line stand uncorrected.

---

## Entry: 2026-08-21 — Source verification of the whole `Research/` folder

**Trigger.** The `ALEKS_case_studies.md` file was found to be built from McGraw Hill's product website rather than research. That prompted a standing instruction: **nothing in `Research/` counts as a standard unless it points to external research.** All 12 files were then checked against the primary literature.

**Starting condition:** 12 files, ~4,000 lines, **zero URLs**. Not one citable link anywhere in the folder.

Full results are in **`fln_source_verification_2026-08-21.md`**. Summary:

- **One claim is outright contradicted** by the literature — the learning-styles/modality claim in `Child_psychology.md` §5 (Pashler et al., 2008). Corrected in place, with an explicit instruction not to build modality classification into the platform.
- **Most of the rest was simply never sourced rather than wrong.** Where files are right, they are right because Brown & Burton (1978), Miller et al., NIPUN Bharat and FLS 2022 are right. Those citations have now been added in place.
- **Three unsupported-but-retained conventions** are now labelled as conventions: the 50/35/15 difficulty ratio, the rubric weightages, and the ALEKS "20–25 questions" figure (which additionally **must not** be used for paper length — it depends on within-session adaptivity that printed papers cannot do).
- `Assessment_paper_rubric.md` line 3 literally read `**Resources:** link_1, link_2` — placeholder text never replaced. Now filled in.
- `FLN_Assessment_Framework.md`'s "critical data gap" argument is **stale**: PARAKH 2024 (July 2025) closed part of it. Flagged.

### Changes to the framework itself

1. **The counting spine is externally corroborated.** Chain B matches the officially specified per-year progression at all six stages. This was arrived at by backward construction — it landing on the official sequence is the strongest external validation the framework has.
2. **The Preschool 1/2 caveat in `fln_framework_from_scratch.md` was too strong and has been softened.** The Foundational Stage competencies document does specify all three preschool years separately.
3. **The four "orphan" chains split two ways, not four.** Money (G) and Fractions (I) are **not** Foundational Stage domains — their late start is defensible. Data Handling (J) and Calendar & Time (H) **are** named domains, so their late start with three nodes each is a **genuine gap**.
4. **`FLN_foundation.md` narrowed the official definition** of foundational numeracy from four components to two, dropping Measurement and Data Handling — the same two chains that are thin. Corrected.
5. ~~**"Balvatika" is ambiguous in official sources**~~ — **RESOLVED 2026-08-21** against the Ministry of Education's own Lakshya poster series ("Balvatika or Age 5-6" / "Class I or age 6-7" / "Class II or age 7-8" / "Class III or age 8-9"). Balvatika = age 5–6, before Class I. This framework's stage→age mapping matches the Ministry labels exactly. Superseded detail: — headed `Class 1 (BALVATIKA)` in one section and `PRESCHOOL 3 (BALVATIKA)` in another of the same document. The maths section agrees with this framework. **Must be pinned down in the grade-mapping work**; read the other way, every stage shifts by a year.
6. **Counting difficulty is language-dependent.** NIPUN Bharat mandates mother-tongue instruction, and Hindi number names are more irregular than English. The framework does not currently account for this.

### OPEN — added by this round

10. The detailed per-stage NIPUN Bharat targets beyond the headline Lakshya remain unverified — `education.gov.in` returns HTTP 403 for the national guidelines PDF. The state document corroborates the shape of the progression but is not the national standard.
11. Data Handling (Chain J) and Calendar & Time (Chain H) need precursor nodes below Stage 5, now that both are confirmed as named Foundational Stage domains.
12. ~~Whether the counting chain should branch by language of instruction~~ — **refined 2026-08-21.** Two separate problems were being conflated. *Literacy load on the page* is handled by the minimum-text design decision. *Number naming* is not, because it acts on the child's internal count sequence rather than the printed page — so it stands as a real open question for the place-value nodes, and the English-specific teen-confusion examples in `Child_psychology.md` §8.3 must not be applied across languages.
13. **New — vernacular-medium assessment is an unrecorded product requirement.** NIPUN Bharat mandates mother-tongue instruction and FLS 2022 ran in 20 languages. An English-only paper measures English comprehension alongside numeracy — a validity problem. Staged position: minimise text now, English instructions as an explicitly interim step, vernacular instruction sets planned with FLS 2022's 20 languages as the benchmark. Not currently in the framework, SRS or PRD.
14. **Sub-skill edges are no longer listed as a gap** — see `fln_level_networks.md` Part 5 for the three-type build method (entailment / inherited / empirical). Most need no literature. What they block is the *teaching* ladder (the worksheet bundle), not the diagnostic.

---

## Entry: 2026-08-21b — Bal Vatika collapsed to one band; grade-anchored mapping

**Decision (Pavani):** everything before Grade 1 is a single **Bal Vatika** band. Do not split it into Bal Vatika 1/2/3.

This matches the national framework: NIPUN Bharat's Lakshya has **one** Balvatika target, not three. Stages 1–3 (7 + 10 + 10 = 27 nodes) become one reported band. The prerequisite edges among those 27 still order a child precisely *within* the band — what is dropped is the preschool *year label*, which was false precision anyway, since pre-primary years are not uniformly implemented across states (some run one year, KVs run three).

**Decision (Pavani):** the mapping is **grade-anchored, not age-anchored.** FLN is defined as a grade-level competency — the mission's target is stated as "by the end of Grade 3." Age is an annotation.

This corrects an earlier recommendation in this log to anchor on age. Two distinct objects must be kept apart in the mapping:

- **Grade-level competency** — the statutory benchmark, what a child in that grade *should* have.
- **True level** — what the diagnostic finds the child *does* have.

FLN certification is `actual ≥ benchmark for the enrolled grade`. The gap between the two is the platform's entire reason to exist, so the mapping must carry both rather than collapsing them.

**OPEN 15 — do state FLN targets differ from the national Lakshya?** Established: states define state-level Lakshya and run their own branded missions (Mission Prerna in UP, Mission Ankur in MP, Utkarsh in Odisha, NIPUN Gujarat, NIPUN Meghalaya, Nipun Tripura), and at least the **timeline** varies — the Meghalaya document targets 2025 where the national mission targets 2026-27. **Not established:** whether the numeracy *competency targets* themselves differ numerically. State Lakshya documents were not accessible. Until resolved, build to the national Lakshya as the baseline and make the grade→level mapping **configurable per state** — states demonstrably localise, and retrofitting that later is far more expensive than allowing for it now.

---

## Entry: 2026-08-21c — L ↔ S crosswalk built; the two graphs disagree

**Discovered while verifying that the shareable level-graph document contained nothing absent from the repo.** It does not — but the check surfaced that the repo already carries a **second, independent level graph, implemented in code**: `frontend/src/data/skillProgressionMap.ts` (713 lines, committed as "full 93-level mapping SK01–SK24 + dashboard panel"), backed by `docs/skill-graph/FLN_93_Level_Skill_Graph_Specification.md`. That file also explains the previously untraceable "27-level skill mapping" — its header states it *replaces the previous 27-level-only layer*.

Full mapping in **`fln_L_to_S_crosswalk.md`** (+ `.json` for code use).

**The node mapping is deterministic.** L-notation is the sequential flattening of S-notation: stage sizes match exactly (7/10/10/15/19/14/18 = 93) and the code's own `stageFor()` uses identical boundaries. `L(n)` is the n-th S-code in stage-then-index order. No judgement required.

**The edge sets do not agree.** Translating the code's prerequisites into S-space:

| | Count |
|---|---|
| Research documents | 104 |
| Code (translated) | 124 |
| **Agree the edge exists** | **58** |
| Only in research docs | 46 |
| Only in code | 66 |
| Type disagreements among the 58 shared | 28 |

**The two graphs would not produce the same diagnostic paper.**

**Most consequential single disagreement:** `S3.3 → S4.1` (object-mediated → fully abstract numeral comparison). The research documents type it a **hard prerequisite** — it is the most load-bearing cross-chain edge in the graph and the one the Level-10 finding turned on. **The code types it `often_precedes`.** Under the code's typing, passing S4.1 would not license inferring S3.3, and apex selection returns a larger test set. A contradiction in the other direction: `S1.4 → S1.5` is co-occurring in the documents and `required_for_procedure` in the code.

**A structural cause worth fixing on the code side:** the code stores one `relationshipType` per *level*, applied to all that level's prerequisites. A level with two prerequisites of genuinely different strength cannot currently be expressed.

**Seven content divergences** (not wording) are listed in the crosswalk §2 — several move a concept a full year, e.g. the code puts tally marks and skip-counting-by-10 at Class 2 where the framework has them at Class 3, and names L32 "Tens and Ones" where the framework's S4.5 is deliberately face-value-only pre-conceptual.

### OPEN — added by this round

16. **Which notation survives.** These IDs will carry response data indefinitely; renaming later orphans the history. The mapping is deterministic either way, so this is a naming decision, not a research one.
17. **Reconcile the two edge sets before the diagnostic ships.** 58 of ~150 agreement is not a detail — the apex set, and therefore the printed paper, depends on which graph is right.
18. **Settle the seven content divergences** in the crosswalk §2.
19. **Record the apex computation in the repo.** The per-grade minimum test sets (Bal Vatika 12, Class 1 18, Class 2 25, Class 3 26, Class 4 33 — roughly a 60% reduction) were computed from the edge data but exist nowhere in the repo. They are also invalidated by whichever edge reconciliation lands, so recompute after #17.
