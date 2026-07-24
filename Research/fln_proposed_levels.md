# FLN Proposed Level Structure — Derived from the From-Scratch Framework

**What this is:** `fln_framework_from_scratch.md` decomposed the numeracy curriculum into 85 testable concepts (+ 2 oral-only targets) across 7 stages, cited to research. `fln_level_networks.md` organized those same 85 concepts into a prerequisite graph (10 strand chains, S-notation IDs like `S3.3`). This document takes the last step: it turns each of those 85+2 concepts into an actual **level** — in the same Objective / Description / Learning Outcome / Topics Covered format the existing repo's 59 levels already use — so it can be compared and eventually merged against `FLN Levels Structure/` 1:1.

**Level IDs reuse the S-notation** from `fln_level_networks.md` (e.g. `S3.3`) rather than inventing new numbers — one concept = one level = one graph node, per that document's own stated convention. This keeps all three documents (framework, network, levels) referring to the same thing with the same name.

**Status of each level, flagged explicitly rather than left implicit:**
- **Sourced** — every field below is a direct restatement of the framework document's own cited row; nothing invented here.
- **Design decision needed** — the framework flagged this as an open question (e.g. Chain D's untested sequencing, the per-chain-vs-single-number question) — stated as such, not resolved by this document.
- **Not yet cross-referenced** — this document does not yet state which existing repo level (if any) this corresponds to; that mapping lives in `fln_framework_evolution_log.md`'s comparison findings and isn't repeated here to avoid the two documents drifting out of sync with each other.

**A note on granularity, stated up front so it isn't a surprise 85 levels in:** the framework's own summary said some of these 85 concepts will map to one repo level, some to several, and some repo levels don't map to any of these at all. This document does not attempt to force 85 concepts into exactly 59 slots — it states the framework's proposal on its own terms; reconciling the count against the existing repo is a separate decision for later, not something resolved by writing this document.

---

## Stage 1 — Preschool 1 (Age 3–4)

### Level S1.1 — One-to-One Correspondence
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Pre-Number Foundations

**Objective:** Match one object to one object reliably.

**Description:** Child matches each object in one set to exactly one object in another set (not yet one object to one number-word reliably). Concrete only — no pictures or symbols at this stage.

**Learning Outcome:** Child can perform one-to-one physical matching between two small sets of real objects.

**Topics Covered:** One-to-one correspondence; object matching.

**Citation:** NIPUN Bharat §3 (`FLN_foundation.md`); Clements & Sarama "Corresponder" stage (`numeracy_research_synthesis` §4.2).

---

### Level S1.2 — Classification (Single Property)
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Pre-Number Foundations

**Objective:** Group objects by one observable attribute.

**Description:** Child sorts objects by colour, size, or shape — one property at a time, never combined properties. Concrete only.

**Learning Outcome:** Child can sort a small set of objects correctly by a single named attribute.

**Topics Covered:** Classification (single property); sorting.

**Citation:** `FLN_foundation.md` §3; `Child_psychology.md` §2.

---

### Level S1.3 — Perceptual Same/Different
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Pre-Number Foundations

**Objective:** Judge whether two small sets "look the same" or "look different."

**Description:** A purely visual/perceptual judgement — not yet a *quantity* judgement (true more/less comparison is Level S2.1, one stage later). Concrete only.

**Learning Outcome:** Child correctly identifies two sets as visually same or different without counting.

**Topics Covered:** Perceptual same/different; visual set comparison (non-quantitative).

**Citation:** Piaget's preoperational-stage distinction (`numeracy_research_synthesis` §3.1).

**Design decision needed:** the existing repo's Level 1 ("Quantity Comparison") currently occupies this exact age slot (Preschool 1) but tests true more/less comparison (Level S2.1's content), not this perceptual same/different judgement — see `fln_framework_evolution_log.md`'s 2026-07-19 entry for the file-verified finding. Whether the platform adds a genuine S1.3-only level here, or keeps S2.1's content at this age and treats DP1's ordering as non-binding, is a decision for the team, not resolved here.

---

### Level S1.4 — Rote Verbal Counting to 10
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Number Sense

**Objective:** Recite the count sequence 1–10.

**Description:** Verbal recitation only — not necessarily tracking objects while counting. This is a memorized sequence, not counting in Piaget's sense, which is why it's allowed to precede comparison-type concepts even though DP1 otherwise orders comparison before counting.

**Learning Outcome:** Child recites "1, 2, 3 ... 10" in order, orally.

**Topics Covered:** Rote counting; number-word sequence.

**Citation:** Clements & Sarama "Reciter" stage (`numeracy_research_synthesis` §4.2).

---

### Level S1.5 — Counting Small Sets (1–3) with Support
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Number Sense

**Objective:** Count 1–3 real objects with adult/scaffolded support.

**Description:** Child touches or points to each object while counting, tracking 1–3 real objects (not yet independent, not yet larger sets). Concrete only.

**Learning Outcome:** Child counts a set of 1–3 objects accurately with support.

**Topics Covered:** Counting small sets; touch-and-count.

**Citation:** Clements & Sarama trajectory; `Child_psychology.md` §5 (kinaesthetic preference).

---

### Level S1.6 — Shape Matching (Perceptual)
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Shapes & Spatial

**Objective:** Match identical real-world shapes by sight.

**Description:** Perceptual matching only — not yet matching by named properties (that's Level S2.6). Concrete only.

**Learning Outcome:** Child correctly matches two identical real-world shapes visually.

**Topics Covered:** Shape matching; perceptual shape recognition.

**Citation:** `Child_psychology.md` §2 (perception-bound thinking precedes concept-based understanding).

---

### Level S1.7 — Perceptual Subitizing
**Class:** Preschool 1 | **Age Group:** 3–4 | **Strand:** Number Sense

**Objective:** Instantly recognise the quantity of 1–3 objects without counting.

**Description:** A distinct trajectory from counting, not a byproduct of it — the child recognises "3" at a glance rather than counting "1, 2, 3." Concrete only.

**Learning Outcome:** Child correctly states the quantity of 1–3 objects shown briefly, without counting aloud or pointing.

**Topics Covered:** Perceptual subitizing; instant quantity recognition.

**Citation:** Clements & Sarama's subitizing trajectory, perceptual subitizing ~ages 1–4 (`numeracy_research_synthesis` §4.2).

**Not yet cross-referenced:** confirmed absent from all 59 existing repo levels (`fln_framework_evolution_log.md`, 2026-07-19) — no repo level currently covers this at any stage, not just this one.

*(Patterns: not yet introduced at this stage — pattern recognition requires holding a repeating unit in working memory, a Stage-2+ skill per `Child_psychology.md` §8.1.)*

---

## Stage 2 — Preschool 2 (Age 4–5)

### Level S2.1 — Quantity Comparison (More/Less/Equal)
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Pre-Number Foundations

**Objective:** Visually compare two groups of objects and judge more/less/equal without necessarily counting.

**Description:** True group-quantity judgement (distinct from Level S1.3's perceptual same/different) — the child judges *quantity*, not just visual sameness. Concrete only.

**Learning Outcome:** Child correctly identifies which of two groups has more, less, or whether they're equal.

**Topics Covered:** Quantity comparison; more/less/equal.

**Citation:** Piaget, 1941 — comparison precedes counting (`Child_psychology.md` §9).

---

### Level S2.2 — Seriation (3 Objects)
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Pre-Number Foundations

**Objective:** Order 3 objects by one rule (e.g. biggest to smallest).

**Description:** Does not yet require transitivity (A>B, B>C ⟹ A>C — that's Level S3.4). Concrete only.

**Learning Outcome:** Child correctly orders 3 objects by a single given rule.

**Topics Covered:** Seriation; ordering by one rule.

**Citation:** `FLN_foundation.md` §3.

---

### Level S2.3 — Classification (Increasing Complexity)
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Pre-Number Foundations

**Objective:** Sort larger or more varied sets by one attribute.

**Description:** Extends Level S1.2 to bigger, more varied sets — still one attribute at a time.

**Learning Outcome:** Child sorts a larger/more varied set correctly by one named attribute.

**Topics Covered:** Classification; sorting (increasing complexity).

**Citation:** `FLN_foundation.md` §3.

---

### Level S2.4 — Counting to 5 with Cardinality
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Number Sense

**Objective:** Count a set of up to 5 objects and state the total accurately.

**Description:** Cardinality means knowing the last number said = the total — not just reciting count-words while touching objects. Concrete only.

**Learning Outcome:** Child counts up to 5 objects and correctly states the total.

**Topics Covered:** Counting with cardinality; counting to 5.

**Citation:** Clements & Sarama "Counter of Small Numbers" (`numeracy_research_synthesis` §4.2).

---

### Level S2.5 — Counting 6–10 with Support
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Number Sense

**Objective:** Extend counting range to 6–10 with scaffolding.

**Description:** Not yet independent — approaching but not yet at "Counter/Producer to 10+" (Level S3.'s counting position). Concrete only.

**Learning Outcome:** Child counts 6–10 objects accurately with support.

**Topics Covered:** Counting 6–10; scaffolded counting.

**Citation:** Clements & Sarama trajectory (`numeracy_research_synthesis` §4.2).

---

### Level S2.6 — Shape Identification (Named)
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Shapes & Spatial

**Objective:** Name common 2D shapes (circle, square, triangle) by sight.

**Description:** Extends Level S1.6's perceptual matching into naming — still by sight, not yet by properties (that's Level S3.9). Concrete/pictorial.

**Learning Outcome:** Child correctly names circle, square, and triangle when shown.

**Topics Covered:** 2D shape naming; shape vocabulary.

**Citation:** `Child_psychology.md` §5 (visual-format preference).

**Not yet cross-referenced:** no dedicated repo level found for this between Preschool 1 (Level 3's shape *matching*) and Class 4 — see the Shapes & Spatial gap finding in `fln_framework_evolution_log.md`.

---

### Level S2.7 — Simple Repeating Pattern (2-Item)
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Patterns

**Objective:** Extend a 2-item repeating pattern (e.g. 🔴🔵🔴🔵🔴 __).

**Description:** 2-item cycle only — 3-item cycles come at Level S3.8. Concrete/pictorial.

**Learning Outcome:** Child correctly continues a 2-item repeating pattern.

**Topics Covered:** Patterns; 2-item repeating sequences.

**Citation:** `Child_psychology.md` §8.1 (explicit easy-tier example).

---

### Level S2.8 — Comparative Vocabulary (Informal)
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Measurement

**Objective:** Use longer/shorter, heavier/lighter, bigger/smaller in concrete comparisons.

**Description:** Vocabulary and informal comparison only — not yet any unit of measurement. Concrete only.

**Learning Outcome:** Child correctly uses comparative measurement vocabulary when comparing two real objects.

**Topics Covered:** Comparative vocabulary; informal measurement language.

**Citation:** `FLN_foundation.md` §4 (Balvatika target, backward-mapped as beginning here).

**Not yet cross-referenced:** the existing repo's first Measurement level is at Class 2 (age 7–8) — three stages later than this proposed starting point. See `fln_framework_evolution_log.md`.

---

### Level S2.9 — Conceptual Subitizing
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Number Sense

**Objective:** Instantly see a slightly larger set as composed of smaller recognized parts (e.g. sees 5 dots as "3 and 2" without counting each one).

**Description:** The bridge between perceptual subitizing (Level S1.7) and true counting/cardinality. Concrete only.

**Learning Outcome:** Child correctly states the total of a small set (~4–6) by recognizing sub-groups, without counting one by one.

**Topics Covered:** Conceptual subitizing; part-whole quantity recognition.

**Citation:** Clements & Sarama's subitizing trajectory, conceptual subitizing ~ages 4–5 (`numeracy_research_synthesis` §4.2).

**Not yet cross-referenced:** confirmed absent from all 59 existing repo levels, same as S1.7.

---

### Level S2.10 — Shape Composition: Piece Assembly *(added 2026-07-19)*
**Class:** Preschool 2 | **Age Group:** 4–5 | **Strand:** Shapes & Spatial

**Objective:** Combine shapes (e.g. pattern blocks) into a picture via trial and error.

**Description:** Treats pieces as separate parts of a picture, not yet a planned whole — a distinct skill from shape *identification* (Level S2.6): building with shapes, not naming them. Concrete only.

**Learning Outcome:** Child combines 2-3 shapes into a simple picture through trial and error.

**Topics Covered:** Shape composition; combining shapes.

**Citation:** Clements, Sarama, Baroody, Joswick & Wolfe (2019) shape-composition learning trajectory — "Piece Assembler" level.

**Not yet cross-referenced:** new node, added after the repo comparison found this skill (as distinct from shape identification) missing from the framework entirely. Not yet checked against the repo — the repo's Shapes & Spatial gap (see `fln_framework_evolution_log.md`) suggests this is unlikely to have a match, but that hasn't been directly verified for this specific concept.

---

## Stage 3 — Preschool 3 / Balvatika (Age 5–6)

*This is the only preschool stage with a directly government-specified target — NIPUN Bharat's Balvatika Lakshya (`FLN_foundation.md` §4).*

### Level S3.1 — Numeral Recognition (1–10)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Number Sense

**Objective:** Read/identify written numerals 1–10.

**Description:** Symbol recognition, distinct from — but built on — counting fluency (a child who counts to 10 solidly is well-positioned to learn what those counts look like written down).

**Learning Outcome:** Child correctly identifies written numerals 1–10.

**Topics Covered:** Numeral recognition; number symbols.

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim).

**Design decision needed:** the existing repo's Level 4 (Numbers 1–10) tests this content at age 4–5, one stage earlier than proposed here — file-verified in `fln_framework_evolution_log.md`. Whether to move it to match this framework or treat the repo's earlier introduction as an intentional faster pace is a team decision.

---

### Level S3.2 — Numeral–Quantity Correspondence
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Number Sense

**Objective:** Correlate a numeral (e.g. "7") with a counted group of 7 objects.

**Description:** Links Stage 1–2's counting work to the Stage-3 symbol — full concrete→pictorial→abstract arc.

**Learning Outcome:** Child correctly matches a written numeral to a counted set of that quantity, and vice versa.

**Topics Covered:** Numeral–quantity correspondence.

**Citation:** `FLN_foundation.md` §4 ("counts & correlates numerals to 10").

---

### Level S3.3 — Numeral Comparison (Object-Mediated)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Pre-Number Foundations

**Objective:** Compare two numerals by first re-grounding each in a counted/object representation.

**Description:** E.g. "7 vs 3" via counting objects for each — **fully abstract numeral-vs-numeral comparison with no object mediation is NOT yet a Balvatika target**; that's Level S4.1. This is the single most important level in the whole framework's comparison against the repo — it directly targets the earlier "Level 10" finding.

**Learning Outcome:** Child correctly compares two numerals when allowed to ground each in counted objects.

**Topics Covered:** Numeral comparison (object-mediated).

**Common misconception:** premature abstraction — comparing bare numerals before object mediation is solid (documented in this framework's own prose, not a table cell, via the Level-10 finding).

**Citation:** `FLN_foundation.md` §4 ("compares two groups more/less/equal" — groups, not bare numerals).

**Sourced, and already reconciled with the repo:** the existing repo's Level 10 ("Comparison – Numeral") matches this level almost exactly — its worksheets stay at object-count comparison throughout, which earlier review flagged as a shortfall but which this framework confirms is the developmentally correct target at this age. See `fln_framework_evolution_log.md`'s "REVISED" entry.

---

### Level S3.4 — Seriation with Transitivity
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Pre-Number Foundations

**Objective:** Order objects by a rule and infer A>C from A>B, B>C.

**Description:** Extends Level S2.2's basic seriation with true transitivity — Piaget's own documented refinement.

**Learning Outcome:** Child correctly orders 3+ objects and can answer a transitivity question without re-comparing every pair.

**Topics Covered:** Seriation with transitivity.

**Citation:** `numeracy_research_synthesis` §3.1; `FLN_foundation.md` §3.

---

### Level S3.5 — Classification (Flexible)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Pre-Number Foundations

**Objective:** Classify by any observable characteristic, and re-sort the same set by a different attribute.

**Description:** Extends Levels S1.2/S2.3 into flexible re-sorting — the child can switch sorting rules on the same set.

**Learning Outcome:** Child correctly re-sorts the same set of objects by two different attributes in turn.

**Topics Covered:** Flexible classification.

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim).

---

### Level S3.6 — Sequencing (Arranges by Sequence)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Number Sense

**Objective:** Arrange numbers/objects/events in order.

**Description:** The direct precursor to Class 1's ordinal-numbers concept (Level S4.13).

**Learning Outcome:** Child correctly arranges a small set of numbers or objects in sequence.

**Topics Covered:** Sequencing; ordering.

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim).

**Design decision needed:** the existing repo's Level 6 (After/Between/Before) tests this content at age 4–5, one stage earlier — file-verified in `fln_framework_evolution_log.md`.

---

### Level S3.7 — Comparative Vocabulary (Formalizing)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Measurement

**Objective:** Use longer/shorter, heavier/lighter correctly and consistently, extending Stage 2.

**Description:** Formalizes Level S2.8's informal vocabulary into consistent, correct use.

**Learning Outcome:** Child consistently and correctly uses comparative measurement vocabulary across multiple items.

**Topics Covered:** Comparative vocabulary (formalizing).

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim).

---

### Level S3.8 — Patterns (2-Item Independent + 3-Item Introduction)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Patterns

**Objective:** Extend 2-item cycles independently; begin 3-item cycles (🔴🔵🟢 repeat) with support.

**Description:** Extends Level S2.7 — independence on 2-item, first exposure to 3-item.

**Learning Outcome:** Child independently continues a 2-item pattern and, with support, continues a 3-item pattern.

**Topics Covered:** Patterns; 2-item independent, 3-item introduction.

**Citation:** `Child_psychology.md` §8.1 (hard tier = 3-item cycle).

---

### Level S3.9 — Shape Properties (Basic)
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Shapes & Spatial

**Objective:** Begin describing *why* a shape is a triangle (3 sides) rather than only naming it.

**Description:** Bridges toward NCERT Grade 1's "describes 3D shape properties." Pictorial.

**Learning Outcome:** Child can state at least one defining property of a basic 2D shape (e.g. "a triangle has 3 sides").

**Topics Covered:** Shape properties (basic).

**Citation:** `FLN_foundation.md` §4, Class I row (bridge citation); Van Hiele Level 1 "Analysis" *(citation added 2026-07-19)* — this is now sourced as a genuine sequential dependency on Level S1.6 (Van Hiele Level 0), not just curricular order.

**Not yet cross-referenced:** part of the confirmed Shapes & Spatial gap — no repo level found covering this.

---

### Level S3.10 — Shape Composition: Picture Making *(added 2026-07-19)*
**Class:** Preschool 3 | **Age Group:** 5–6 | **Strand:** Shapes & Spatial

**Objective:** Lay shapes side-by-side with trial and error, beginning to recognize and plan combinations of shapes into a picture.

**Description:** Extends Level S2.10's piece-assembly into planned (not just accidental) combination.

**Learning Outcome:** Child plans and creates a simple picture from multiple shapes, with some intentionality beyond pure trial and error.

**Topics Covered:** Shape composition; picture making.

**Citation:** Clements, Sarama, Baroody, Joswick & Wolfe (2019) shape-composition learning trajectory — "Picture Maker" level.

**Not yet cross-referenced:** new node, same status as S2.10.

---

## Stage 4 — Class 1 (Age 6–7)

*Government target, verbatim, in `FLN_foundation.md` §4, Class I row — see the framework document for the full quote.*

### Level S4.1 — Numeral Comparison — Fully Abstract
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Compare two bare numerals with no object mediation (e.g. "4 vs 5").

**Description:** This is the concept Preschool 3 (Level S3.3) was *not* ready for.

**Learning Outcome:** Child correctly compares two bare numerals without needing objects.

**Topics Covered:** Numeral comparison, fully abstract.

**Common misconception:** defaulting back to finger-count crutches past the point of fluency (not face-value confusion — that risk starts at Level S6.3).

**Citation:** `Child_psychology.md` §8.2 (numeral-comparison ladder: "hard: abstract comparison — 4 vs 5").

---

### Level S4.2 — Numeral Comparison — Close Values
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Compare abstract numerals with small differences (e.g. "8 vs 9").

**Description:** A distinct, harder sub-skill from general abstract comparison (Level S4.1), not just a repeat of it.

**Learning Outcome:** Child correctly compares two close-valued numerals.

**Topics Covered:** Numeral comparison, close values.

**Common misconception:** higher error rate specifically on close values.

**Citation:** `Child_psychology.md` §8.2 ("very hard: abstract comparison with close values — 8 vs 9").

---

### Level S4.3 — Counting Objects to 20
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Extend counting into the teen-number range (11–20).

**Description:** Extends Level S3.'s "Counter/Producer to 10+."

**Learning Outcome:** Child counts up to 20 objects accurately.

**Topics Covered:** Counting to 20.

**Common misconception:** teen numbers are irregular in Hindi/English naming, harder to generalize than 20s/30s; confusions cluster at 11&12, 13&30, 15&50.

**Citation:** `Child_psychology.md` §8.3 (verbatim).

---

### Level S4.4 — Reading/Writing Numbers to 99
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Symbolic reading and writing of 2-digit numerals.

**Description:** Abstract/symbol stage.

**Learning Outcome:** Child correctly reads and writes any number 1–99.

**Topics Covered:** Reading/writing to 99.

**Citation:** `FLN_foundation.md` §4.

---

### Level S4.5 — Place Value — Face Value Only (Pre-Conceptual)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Recognise and name the two digits in a 2-digit number; state face value.

**Description:** Not yet that the tens digit means a *group* of ten — that's Level S5.2. Treating "53" as "5 and 3" with no grouping meaning is expected and acceptable at this stage.

**Learning Outcome:** Child correctly names the two digits of a given 2-digit number.

**Topics Covered:** Place value, face value only.

**Common misconception:** treating "53" as "5 and 3" with no grouping meaning — acceptable here, flagged only if it persists into Level S5.2.

**Citation:** `numeracy_research_synthesis` §10.2, Level 1 of the worked place-value example.

---

### Level S4.6 — Addition to 9 (Concrete → Abstract)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Operations

**Objective:** Solve addition problems capped at sums ≤9.

**Description:** 1+1, 1+2 (easy) progressing to 4+3, 5+2 (moderate, needs counting-on ability). Capped at 9 so the hard tier (8+7, 9+6) doesn't belong here. Full concrete→pictorial→abstract arc.

**Learning Outcome:** Child solves addition problems with sums up to 9.

**Topics Covered:** Addition to 9.

**Common misconception:** recount-from-1 instead of counting-on from the larger addend, at the moderate tier.

**Citation:** `Child_psychology.md` §8.5 (addition difficulty ladder, easy/moderate tiers only).

**Design decision needed:** the existing repo's Levels 7–8 already test full concrete→numerical addition/subtraction to 9 at Preschool 3 (age 5–6), one stage earlier than this level — and NIPUN Bharat's Balvatika Lakshya doesn't mention arithmetic operations at all. File-verified in `fln_framework_evolution_log.md` — the single biggest sequencing gap found in the whole comparison.

---

### Level S4.7 — Subtraction to 9 (Concrete → Abstract)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Operations

**Objective:** Simple take-away subtraction within 9.

**Description:** Mirrors Level S4.6's addition concept, same CRA arc.

**Learning Outcome:** Child solves subtraction problems within 9.

**Topics Covered:** Subtraction to 9.

**Citation:** `FLN_foundation.md` §4; DP2 (CRA applied symmetrically to subtraction).

**Design decision needed:** same front-loading finding as Level S4.6 above — see repo's Level 8.

---

### Level S4.8 — 3D Shape Properties
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Shapes & Spatial

**Objective:** Describe corners, edges, surfaces of solid shapes.

**Description:** A jump from Level S3.9's basic 2D "why is it a triangle" reasoning to full 3D property vocabulary. Concrete→pictorial.

**Learning Outcome:** Child correctly names corners, edges, and surfaces of a solid shape.

**Topics Covered:** 3D shape properties.

**Common misconception:** confusing a 2D face of a 3D shape with the shape itself (e.g. calling a cube's face a "square shape," not yet connecting it as *part of* the cube).

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim); Van Hiele Level 1 extended to 3D *(citation added 2026-07-19)*.

**Not yet cross-referenced:** part of the confirmed Shapes & Spatial gap.

---

### Level S4.9 — Length Estimation (Non-Standard Units)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Measurement

**Objective:** Estimate/verify length using hand-span, footstep.

**Description:** Informal, body-referenced units — not rulers. Concrete only.

**Learning Outcome:** Child estimates and verifies an object's length using a body-referenced unit.

**Topics Covered:** Length estimation, non-standard units.

**Common misconception:** assumes a fixed personal unit generalizes (doesn't yet grasp that hand-spans differ between people) — a conceptual gap standard units resolve at Level S6.8.

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim).

---

### Level S4.10 — Capacity Estimation (Non-Standard Units)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Measurement

**Objective:** Estimate/verify capacity using cup, spoon, mug.

**Description:** Co-equal target to Level S4.9, no dependency between them.

**Learning Outcome:** Child estimates and verifies a container's capacity using an informal unit.

**Topics Covered:** Capacity estimation, non-standard units.

**Common misconception:** same unit-personalization gap as length, applied to volume.

**Citation:** `FLN_foundation.md` §4 (Lakshya, verbatim).

---

### Level S4.11 — Patterns, 3-Item Repeating Cycle (Independent)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Patterns

**Objective:** Extend 🔴🔵🟢🔴🔵🟢 __ patterns without support.

**Description:** Missing-middle-term items introduced (harder than missing-next-term). Concrete→pictorial.

**Learning Outcome:** Child independently continues a 3-item pattern, including filling in a missing middle term.

**Topics Covered:** Patterns, 3-item independent.

**Common misconception:** spatial-direction confusion (up/down, left/right) persists into pattern tasks using directional symbols.

**Citation:** `Child_psychology.md` §8.1 (hard and very-hard tiers).

---

### Level S4.12 — Zero, as "None"/Empty Set
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Understand zero as the count of an empty group.

**Description:** Not merely a symbol to memorize — genuinely understood as a number and count.

**Learning Outcome:** Child correctly identifies zero as the count of an empty set, in context.

**Topics Covered:** Zero, as "none."

**Common misconception:** treating zero as "nothing to learn" / skipping it rather than treating it as a genuine number.

**Citation:** NCERT Class 1 Math Magic teaches zero explicitly; place value from Level S5.17 onward is incoherent without this node.

**Not yet cross-referenced:** no dedicated repo level found testing this explicitly — needs a direct check of Level 4's/Level 12's actual content before concluding it's a true gap.

---

### Level S4.13 — Ordinal Numbers
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Name/use position-in-sequence (first, second, third…), distinct from cardinal counting.

**Description:** "The fourth object" ≠ "four objects" — a genuinely distinct concept from cardinal counting.

**Learning Outcome:** Child correctly names and uses ordinal positions 1st–10th.

**Topics Covered:** Ordinal numbers.

**Common misconception:** confusing ordinal position with cardinal quantity.

**Citation:** **Weakest citation in the framework document, flagged rather than hidden** — "Standard NCERT Class 1–2 content," no specific section reference.

**Design decision needed:** the existing repo's Level 32 tests this at Class 2 (age 7–8), one stage later than proposed here — and the repo's own sequencing prerequisite (Level 6) was already in place two stages earlier, so there's no readiness reason for the delay. File-verified in `fln_framework_evolution_log.md`.

---

### Level S4.14 — Number Line Placement (Informal, 0–20)
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Number Sense

**Objective:** Place/read a numeral's approximate position on a number line.

**Description:** Early exposure only, not mastery expected. Pictorial→abstract. This is a side-branch in the prerequisite graph — it supports and reinforces surrounding counting/place-value work but isn't itself a gate on it.

**Learning Outcome:** Child approximately places a given numeral (0–20) on a blank number line.

**Topics Covered:** Number line placement.

**Common misconception:** treating the number line as evenly spaced by habit without yet reasoning about magnitude.

**Citation:** Siegler & Booth, 2004 (`numeracy_research_synthesis` §3.2, §9.1 DP7).

**Not yet cross-referenced:** confirmed the repo uses "number line" only as a support visual for other skills (skip-counting, ordering, comparison remediation) in 6 files, never as this specific assessed skill. See `fln_framework_evolution_log.md`.

---

### Level S4.15 — Shape Composition & Decomposition *(added 2026-07-19)*
**Class:** Class 1 | **Age Group:** 6–7 | **Strand:** Shapes & Spatial

**Objective:** Synthesize combinations of shapes into new shapes, and reverse the process (decompose a shape into parts).

**Description:** Completes the composition trajectory begun at Level S2.10 (piece assembly) and Level S3.10 (picture making). Concrete→pictorial.

**Learning Outcome:** Child both composes a new shape from parts and decomposes a given shape into parts.

**Topics Covered:** Shape composition and decomposition.

**Common misconception:** treating composition and decomposition as unrelated skills rather than inverse operations on the same shapes.

**Citation:** Clements, Sarama, Baroody, Joswick & Wolfe (2019) shape-composition learning trajectory — "Shape Composer/Decomposer" level.

**Not yet cross-referenced:** new node, same status as S2.10/S3.10.

---

### *Oral/Classroom-Only Target — Not Paper-Assessable*
**Class:** Class 1 | **Age Group:** 6–7

**Objective:** Creates/recites poems using shapes & numbers.

**Description:** Explicitly **not paper-testable** — a worksheet-only platform structurally cannot assess this Lakshya item. Stated as a scope gap, not silently dropped.

**Citation:** `Assessment_paper_rubric.md`, Class 1 LO6, explicitly flagged non-paper-based.

---

## Stage 5 — Class 2 (Age 7–8)

*From this stage on, NIPUN Bharat's Lakshya (statutory floor) and NCERT's textbook scope (typically fuller) can diverge — see the framework document's own note on which source governs each cell.*

### Level S5.1 — Reading/Writing Numbers to 999
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Sense

**Objective:** 3-digit numeral reading/writing.

**Description:** Abstract/symbol stage.

**Learning Outcome:** Child correctly reads and writes any number 1–999.

**Topics Covered:** Reading/writing to 999.

**Citation:** `FLN_foundation.md` §4.

---

### Level S5.2 — Place Value — Tens as Groups (Unitising)
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Sense

**Objective:** Understand the tens digit represents groups of ten, not individual units.

**Description:** The core conceptual gap at this stage — moving beyond Level S4.5's face-value-only reading.

**Learning Outcome:** Child explains a 2-digit number in terms of groups of ten plus ones (e.g. "47 is 4 tens and 7 ones").

**Topics Covered:** Place value, tens as groups.

**Common misconception:** "47 is 4 and 7" (face-value reading, not grouping) — the single most common Grade 2 place-value misconception.

**Citation:** `numeracy_research_synthesis` §5.2 (Level 2 of the worked place-value example).

---

### Level S5.3 — Flexible Decomposition of 2-Digit Numbers
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Sense

**Objective:** Decompose 2-digit numbers non-canonically (e.g. 35 = 30+5 = 2 tens+15 ones).

**Description:** Not just the canonical form — genuine flexible equivalence.

**Learning Outcome:** Child can express a 2-digit number in more than one valid decomposition.

**Topics Covered:** Flexible decomposition.

**Common misconception:** treating regrouping as a memorized trick rather than a true equivalence.

**Citation:** `numeracy_research_synthesis` §5.2 (Level 3); DP5.

---

### Level S5.4 — Addition to 99, with Carrying
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Operations

**Objective:** Extend Level S4.6's addition-to-9 into the hard tier (8+7, 9+6) and 2-digit carrying.

**Description:** Full concrete→pictorial→abstract arc.

**Learning Outcome:** Child correctly solves 2-digit addition problems requiring carrying.

**Topics Covered:** Addition to 99, with carrying.

**Common misconception:** column-wise addition without understanding regrouping as "10 ones = 1 ten."

**Citation:** `Child_psychology.md` §8.5 (hard tier); `FLN_foundation.md` §4.

---

### Level S5.5 — Subtraction to 99, Introducing Borrowing
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Operations

**Objective:** First borrowing exposure (e.g. 42−18).

**Description:** Simple subtraction with borrowing, mirroring Level S5.4.

**Learning Outcome:** Child correctly solves 2-digit subtraction problems requiring borrowing.

**Topics Covered:** Subtraction to 99, introducing borrowing.

**Common misconception:** subtracting the smaller digit from the larger regardless of position (42−18=34, ignoring regroup) — the single most common subtraction error at this stage.

**Citation:** `Child_psychology.md` §8.8 (easy tier of the borrowing ladder).

---

### Level S5.6 — Multiplication as Repeated Addition
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Operations

**Objective:** Understand 3×4 as 4+4+4, not yet a memorized fact.

**Description:** Concrete→pictorial.

**Learning Outcome:** Child correctly represents a multiplication fact as repeated addition.

**Topics Covered:** Multiplication as repeated addition.

**Common misconception:** treating multiplication as an unrelated new operation rather than compressed addition.

**Citation:** `FLN_foundation.md` §4.

---

### Level S5.7 — Division as Equal Sharing
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Operations

**Objective:** Pictorial equal-sharing division, not yet the formal algorithm.

**Description:** Concrete→pictorial.

**Learning Outcome:** Child correctly shares a set of objects equally among a given number of groups.

**Topics Covered:** Division as equal sharing.

**Citation:** `FLN_foundation.md` §4.

**Design decision needed:** the existing repo has no dedicated Class-2 level for this — the repo's Level 42 (Class 3) merges this content with division facts instead. File-verified in `fln_framework_evolution_log.md`.

---

### Level S5.8 — Multiplication Tables 2, 3, 4
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Operations

**Objective:** Fact fluency for tables 2, 3, 4 specifically — not the full 2–10 range (that's Level S6.6).

**Description:** Abstract recall.

**Learning Outcome:** Child recalls multiplication facts for tables 2, 3, and 4 fluently.

**Topics Covered:** Multiplication tables 2, 3, 4.

**Citation:** `FLN_foundation.md` §4.

---

### Level S5.9 — Currency Recognition (Informal)
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Money

**Objective:** Recognise Indian coins/notes; no arithmetic with money yet.

**Description:** Recognition only — Money enters here for the first time, informally, via NCERT's textbook scope (not yet in the NIPUN Lakshya table).

**Learning Outcome:** Child correctly identifies common Indian coins and notes.

**Topics Covered:** Currency recognition (informal).

**Citation:** `numeracy_research_synthesis` §2, Grade 2 "Money" cell.

**Design decision needed:** the existing repo has no dedicated Class-2 recognition-only level — its first Money content is Level 46 at Class 3, already doing full arithmetic and change-making. File-verified in `fln_framework_evolution_log.md`.

---

### Level S5.10 — Informal Fractions via Folding
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Fractions

**Objective:** "Half," "quarter" as physical folding actions, not numerical notation.

**Description:** Concrete only.

**Learning Outcome:** Child correctly folds/identifies half and quarter of a physical object.

**Topics Covered:** Informal fractions via folding.

**Common misconception:** believing any two pieces from a cut/fold are automatically "halves" regardless of equal size — the core equal-parts misconception, seeded here for Level S6.12 to correct.

**Citation:** `numeracy_research_synthesis` §2, Grade 2 "Fractions" cell.

**Design decision needed:** the existing repo has no dedicated Class-2 informal-folding level — its first Fractions content is Level 45 at Class 3, already using numerical notation (½, ¾). File-verified in `fln_framework_evolution_log.md`.

---

### Level S5.11 — Length/Capacity, Non-Standard *Uniform* Units
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Measurement

**Objective:** Measure using uniform-but-still-non-standard units (rod, thread, cup).

**Description:** Upgrades Level S4.9/S4.10's personal units (hand-span) to uniform units — resolves the "my hand-span ≠ your hand-span" gap without yet introducing standard (metric) units.

**Learning Outcome:** Child measures an object using a uniform non-standard unit and gets a consistent result.

**Topics Covered:** Length/capacity, uniform non-standard units.

**Citation:** `FLN_foundation.md` §4.

**Flagged gap (not a fillable node), inherited honestly from the source:** Weight has no equivalent non-standard-measurement step anywhere in the ladder — it skips straight from Level S2.8's comparative vocabulary to Level S6.8's standard units. NIPUN Bharat's own Lakshya only lists length and capacity for non-standard estimation, not weight. Open design decision for the platform team: insert an informal weight-comparison node here, or accept the asymmetry.

**Design decision needed:** the existing repo's Level 34 (Class 2) already tests standard-unit reading (kg, mL) alongside non-standard units — a Level S6.8 (Class-3) target, one stage ahead of this proposed level. File-verified in `fln_framework_evolution_log.md`.

---

### Level S5.12 — 2D Shape Identification (Named Set)
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Shapes & Spatial

**Objective:** Identify rectangle, triangle, circle, oval specifically.

**Description:** Pictorial.

**Learning Outcome:** Child correctly names rectangle, triangle, circle, and oval when shown.

**Topics Covered:** 2D shape identification (named set).

**Citation:** `FLN_foundation.md` §4.

**Not yet cross-referenced:** part of the confirmed Shapes & Spatial gap.

---

### Level S5.13 — Spatial Vocabulary
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Shapes & Spatial

**Objective:** Use far/near, above/below, front/behind.

**Description:** Concrete/pictorial.

**Learning Outcome:** Child correctly uses spatial-relationship vocabulary to describe object positions.

**Topics Covered:** Spatial vocabulary.

**Citation:** `FLN_foundation.md` §4.

**Not yet cross-referenced:** part of the confirmed Shapes & Spatial gap.

---

### Level S5.14 — Calendar, Days/Months
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Calendar & Time

**Objective:** Read a calendar; no clock-reading yet.

**Description:** Concrete/pictorial.

**Learning Outcome:** Child correctly reads days and months from a calendar.

**Topics Covered:** Calendar reading, days/months.

**Citation:** `numeracy_research_synthesis` §2, Grade 2 "Time" cell.

**Design decision needed:** the existing repo's Level 31 (Class 2) already does clock-reading (a Level S6.10/Class-3 target, including quarter-hours) at this age, while calendar reading itself doesn't appear in the repo until Level 44 (Class 3) — the two sub-skills are reordered relative to this framework. File-verified in `fln_framework_evolution_log.md`.

---

### Level S5.15 — Object/Picture Sorting
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Data Handling

**Objective:** Pre-tally data handling — sorts and counts, not yet reading a pictograph.

**Description:** Concrete.

**Learning Outcome:** Child correctly sorts and counts objects/pictures by category.

**Topics Covered:** Object/picture sorting.

**Citation:** `numeracy_research_synthesis` §2, Grade 2 "Data Handling" cell.

**Design decision needed:** the existing repo's Level 30 (Class 2) already does full tally-mark creation and reading (a Level S6.14/Class-3 target) at this age, skipping this pre-tally step entirely. File-verified in `fln_framework_evolution_log.md`.

---

### Level S5.16 — Number-Sequence Patterns
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Patterns

**Objective:** Extend shape-based patterns (Levels S3.8/S4.11) into number sequences.

**Description:** Pictorial→abstract. Its real prerequisite is Chain B's numeral fluency (Level S4.4), not shape-pattern independence — a different modality entirely.

**Learning Outcome:** Child correctly continues a repeating number-sequence pattern.

**Topics Covered:** Number-sequence patterns.

**Citation:** `numeracy_research_synthesis` §2, Grade 2 "Patterns" cell.

---

### Level S5.17 — Zero, as Place-Value Placeholder
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Sense

**Objective:** Understand zero's role holding a place (e.g. why 40 needs the zero).

**Description:** Depends on Level S4.12's "zero as none" plus Level S5.2's tens-as-groups understanding.

**Learning Outcome:** Child correctly explains why a zero is needed in a number like 40, not just "4 with nothing after it."

**Topics Covered:** Zero, as placeholder.

**Common misconception:** the exact misconception tested at Level S6.3 (does 304's middle zero mean "no tens," or something else?).

**Citation:** Direct prerequisite of place value from this stage onward.

---

### Level S5.18 — Number Line Placement, Extended (0–100)
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Number Sense

**Objective:** Place/read numerals across a full hundred.

**Description:** Supports the shift toward a *linear* (not logarithmic) mental number-line representation. Pictorial→abstract. Side-branch, non-gating, same as Level S4.14.

**Learning Outcome:** Child approximately places a given numeral (0–100) on a blank number line.

**Topics Covered:** Number line placement, extended.

**Common misconception:** continued logarithmic bias (over-spacing small numbers, under-spacing large ones) if this step is skipped.

**Citation:** Siegler & Booth, 2004 — shift toward linear representation emerges "by Grade 3, with appropriate instruction" (`numeracy_research_synthesis` §3.2).

---

### Level S5.19 — Skip Counting by 2s and 5s
**Class:** Class 2 | **Age Group:** 7–8 | **Strand:** Patterns

**Objective:** Count forward in jumps of 2 and of 5.

**Description:** The direct bridge into fact-fluency for the 2-times and 5-times tables. Concrete→pictorial→abstract.

**Learning Outcome:** Child correctly continues a skip-counting sequence by 2s or 5s.

**Topics Covered:** Skip counting by 2s and 5s.

**Common misconception:** treating skip-counting as an unrelated rote chant rather than repeated addition.

**Citation:** NCERT Grade 2 includes skip counting in 2s/5s/10s.

**Not yet cross-referenced:** the existing repo's Level 20 (Class 1) does skip-counting by 2s and 3s instead — different stage, different number pair. Not yet checked whether this is a meaningful mismatch or an equally valid alternative bridging into the repo's own Tables 2,3,4 sequence.

---

### *Oral/Classroom-Only Target*
**Class:** Class 2 | **Age Group:** 7–8

**Objective:** Creates/solves simple riddles with numbers & shapes.

**Description:** Same non-paper-based caution as Stage 4's poems target.

**Citation:** `FLN_foundation.md` §4.

---

## Stage 6 — Class 3 (Age 8–9) ★ NIPUN Bharat's MPL Gate

*The single most important checkpoint in the entire ladder — NIPUN Bharat's 2026–27 mission deadline is "every child reaches desired competencies by end of Grade 3." Three independent sources converge on this stage's target (see the framework document), the strongest citation confidence anywhere in this framework.*

### Level S6.1 — Place Value — 3-Digit Extension
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Sense

**Objective:** Name/interpret hundreds, tens, ones (432 = 400+30+2).

**Description:** Concrete→pictorial→abstract.

**Learning Outcome:** Child correctly decomposes a 3-digit number into hundreds, tens, and ones.

**Topics Covered:** Place value, 3-digit extension.

**Common misconception:** confusing face value and place value (the "4" in 432 means 400, not 4).

**Citation:** `numeracy_research_synthesis` §5.2, Level 3 of the worked place-value example.

---

### Level S6.2 — Place Value — Flexible 3-Digit Decomposition for Arithmetic
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Sense

**Objective:** Decompose by place and recombine (e.g. for 487+35) — understand *why* regrouping is necessary.

**Description:** Abstract.

**Learning Outcome:** Child can decompose and recombine 3-digit numbers by place to support arithmetic.

**Topics Covered:** Flexible 3-digit decomposition.

**Common misconception:** procedural carrying with no understanding of what is being "carried" (a ten, not a stray digit).

**Citation:** `numeracy_research_synthesis` §5.2, Level 4.

---

### Level S6.3 — Comparison/Ordering of 3-Digit Numbers Using Place-Value Logic
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Sense

**Objective:** Order numbers like 304, 430, 403, 340 by reasoning about hundreds first.

**Description:** Not counting or guessing — genuine place-value reasoning.

**Learning Outcome:** Child correctly orders a set of 3-digit numbers using place-value logic.

**Topics Covered:** Comparison/ordering of 3-digit numbers.

**Common misconception:** guessing/counting-based ordering instead of place-value reasoning; the "zero in the middle" confusion (does 304's zero mean "no tens," or something about the whole number's value?).

**Citation:** `numeracy_research_synthesis` §5.2, Level 5.

---

### Level S6.4 — Reading/Writing to 9999
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Sense

**Objective:** 4-digit numeral reading/writing.

**Description:** Abstract.

**Learning Outcome:** Child correctly reads and writes any number 1–9999.

**Topics Covered:** Reading/writing to 9999.

**Citation:** `FLN_foundation.md` §4; also NAS (`FLN_Assessment_Framework.md` §2).

---

### Level S6.5 — Addition/Subtraction to 999, Daily-Life Word Problems
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Operations

**Objective:** Extend Level S5.4/S5.5's carrying/borrowing into 3-digit ranges, applied to word problems.

**Description:** Abstract, applied — not just bare computation.

**Learning Outcome:** Child correctly solves 3-digit addition/subtraction word problems.

**Topics Covered:** Addition/subtraction to 999, word problems.

**Common misconception:** subtraction across a zero (e.g. 50−27) is a distinct, harder sub-case of borrowing, not the same difficulty as ordinary borrowing.

**Citation:** `Child_psychology.md` §8.8 (hard tier: "borrowing across zero").

**Empirical reality check:** ASER's 2024 data shows only 33.7% of rural Grade 3 children can do 2-digit subtraction with borrowing (up from 25.9% in 2022) — any assessment at this level should expect most students testing below this curricular target, and the level ladder needs to reach backward far enough to actually place them.

---

### Level S6.6 — Multiplication Tables 2–10
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Operations

**Objective:** Full table range, extending Level S5.8's 2/3/4-only scope.

**Description:** Abstract recall.

**Learning Outcome:** Child recalls multiplication facts for tables 2 through 10 fluently.

**Topics Covered:** Multiplication tables 2–10.

**Citation:** `FLN_foundation.md` §4.

---

### Level S6.7 — Division Facts
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Number Operations

**Objective:** Use division facts linked to the multiplication tables above.

**Description:** Not yet the full division algorithm.

**Learning Outcome:** Child correctly recalls division facts corresponding to tables 2–10.

**Topics Covered:** Division facts.

**Citation:** `FLN_foundation.md` §4.

---

### Level S6.8 — Length/Weight/Capacity — Standard Units
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Measurement

**Objective:** First introduction of true standard units (m, km, g, kg, litres).

**Description:** Resolves the "my unit ≠ your unit" gap that non-standard-uniform units (Level S5.11) still had.

**Learning Outcome:** Child correctly measures using standard units and reads standard measuring tools.

**Topics Covered:** Standard units of measurement.

**Common misconception:** reverting to non-standard estimation habits from Levels S4.9/S4.10/S5.11 instead of using the standard unit's fixed value.

**Citation:** `FLN_foundation.md` §4.

---

### Level S6.9 — Relating 2D Shapes to 3D Shapes
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Shapes & Spatial

**Objective:** Explicitly connect a 3D shape's faces to the 2D shapes that compose them.

**Description:** Concrete→pictorial. Resolves the misconception flagged at Level S4.8 (confusing a cube's face with "just a square").

**Learning Outcome:** Child correctly identifies which 2D shapes make up the faces of a given 3D shape.

**Topics Covered:** Relating 2D shapes to 3D shapes.

**Citation:** `FLN_foundation.md` §4; Van Hiele Level 2 "Informal deduction" *(citation added 2026-07-19)* — reasoning about how parts (2D faces) relate to compose a whole (3D solid) is qualitatively past Level 1's property-naming.

**Not yet cross-referenced:** part of the confirmed Shapes & Spatial gap.

---

### Level S6.10 — Clock Reading — Hours and Half-Hours
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Calendar & Time

**Objective:** First formal clock-reading.

**Description:** Calendar date/day reading carried forward from Level S5.14. Concrete→abstract.

**Learning Outcome:** Child correctly reads an analog clock to the hour and half-hour.

**Topics Covered:** Clock reading, hours and half-hours.

**Common misconception:** reading "half past" as a literal half of the hour digit rather than a position on the clock face.

**Citation:** `FLN_foundation.md` §4.

**Design decision needed:** the existing repo's Level 31 (Class 2) already tests this content, including quarter-hours, one stage earlier than proposed here. File-verified in `fln_framework_evolution_log.md`.

---

### Level S6.11 — Money Arithmetic (Rupees/Paise)
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Money

**Objective:** First arithmetic *with* money — addition/subtraction of rupee/paise amounts.

**Description:** Upgrades Level S5.9's recognition-only concept. Abstract, applied.

**Learning Outcome:** Child correctly adds and subtracts rupee/paise amounts.

**Topics Covered:** Money arithmetic.

**Common misconception:** treating rupees and paise as a single unit rather than two place-value-like components needing separate regrouping logic.

**Citation:** `numeracy_research_synthesis` §2, Grade 3 "Money" cell.

**Sourced, and matches the repo well:** the existing repo's Level 46 lands almost exactly here — see `fln_framework_evolution_log.md`.

---

### Level S6.12 — Half/One-Fourth/Three-Fourth — of a Whole and of a Collection
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Fractions

**Objective:** First *formal, numerical* fraction concept — of both a single whole (e.g. a shape) and a collection (e.g. "¼ of 12 objects").

**Description:** Concrete→pictorial→abstract.

**Learning Outcome:** Child correctly identifies half/one-fourth/three-fourth of both a shape and a collection of objects.

**Topics Covered:** Formal fractions, of a whole and of a collection.

**Common misconception:** the Level S5.10-seeded "any two pieces from a cut are halves" misconception must be explicitly corrected here — equal-sized parts is the actual defining property, not just "cut into two."

**Citation:** `FLN_foundation.md` §4; NAS (`FLN_Assessment_Framework.md` §2, "of a collection up to 12 objects").

**Design decision needed:** the existing repo's Level 45 correctly targets the equal-parts misconception (its 45.3 "Equal or Not Equal" section matches this almost exactly) but never tests the "of a collection" variant across any of its 4 sub-levels, and additionally tests thirds (⅓, ⅔), which this framework's Fractions chain doesn't cover at any stage. File-verified in `fln_framework_evolution_log.md`.

---

### Level S6.13 — Pattern Rules + Skip-Counting by 10
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Patterns

**Objective:** Identify/extend/communicate pattern rules; skip-count by 10.

**Description:** Moves from pattern *extension* (Levels S3.8–S5.19) to pattern *rule articulation* — a higher Bloom's level (Analyse, not just Apply). Abstract.

**Learning Outcome:** Child correctly states the rule governing a pattern, not just its next term, and skip-counts by 10.

**Topics Covered:** Pattern rules; skip-counting by 10.

**Citation:** `FLN_foundation.md` §4; NAS names skip-counting by 10 specifically.

---

### Level S6.14 — Tally Charts, Pictographs, Bar Graphs (Up to 4 Categories)
**Class:** Class 3 | **Age Group:** 8–9 | **Strand:** Data Handling

**Objective:** First formal data-reading — resolves Level S5.15's pre-tally object-sorting into actual chart literacy.

**Description:** Concrete→pictorial.

**Learning Outcome:** Child correctly reads and interprets tally charts, pictographs, and bar graphs with up to 4 categories.

**Topics Covered:** Tally charts, pictographs, bar graphs.

**Citation:** NAS (`FLN_Assessment_Framework.md` §2, exact "up to 4 data categories" spec).

**Sourced, and matches the repo almost verbatim:** the existing repo's Level 47 matches this target almost exactly, including the "4 categories" detail — though Level 30 (Class 2) already front-loads the tally-mark portion one stage early. See `fln_framework_evolution_log.md`.

---

## Stage 7 — Class 4 (Age 9–10)

*Unlike every stage before it, Class 4 has no NIPUN Bharat Lakshya entry — it sits outside India's foundational-numeracy statutory mandate, resting on thinner sourcing than Preschool 3–Class 3 (one primary source, not 2–3 converging ones). Worth knowing before treating any single Class-4 cell as equally certain to a Stage-6 cell.*

### Level S7.1 — Place Value — Extending to Thousands
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Sense

**Objective:** 1000 = 10 hundreds = 100 tens = 1000 ones.

**Description:** Same grouping logic as Level S6.1, extended one level. Abstract.

**Learning Outcome:** Child correctly explains the place value of thousands in a 4-digit number.

**Topics Covered:** Place value, thousands.

**Common misconception:** treating 4-digit numbers as categorically new/harder rather than a logical extension of the same tens-grouping idea already mastered.

**Citation:** `numeracy_research_synthesis` §5.2, Level 5 of the worked place-value example.

---

### Level S7.2 — Reading/Writing Large Numbers; Regrouping
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Sense

**Objective:** Extend 3-digit fluency into confident 4-digit reading/writing and regrouping.

**Description:** Abstract.

**Learning Outcome:** Child correctly reads, writes, and regroups 4-digit numbers.

**Topics Covered:** Reading/writing large numbers; regrouping.

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Number System" cell.

---

### Level S7.3 — Complex Addition/Subtraction, Carrying Across Multiple Digits
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Operations

**Objective:** Multi-step regrouping in both operations, applied to word problems.

**Description:** Abstract, applied.

**Learning Outcome:** Child correctly solves multi-digit addition/subtraction word problems requiring multiple regroupings.

**Topics Covered:** Complex addition/subtraction, multi-digit carrying.

**Citation:** `numeracy_research_synthesis` §2, Grade 4.

---

### Level S7.4 — Multiplication Tables to 15; Multi-Digit Multiplication
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Operations

**Objective:** Extends Level S6.6's 2–10 table range; introduces multi-digit multiplication up to 2-digit×2-digit.

**Description:** Abstract.

**Learning Outcome:** Child correctly multiplies up to 2-digit×2-digit numbers.

**Topics Covered:** Multiplication tables to 15 (unverified conventional scope); multi-digit multiplication (externally verified).

**Citation:** `numeracy_research_synthesis` §1.4 for the general multi-digit multiplication claim; 2-digit×2-digit scope corroborated by web search against NCERT's Class 4 syllabus and Math Magic Chapter 6. **"Tables to 15" is flagged explicitly as conventional Indian classroom scope, not a confirmed NCERT LO figure** — the framework's own round-2 review caught an earlier draft falsely claiming this had been "independently confirmed," and retracted that claim.

---

### Level S7.5 — Formal Division — 4 Methods
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Operations

**Objective:** Pictorial, equal-grouping, repeated subtraction, and the multiplication–division relationship — four distinct routes into division, not just one algorithm.

**Description:** Concrete→pictorial→abstract. First place a child is expected to connect division back to the multiplication facts already fluent from Level S6.6.

**Learning Outcome:** Child correctly solves division problems using at least two of the four named methods.

**Topics Covered:** Formal division, four methods.

**Common misconception:** treating division as unconnected to multiplication rather than its inverse.

**Citation:** `numeracy_research_synthesis` §1.4 (NCERT LO Grade 4, verbatim on the four routes).

---

### Level S7.6 — Numerical Fraction Notation + Equivalence
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Fractions

**Objective:** Represent ½, ¼, ¾ numerically; explore that differently-written fractions can be equal (e.g. 2/4 = 1/2).

**Description:** Abstract — the step following Level S6.12's concrete/pictorial fraction work.

**Learning Outcome:** Child correctly writes fractions numerically and identifies at least one equivalent pair.

**Topics Covered:** Fraction notation; equivalence.

**Common misconception:** assuming a fraction's size is judged by its denominator's size alone (e.g. thinking ¼ > ½ because 4 > 2).

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Fractions" cell; DP2.

---

### Level S7.7 — Unit Conversion (m↔cm, km↔m)
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Measurement

**Objective:** First explicit conversion between standard units.

**Description:** Abstract.

**Learning Outcome:** Child correctly converts between related standard units (e.g. 100cm = 1m).

**Topics Covered:** Unit conversion.

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Measurement — Length" cell.

**Design decision needed:** the existing repo's Level 43 (Class 3) already tests this content one stage earlier than proposed here. File-verified in `fln_framework_evolution_log.md`.

---

### Level S7.8 — Measurement Word Problems (All 4 Operations)
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Measurement

**Objective:** Apply Level S6.8's standard units inside genuine arithmetic word problems.

**Description:** Abstract, applied.

**Learning Outcome:** Child correctly solves word problems involving length/weight/capacity using all 4 operations.

**Topics Covered:** Measurement word problems.

**Citation:** `numeracy_research_synthesis` §1.4, §2.

---

### Level S7.9 — 3D Shapes — Cube, Cuboid; Nets (Introductory)
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Shapes & Spatial

**Objective:** Extend Level S6.9's "relate 2D to 3D" into unfolding a 3D shape into its 2D net.

**Description:** A harder spatial-reasoning step. Concrete→pictorial.

**Learning Outcome:** Child correctly identifies the net of a simple 3D shape (cube or cuboid).

**Topics Covered:** 3D shapes; nets (introductory).

**Citation:** `numeracy_research_synthesis` §1.4, §2.

**Not yet cross-referenced:** part of the confirmed Shapes & Spatial gap — no repo level found covering nets specifically.

---

### Level S7.10 — Hours, Minutes, Time Intervals, AM/PM
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Calendar & Time

**Objective:** Extend Level S6.10's hours/half-hours into minute-level precision and interval calculation.

**Description:** Abstract.

**Learning Outcome:** Child correctly reads a clock to the minute and calculates simple time intervals, using AM/PM correctly.

**Topics Covered:** Hours, minutes, time intervals, AM/PM.

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Time" cell.

---

### Level S7.11 — Complex Money Word Problems
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Money

**Objective:** Extend Level S6.11's rupee/paise arithmetic into multi-step applied problems.

**Description:** Abstract, applied.

**Learning Outcome:** Child correctly solves multi-step word problems involving money.

**Topics Covered:** Complex money word problems.

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Money" cell.

---

### Level S7.12 — Number Patterns, Rule Identification
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Patterns

**Objective:** Continue Level S6.13's rule-articulation work at higher complexity.

**Description:** Abstract.

**Learning Outcome:** Child correctly identifies and states the rule for a more complex number pattern.

**Topics Covered:** Number patterns, rule identification.

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Patterns" cell.

---

### Level S7.13 — Bar Graphs — Reading and Interpreting
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Data Handling

**Objective:** Extend Level S6.14's tally/pictograph work into bar-graph interpretation specifically.

**Description:** Pictorial→abstract.

**Learning Outcome:** Child correctly reads and interprets a bar graph, including comparison questions across categories.

**Topics Covered:** Bar graphs, reading and interpreting.

**Citation:** `numeracy_research_synthesis` §2, Grade 4 "Data Handling" cell.

---

### Level S7.14 — Factors & Multiples *(added 2026-07-19)*
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Operations

**Objective:** Identify factors and multiples of a number using multiplication/division facts.

**Description:** Includes common factors/multiples and the prime/composite distinction. Abstract.

**Learning Outcome:** Child correctly lists factors and multiples of a given number, and identifies common factors/multiples of two numbers.

**Topics Covered:** Factors; multiples; common factors/multiples; prime/composite.

**Common misconception:** confusing "factor of" with "multiple of" — a genuinely common, documented confusion at this age.

**Citation:** Confirmed standard CBSE Class 4 topic (2026 syllabus) — this framework's synthesis document simply hadn't captured it; not previously ungrounded content, just uncited here.

**Sourced, and matches the repo well:** the existing repo's Level 53 (Factors & Multiples) lands almost exactly here.

---

### Level S7.15 — Decimals (Introduction) *(added 2026-07-19)*
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Number Sense

**Objective:** Represent tenths and hundredths using place value and visual models.

**Description:** Reads/writes/compares simple decimals; relates decimals to money. Concrete→pictorial→abstract.

**Learning Outcome:** Child correctly reads, writes, and compares simple decimal numbers (tenths and hundredths).

**Topics Covered:** Decimal numbers; tenths; hundredths; decimal place value.

**Common misconception:** treating decimal digits like whole-number place value without the fractional meaning (e.g. reading "0.5" as "five," not "five tenths").

**Citation:** Confirmed standard CBSE Class 4 topic (2026 syllabus).

**Sourced, and matches the repo well:** the existing repo's Level 55 (Decimals) lands almost exactly here.

---

### Level S7.16 — Angles *(added 2026-07-19)*
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Shapes & Spatial

**Objective:** Identify, compare, and classify acute/right/obtuse/straight angles.

**Description:** Includes introductory protractor use. Concrete→pictorial.

**Learning Outcome:** Child correctly identifies and classifies the four named angle types.

**Topics Covered:** Angles; angle types; introductory measurement.

**Common misconception:** judging angle size by the length of the drawn rays rather than the amount of rotation between them.

**Citation:** Confirmed standard CBSE Class 4 topic (2026 syllabus, within Geometry); plausibly extends Van Hiele Level 1's property-based reasoning (S4.8) to a new shape attribute, though this specific connection hasn't been independently verified against a Van Hiele-specific source — kept as a sequence-only link in `fln_level_networks.md`, not a claimed prereq.

**Sourced, and matches the repo well:** the existing repo's Level 57 (Angles) lands almost exactly here.

---

### Level S7.17 — Symmetry & Reflection *(added 2026-07-19)*
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Shapes & Spatial

**Objective:** Identify lines of symmetry, complete symmetrical figures, recognize reflection.

**Description:** Concrete→pictorial.

**Learning Outcome:** Child correctly identifies symmetrical figures, draws a line of symmetry, and completes a missing symmetrical half.

**Topics Covered:** Symmetry; line of symmetry; reflection; mirror images.

**Common misconception:** assuming any fold line creates symmetry, rather than requiring the two halves to be true mirror images.

**Citation:** NCERT's newer "Maths Mela" Class 4 textbook (replacing the outgoing Math Magic series this framework's other citations are built on) — Chapter 11, "Fun with Symmetry."

**Sourced, and matches the repo well:** the existing repo's Level 58 (Symmetry & Reflection) lands almost exactly here.

---

### Level S7.18 — Perimeter & Area *(resolved 2026-07-19 — was a flagged gap, not a node, until now)*
**Class:** Class 4 | **Age Group:** 9–10 | **Strand:** Measurement

**Objective:** Calculate perimeter by adding side lengths; calculate area of rectangles/squares by counting square units and applying the length×width formula.

**Description:** Distinguishes the two concepts explicitly. Concrete→pictorial→abstract.

**Learning Outcome:** Child correctly calculates both perimeter and area of simple rectangles/squares and explains the difference between them.

**Topics Covered:** Perimeter; area; square units.

**Common misconception:** confusing perimeter (distance around) with area (space inside), especially when both use the same side-length inputs.

**Citation:** GPF's Grade 4 standard names "perimeter" explicitly (`FLN_Assessment_Framework.md` §5); NCERT's actual Class 4 Math Magic textbook covers both in its "Fields and Fences" (perimeter) and tiling-pattern (informal area) chapters. Neither `numeracy_research_synthesis`'s NCERT LO summary nor its topic map mentioned this — a citation gap now closed, not a claim that the content itself was ever missing from real classrooms.

**Sourced, and matches the repo well:** the existing repo's Level 56 (Area & Perimeter) confirms this content genuinely is taught — this is the one node in this whole document that started as a flagged gap and is now fully resolved with a citation trail, not just a repo confirmation.

---

## Summary — Level Count by Stage

| Stage | Levels (testable) | Non-testable (oral) |
|---|---|---|
| 1 — Preschool 1 | 7 (S1.1–S1.7) | 0 |
| 2 — Preschool 2 | 10 (S2.1–S2.10) | 0 |
| 3 — Preschool 3 / Balvatika | 10 (S3.1–S3.10) | 0 |
| 4 — Class 1 | 15 (S4.1–S4.15) | 1 (poems) |
| 5 — Class 2 | 19 (S5.1–S5.19) | 1 (riddles) |
| 6 — Class 3 ★ MPL | 14 (S6.1–S6.14) | 0 |
| 7 — Class 4 | 18 (S7.1–S7.18) | 0 |
| **Total** | **93** | **2** |

**This count is not fixed** — it grew from 85 to 93 on 2026-07-19 after targeted research closed most of the gaps the repo comparison surfaced (see `fln_framework_evolution_log.md`'s research-round entry and the companion documents' own Round-4 appendix notes). Expect it to keep changing as research continues; this document does not aim for a final, stable number.

**One level in the existing repo still has no corresponding entry above** (Maps & Directions, Class 4) — confirmed via research to be standard Social Studies/Geography curriculum content, not Mathematics, consistent with this framework's own "Mathematics only" scope. Not added as a framework node; left as an open product-scope question for the platform team (does a math-only platform intentionally include this as cross-curricular content?), not resolved here either way.
