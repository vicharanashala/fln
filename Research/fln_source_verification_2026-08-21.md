# Source Verification of the Research Folder — 2026-08-21

**Why this exists.** Every file in `Research/` was written without a single citable link — 12 files, ~4,000 lines, zero URLs. Several of them are load-bearing: the level framework, the level network, and the proposed level structure all rest on claims made in these files. This document checks those claims against the primary literature and records the verdict for each one.

**The standing rule this establishes:** nothing in `Research/` is a standard on its own authority. Where a file is correct, it is correct because an external source is correct, and that source should be cited directly. Where no source exists, the claim is a working convention and must be labelled as one.

**Method.** For each load-bearing claim: locate the primary source, confirm author / year / venue / page range where applicable, and record one of four verdicts — **Verified**, **Contested**, **Unsupported**, or **Contradicted**. Claims that could not be resolved are recorded as **Unverified** rather than quietly accepted.

---

## 1. Verified primary sources

These are now confirmed and may be cited directly.

| Source | Full reference | What it grounds |
|---|---|---|
| Knowledge Space Theory | Doignon, J.-P. & Falmagne, J.-Cl. (1985). "Spaces for the assessment of knowledge." *International Journal of Man-Machine Studies*, 23(2), 175–196. | The surmise relation — the rule deciding whether an edge is a genuine prerequisite |
| Learning Spaces | Falmagne, J.-C. & Doignon, J.-P. (2011). *Learning Spaces*. Springer, Interdisciplinary Applied Mathematics. | The formal treatment; the book itself names ALEKS as its example application |
| Bayesian Knowledge Tracing | Corbett, A. T. & Anderson, J. R. (1995). "Knowledge tracing: Modeling the acquisition of procedural knowledge." *User Modeling and User-Adapted Interaction*, 4, 253–278. | Guess and slip parameters — why a single response is not proof of mastery |
| Probabilistic knowledge structures | The Basic Local Independence Model (BLIM), Falmagne & Doignon — lucky-guess and careless-error rates attached to knowledge states | The statistical layer for the level-revision feedback loop |
| Graph-based Knowledge Tracing | Nakagawa, H., Iwasawa, Y. & Matsuo, Y. (2019). "Graph-based Knowledge Tracing: Modeling Student Proficiency Using Graph Neural Networks." IEEE/WIC/ACM Int. Conf. on Web Intelligence. | The closest published architecture to this platform's; its stated weakness — "requires an accurate prerequisite graph" — is the justification for the edge work |
| Procedural bugs in arithmetic | Brown, J. S. & Burton, R. B. (1978). "Diagnostic Models for Procedural Bugs in Basic Mathematical Skills." *Cognitive Science*, 2, 155–192. | The subtraction error patterns in `Child_psychology.md` §8.8–8.9 |
| Cross-linguistic number naming | Miller, K., Smith, C., Zhu, J. & Zhang, H. — preschool origins of cross-national differences in mathematical competence; Miller & Stigler, "Counting in Chinese" (1987) | Teen-number irregularity in `Child_psychology.md` §8.3 |
| Learning styles | Pashler, H., McDaniel, M., Rohrer, D. & Bjork, R. (2008). "Learning Styles: Concepts and Evidence." *Psychological Science in the Public Interest*. | **Refutes** `Child_psychology.md` §5 |
| NIPUN Bharat | Ministry of Education, Government of India. Launched 5 July 2021; FLN for every child by end of Grade 3 by 2026-27. | Stage targets |
| Foundational Learning Study 2022 | NCERT, March 2022. ~86,000 Grade 3 students, 10,000 schools, 20 languages. | Numeracy subtask taxonomy; national benchmark |
| Foundational Stage competencies | Meghalaya SSA / Education Department, *Key Competencies & Learning Outcomes, Foundational Stage*, June 2023 — a **state** adaptation of the national framework, not the national document | Per-year preschool outcomes |

### On ALEKS

`ALEKS_case_studies.md` contains no citation of any kind. Its description of the product is consistent with the public record — ALEKS was built at UC Irvine under Jean-Claude Falmagne with major NSF funding, licensed out in 1997, acquired by McGraw Hill in 2013, and Falmagne's Knowledge Space Theory work spans NYU and UC Irvine with Doignon at Université Libre de Bruxelles. So the file's provenance claim is substantially correct; it was simply never sourced.

**But ALEKS is a commercial implementation of Knowledge Space Theory, not its source.** Cite Doignon & Falmagne for the theory. ALEKS may be cited only as an existence proof that the approach works at scale in a shipped product.

**The "20–25 questions suffice" claim in §5 must not be used to justify paper length.** It is a vendor performance claim with no study behind it, and it depends on *within-session adaptivity* — choosing each question after seeing the answer to the previous one. A printed paper is fixed before the child starts, so the number does not transfer. The file's own §10 already records this difference. Paper length must instead be derived from the prerequisite graph (apex selection).

---

## 2. Per-file verdicts

### `Child_psychology.md`

| § | Claim | Verdict |
|---|---|---|
| 5 | Learning styles; "majority of children prefer visual learning" | **Contradicted** — Pashler et al. (2008) reviewed 70+ studies and found no credible support for the meshing hypothesis |
| 1 | "Over 85% of brain development occurs before age 6" | **Contested** — traceable to NEP 2020, but derived from brain *size* measurement and subject to substantial critique. Usable as motivation, not as a design basis |
| 8.2 | 50/35/15 easy/moderate/hard ratio | **Unsupported** — no published standard. Retain as a labelled convention |
| 8.7 | "Per Piagetian theory, Yes/No questions are easy" | **Misattributed** — the reasoning (recognition vs. recall, 50% guess rate) is psychometrics, not Piaget |
| 8.3 | Teen numbers irregular and harder | **Verified** — Miller et al. |
| 8.8–8.9 | Subtraction bugs and error taxonomy | **Verified** — Brown & Burton (1978) |
| 9 | Piaget, comparison-first | **Citation garbled** — the 1941 date belongs to the French original *La genèse du nombre chez l'enfant*; *The Child's Conception of Number* is the 1952 English translation |

**On §5, separate two tangled claims.** That children have modality preferences and should be taught to them is unsupported and should not be built into the platform — the specific risk is a personalised-worksheet system classifying a child as a "visual learner" and serving them different papers. That children process `🍎🍎🍎 + 🍎🍎` more easily than `3 + 2` is **well supported**, but because concrete representation reduces symbolic abstraction and reading load in children who cannot yet decode numerals. Keep the practice; change the justification.

**On §8.2, a design note.** A fixed easy/moderate/hard spread may be the wrong instrument for a *diagnostic*, whose job is to locate a child's threshold precisely and therefore to concentrate items near it. The ratio is better suited to practice worksheets, where confidence matters.

### `FLN_foundation.md`

**Verified against the primary source**, including the stage targets that anchor the framework: Grade 1 — numbers to 99; Grade 2 — to 999; Grade 3 — to 9999; Balvatika — numerals to 10 and arranging in sequence; the 2026-27 target year; and the definition of foundational numeracy, reproduced almost verbatim.

**One correction.** §3 reduces the official definition to "number sense and spatial understanding." The source names **four** components: *Numbers and operations on numbers; Shapes and Spatial Understanding; Measurement; Data Handling.* Measurement and Data Handling are first-class components of foundational numeracy, not peripheral topics — which bears directly on how thin Chains E and J currently are.

### `FLN_Assessment_Framework.md`

The strongest file in the folder. FLS 2022 scale, the nine numeracy subtasks, and the proficiency bands all check out — the band breakdown reconciles exactly with the official finding that 48% of Grade 3 learners fell below global proficiency in numeracy.

- **Suspect:** the state-level passage ("Only Lakshadweep met global minimum proficiency… top performers Jharkhand, Daman & Diu, Tripura") could not be confirmed and reads as internally inconsistent. In PARAKH 2024 those same states rank at the *bottom* in Grade 3 mathematics. Different study, so not a direct contradiction — but do not repeat this passage without the FLS report itself.
- **Stale:** §5, §7 and §8 argue that India's most recent Grade 5 data is from 2017 and that no SDG 4.1.1 data has been reported in 4+ years. **PARAKH 2024 was released in July 2025** (Grade 3 mathematics national average 60%). The data-gap argument is roughly a year out of date and should not be used in a proposal as written.

### `Assessment_paper_rubric.md`

**Unsourced.** Line 3 reads `**Resources:** link_1, link_2` — placeholder text never replaced. The learning outcomes themselves are traceable to the verified NIPUN Bharat targets, but the weightages and Bloom's-level assignments are unsourced judgement calls presented as a blueprint.

**Off-by-one hazard.** The section headed "Class 2: Baseline Test — Foundational Numeracy, Class 2 (Age 6–7)" contains NIPUN's **Class 1** targets, and age 6–7 is Class 1. This is deliberate — a baseline test covers the previous year's syllabus — but the age label describes the *content's* age, not the test-taker's, and read literally it shifts a grade.

### `Class_2_Adaptive_Question_Progression_Levels_1_to_10.md`

**Honest competitive observation, correctly labelled.** It separates observation from interpretation, states its limitations (two performance paths only; internal logic not visible), preserves inconsistencies rather than smoothing them, and explicitly calls its algorithm description "an analytical interpretation… not a confirmed specification."

It is not pedagogical evidence and does not claim to be; it must not be used as a design authority. Its useful finding: the observed system is a mistake-driven remediation and mastery-gating engine, not a probabilistic adaptive engine — the same pattern as this platform's intended worksheet-bundle behaviour.

---

## 3. Findings that change the framework

### The counting spine is externally corroborated

The Foundational Stage competencies document specifies numeracy outcomes per year. Against Chain B:

| Stage | Official document | Framework |
|---|---|---|
| Preschool 1 | Counts to three | S1.5 — counting 1–3 with support |
| Preschool 2 | Numerals up to 5 | S2.4 — counting to 5 with cardinality |
| Preschool 3 | Counts to 10 objects | S2.5 / S3.1 |
| Class 1 | Counts objects up to 20 | S4.3 |
| Class 2 | Numbers up to 999 | S5.1 |
| Class 3 | Up to 9999 using place value | S6.4 |

Six for six. This progression was built by backward construction from the Balvatika endpoint and lands on the officially specified sequence. The same document annotates its one-to-one correspondence row "LEADS TO DEVELOPMENT OF NUMBER SENSE" — the Chain A → Chain B hand-off, stated in an official document.

### The Preschool 1/2 caveat in `fln_framework_from_scratch.md` is too strong

That document states Preschool 1 and 2 are "not independently government-specified" and were "backward-constructed." The Foundational Stage competencies document specifies **all three preschool years separately**, with distinct itemised outcomes. The caveat should be softened accordingly.

### The four orphan chains split two ways, not four

The Foundational Stage maths domains are: Concept Formation, Number Sense, Number Operations, Measurement, Shapes, **Data Handling**, **Pattern**, **Calendar Activity**, Use of Technology.

- **Money (Chain G) and Fractions (Chain I) are not foundational-stage domains at all.** Their late start at Stage 5 is **defensible, not a gap.**
- **Data Handling (Chain J) and Calendar & Time (Chain H) are explicitly named domains**, yet both begin at Stage 5 with three nodes and no precursor. These are **genuine gaps**.

### "Balvatika" — RESOLVED against a Ministry of Education primary source

**Resolved 2026-08-21.** The Ministry of Education's own *Lakshya/Targets* poster series labels its stages:

> **Balvatika or Age 5-6** · **Class I or age 6-7** · **Class II or age 7-8** · **Class III or age 8-9**

Balvatika is therefore **age 5–6, the stage before Class I** — this framework's reading, now confirmed against a national Ministry document rather than a state adaptation. Stage 3 = Balvatika (5–6), Stage 4 = Class 1 (6–7), Stage 5 = Class 2 (7–8), Stage 6 = Class 3 (8–9) all match the Ministry's own labels exactly.

Two further points follow from that wording:

- **The Ministry treats grade and age as interchangeable labels for the same target** ("Class I *or* age 6-7"). They diverge only in practice, where over-age and under-age enrolment is common — which is the platform's own premise for assessing level rather than grade.
- **There is one Balvatika target nationally, not three.** The national Lakshya has no Balvatika 1/2/3 split. Everything before Grade 1 is a single band.

*(Retained for context: the state adaptation checked earlier does contradict itself — Development Goal 1 heads a column `Class 1 (BALVATIKA)` while its mathematics section heads it `PRESCHOOL 3 (BALVATIKA)`. The national document settles which is right.)*

### Original ambiguity as found

The Foundational Stage document contradicts itself: Development Goal 1 heads its column `Class 1 (BALVATIKA)`, while the mathematics section heads it `PRESCHOOL 3 (BALVATIKA)`. The national NIPUN table treats Balvatika as its own stage before Grade 1.

The mathematics section agrees with this framework (Stage 3 = Preschool 3 = Balvatika = age 5–6). **This must be pinned down explicitly in the grade-mapping work**, because reading Balvatika as Class 1 shifts every stage by a year.

### Language: two separate problems, not one

**Problem 1 — literacy load on the page.** A child who cannot read the question cannot answer it, however good their numeracy. Foundational literacy and numeracy are coupled, and a text-heavy paper measures reading as much as arithmetic.

**This is already handled by design decision:** papers are to be built with the least text possible, carrying meaning through objects and layout rather than sentences. That decision has independent support — the visual-worksheet evidence in the team's own research notes found that visuals help precisely because they reduce dependence on reading, and most strongly on the *harder* problem types.

**Problem 2 — number naming, which minimal text does not solve.** Miller et al.'s finding is about **verbal counting**, not reading. A child counting seventeen objects sub-vocalises the count sequence in their own language regardless of how little text is printed. Removing text from the page does not remove the naming effect, because the effect operates on the child's internal count sequence.

Two consequences for this framework:

- **The teen-confusion examples in `Child_psychology.md` §8.3 are English-specific.** "13 vs 30, 15 vs 50" are confusable in English; तेरह and तीस are not confusable the same way. That difficulty note must not be applied universally across languages of instruction.
- **Transparent number naming assists place value, and Hindi is opaque.** Chinese "ten-one" makes base-ten structure audible; Hindi "gyarah" does not. The place-value nodes (S4.5, S5.2, S6.1) may therefore be relatively harder for children in some mother tongues than the framework's uniform sequencing assumes.

### Vernacular-medium assessment — a missing product requirement

Separate from both of the above, and more consequential than either.

NIPUN Bharat mandates mother-tongue instruction, and **FLS 2022 was administered in 20 languages** — that is the national benchmark for how a foundational assessment is conducted in India. An English-only paper administered to a mother-tongue-medium child measures English comprehension alongside numeracy, which is a **validity** problem, not only an equity one.

Staged requirement, in the order it should be built:

1. **Now** — minimise text on every paper; carry meaning through objects, layout and worked examples so that what is being asked is understood without reading a sentence.
2. **Now** — instructions in English, since the alternative delays everything, but explicitly recorded as an interim position and not a final one.
3. **Planned** — vernacular-medium instruction sets, with FLS 2022's 20 languages as the benchmark to work toward. This should be in the platform's roadmap, not discovered later during a field deployment.

Nothing in the framework, the SRS or the PRD currently records this requirement.

---

## 4. Still unverified

- The detailed per-stage NIPUN Bharat targets beyond the headline Lakshya (3D shape properties, non-standard units, tables, calendar and clock, fractions, patterns). The national guidelines PDF at `education.gov.in` returns HTTP 403; the state document corroborates the shape of the progression but is not the national standard.
- The FLS 2022 state-level results.
- Whether the national NCERT Foundational Stage document specifies the three preschool years the same way the Meghalaya adaptation does.
