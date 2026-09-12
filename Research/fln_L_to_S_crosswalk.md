# L ↔ S Crosswalk — the two level graphs reconciled

**Built 2026-08-21.** The project has two graphs of the same 93 levels and no mapping between them:

- **S-notation** (`S1.1`–`S7.18`) — the research documents: `fln_proposed_levels.md`, `fln_level_networks.md`.
- **L-notation** (`L1`–`L93`) — the code: `frontend/src/data/skillProgressionMap.ts`, and the spec at `docs/skill-graph/`.

This document is the crosswalk. It also compares the two edge sets, which turn out to disagree substantially.

---

## 1. The node mapping is deterministic

L-notation is the **sequential flattening of S-notation**. Stage sizes match exactly — 7 / 10 / 10 / 15 / 19 / 14 / 18 = 93 — and `stageFor()` in the code uses the identical boundaries (≤7, ≤17, ≤27, ≤42, ≤61, ≤75, else).

So `L(n)` is the *n*-th S-code in stage-then-index order. **No judgement is involved; the mapping is computable and total.**

| L | S | Stage | Capability (code) | Level (research docs) |
|---|---|---|---|---|
| `L1` | `S1.1` | Bal Vatika (Pre-school 1) | One-to-One Correspondence | One-to-One Correspondence |
| `L2` | `S1.2` | Bal Vatika (Pre-school 1) | Classification (Single Property) | Classification (Single Property) |
| `L3` | `S1.3` | Bal Vatika (Pre-school 1) | Perceptual Same/Different | Perceptual Same/Different |
| `L4` | `S1.4` | Bal Vatika (Pre-school 1) | Rote Verbal Counting to 10 | Rote Verbal Counting to 10 |
| `L5` | `S1.5` | Bal Vatika (Pre-school 1) | Counting Small Sets (1-3) | Counting Small Sets (1–3) with Support |
| `L6` | `S1.6` | Bal Vatika (Pre-school 1) | Shape Matching (Perceptual) | Shape Matching (Perceptual) |
| `L7` | `S1.7` | Bal Vatika (Pre-school 1) | Perceptual Subitizing | Perceptual Subitizing |
| `L8` | `S2.1` | Bal Vatika (Pre-school 2) | Quantity Comparison | Quantity Comparison (More/Less/Equal) |
| `L9` | `S2.2` | Bal Vatika (Pre-school 2) | Seriation (3 Objects) | Seriation (3 Objects) |
| `L10` | `S2.3` | Bal Vatika (Pre-school 2) | Classification (Increasing Complexity) | Classification (Increasing Complexity) |
| `L11` | `S2.4` | Bal Vatika (Pre-school 2) | Counting to 5 (Cardinality) | Counting to 5 with Cardinality |
| `L12` | `S2.5` | Bal Vatika (Pre-school 2) | Counting 6-10 | Counting 6–10 with Support |
| `L13` | `S2.6` | Bal Vatika (Pre-school 2) | Shape Identification | Shape Identification (Named) |
| `L14` | `S2.7` | Bal Vatika (Pre-school 2) | 2-Item Patterns | Simple Repeating Pattern (2-Item) |
| `L15` | `S2.8` | Bal Vatika (Pre-school 2) | Comparative Vocabulary | Comparative Vocabulary (Informal) |
| `L16` | `S2.9` | Bal Vatika (Pre-school 2) | Conceptual Subitizing | Conceptual Subitizing |
| `L17` | `S2.10` | Bal Vatika (Pre-school 2) | Basic Shape Composition | Shape Composition: Piece Assembly |
| `L18` | `S3.1` | Bal Vatika (Pre-school 3) | Numeral Recognition (1-10) | Numeral Recognition (1–10) |
| `L19` | `S3.2` | Bal Vatika (Pre-school 3) | Numeral-Quantity Correspondence | Numeral–Quantity Correspondence |
| `L20` | `S3.3` | Bal Vatika (Pre-school 3) | Numeral Comparison (Object-Mediated) | Numeral Comparison (Object-Mediated) |
| `L21` | `S3.4` | Bal Vatika (Pre-school 3) | Seriation with Transitivity | Seriation with Transitivity |
| `L22` | `S3.5` | Bal Vatika (Pre-school 3) | Flexible Classification | Classification (Flexible) |
| `L23` | `S3.6` | Bal Vatika (Pre-school 3) | Numeral Sequencing | Sequencing (Arranges by Sequence) |
| `L24` | `S3.7` | Bal Vatika (Pre-school 3) | Comparative Vocabulary (Formalizing) | Comparative Vocabulary (Formalizing) |
| `L25` | `S3.8` | Bal Vatika (Pre-school 3) | Patterns (2-Item Indep & 3-Item Intro) | Patterns (2-Item Independent + 3-Item Introduction) |
| `L26` | `S3.9` | Bal Vatika (Pre-school 3) | Basic Shape Properties | Shape Properties (Basic) |
| `L27` | `S3.10` | Bal Vatika (Pre-school 3) | Shape Composition & Decomposition | Shape Composition: Picture Making ⚠ |
| `L28` | `S4.1` | Class 1 | Abstract Numeral Comparison | Numeral Comparison — Fully Abstract |
| `L29` | `S4.2` | Class 1 | Close Numeral Comparison | Numeral Comparison — Close Values |
| `L30` | `S4.3` | Class 1 | Counting Objects to 20 | Counting Objects to 20 |
| `L31` | `S4.4` | Class 1 | Reading & Writing Numerals to 99 | Reading/Writing Numbers to 99 |
| `L32` | `S4.5` | Class 1 | Tens and Ones | Place Value — Face Value Only (Pre-Conceptual) ⚠ |
| `L33` | `S4.6` | Class 1 | Single-Digit Addition | Addition to 9 (Concrete → Abstract) |
| `L34` | `S4.7` | Class 1 | Single-Digit Subtraction | Subtraction to 9 (Concrete → Abstract) |
| `L35` | `S4.8` | Class 1 | 3D Shape Properties | 3D Shape Properties |
| `L36` | `S4.9` | Class 1 | Non-Standard Length Estimation | Length Estimation (Non-Standard Units) |
| `L37` | `S4.10` | Class 1 | Non-Standard Capacity Estimation | Capacity Estimation (Non-Standard Units) |
| `L38` | `S4.11` | Class 1 | 3-Item Pattern Completion | Patterns, 3-Item Repeating Cycle (Independent) |
| `L39` | `S4.12` | Class 1 | Concept of Zero | Zero, as "None"/Empty Set |
| `L40` | `S4.13` | Class 1 | Ordinal Positions (1st-10th) | Ordinal Numbers |
| `L41` | `S4.14` | Class 1 | Informal Number Line (0-20) | Number Line Placement (Informal, 0–20) |
| `L42` | `S4.15` | Class 1 | Advanced Shape Composition | Shape Composition & Decomposition |
| `L43` | `S5.1` | Class 2 | Reading & Writing 3-Digit Numbers | Reading/Writing Numbers to 999 |
| `L44` | `S5.2` | Class 2 | Tens as Bundles/Groups | Place Value — Tens as Groups (Unitising) |
| `L45` | `S5.3` | Class 2 | Flexible 2-Digit Decomposition | Flexible Decomposition of 2-Digit Numbers |
| `L46` | `S5.4` | Class 2 | 2-Digit Addition with Regrouping | Addition to 99, with Carrying |
| `L47` | `S5.5` | Class 2 | 2-Digit Subtraction with Regrouping | Subtraction to 99, Introducing Borrowing |
| `L48` | `S5.6` | Class 2 | Multiplication as Repeated Addition | Multiplication as Repeated Addition |
| `L49` | `S5.7` | Class 2 | Division as Equal Sharing | Division as Equal Sharing |
| `L50` | `S5.8` | Class 2 | Multiplication Tables (2,3,4,5,10) | Multiplication Tables 2, 3, 4 |
| `L51` | `S5.9` | Class 2 | Currency Recognition | Currency Recognition (Informal) |
| `L52` | `S5.10` | Class 2 | Informal Fractions (Folding) | Informal Fractions via Folding |
| `L53` | `S5.11` | Class 2 | Uniform Non-Standard Measurement | Length/Capacity, Non-Standard *Uniform* Units |
| `L54` | `S5.12` | Class 2 | 2D Shape Set Identification | 2D Shape Identification (Named Set) |
| `L55` | `S5.13` | Class 2 | Spatial Vocabulary | Spatial Vocabulary |
| `L56` | `S5.14` | Class 2 | Calendar Reading | Calendar, Days/Months |
| `L57` | `S5.15` | Class 2 | Data Handling (Sorting & Tallies) | Object/Picture Sorting ⚠ |
| `L58` | `S5.16` | Class 2 | Number Patterns & Sequences | Number-Sequence Patterns |
| `L59` | `S5.17` | Class 2 | Zero as a Placeholder | Zero, as Place-Value Placeholder |
| `L60` | `S5.18` | Class 2 | Extended Number Line (0-100) | Number Line Placement, Extended (0–100) |
| `L61` | `S5.19` | Class 2 | Skip Counting (2s, 5s, 10s) | Skip Counting by 2s and 5s ⚠ |
| `L62` | `S6.1` | Class 3 | 3-Digit Place Value & Expanded Form | Place Value — 3-Digit Extension |
| `L63` | `S6.2` | Class 3 | Flexible 3-Digit Decomposition | Place Value — Flexible 3-Digit Decomposition for Arithmetic |
| `L64` | `S6.3` | Class 3 | 3-Digit Comparison & Ordering | Comparison/Ordering of 3-Digit Numbers Using Place-Value Logic |
| `L65` | `S6.4` | Class 3 | Reading & Writing 4-Digit Numbers | Reading/Writing to 9999 |
| `L66` | `S6.5` | Class 3 | 3-Digit Addition & Subtraction Problems | Addition/Subtraction to 999, Daily-Life Word Problems |
| `L67` | `S6.6` | Class 3 | Full Multiplication Tables (2-10) | Multiplication Tables 2–10 |
| `L68` | `S6.7` | Class 3 | Division Facts & Inverse Relation | Division Facts |
| `L69` | `S6.8` | Class 3 | Standard Measurement Units | Length/Weight/Capacity — Standard Units |
| `L70` | `S6.9` | Class 3 | Relating 2D Faces to 3D Solids | Relating 2D Shapes to 3D Shapes |
| `L71` | `S6.10` | Class 3 | Telling Time (Hours & Half-Hours) | Clock Reading — Hours and Half-Hours |
| `L72` | `S6.11` | Class 3 | Money Arithmetic | Money Arithmetic (Rupees/Paise) |
| `L73` | `S6.12` | Class 3 | Formal Fractions (Half/Quarter) | Half/One-Fourth/Three-Fourth — of a Whole and of a Collection ⚠ |
| `L74` | `S6.13` | Class 3 | Pattern Rules & Generalization | Pattern Rules + Skip-Counting by 10 |
| `L75` | `S6.14` | Class 3 | Data Handling (Pictographs & Bar Graphs) | Tally Charts, Pictographs, Bar Graphs (Up to 4 Categories) |
| `L76` | `S7.1` | Class 4 | 4-Digit & 5-Digit Place Value | Place Value — Extending to Thousands ⚠ |
| `L77` | `S7.2` | Class 4 | Large Number Operations & Regrouping | Reading/Writing Large Numbers; Regrouping |
| `L78` | `S7.3` | Class 4 | Complex Multi-Digit Word Problems | Complex Addition/Subtraction, Carrying Across Multiple Digits |
| `L79` | `S7.4` | Class 4 | Extended Multiplication | Multiplication Tables to 15; Multi-Digit Multiplication |
| `L80` | `S7.5` | Class 4 | Formal Long Division | Formal Division — 4 Methods |
| `L81` | `S7.6` | Class 4 | Fractional Notation & Equivalence | Numerical Fraction Notation + Equivalence |
| `L82` | `S7.7` | Class 4 | Standard Unit Conversion | Unit Conversion (m↔cm, km↔m) |
| `L83` | `S7.8` | Class 4 | Applied Measurement Word Problems | Measurement Word Problems (All 4 Operations) |
| `L84` | `S7.9` | Class 4 | 3D Nets & Spatial Perspective | 3D Shapes — Cube, Cuboid; Nets (Introductory) ⚠ |
| `L85` | `S7.10` | Class 4 | Advanced Time Calculation | Hours, Minutes, Time Intervals, AM/PM |
| `L86` | `S7.11` | Class 4 | Complex Money Problems | Complex Money Word Problems |
| `L87` | `S7.12` | Class 4 | Advanced Number Patterns | Number Patterns, Rule Identification |
| `L88` | `S7.13` | Class 4 | Bar Graphs & Data Interpretation | Bar Graphs — Reading and Interpreting |
| `L89` | `S7.14` | Class 4 | Factors & Multiples | Factors & Multiples |
| `L90` | `S7.15` | Class 4 | Decimals (Tenths & Hundredths) | Decimals (Introduction) |
| `L91` | `S7.16` | Class 4 | Angles & Turn | Angles |
| `L92` | `S7.17` | Class 4 | Symmetry & Reflection | Symmetry & Reflection |
| `L93` | `S7.18` | Class 4 | Perimeter & Area | Perimeter & Area |

---

## 2. Seven places where the two disagree on *content*, not just wording

Most name differences are paraphrase. These seven are genuine scope differences and need a decision.

- **`S4.5` vs L32 &ldquo;Tens and Ones&rdquo;** — The framework node is deliberately **face value only, pre-conceptual** — grouping into tens is a *Class 2* concept (S5.2, Tens as Groups/Unitising). The code's name implies unitising already at Class 1.
- **`S5.15` vs L57 &ldquo;Data Handling (Sorting & Tallies)&rdquo;** — Code adds **tally marks at Class 2**; the framework places tally charts at S6.14 (Class 3).
- **`S5.19` vs L61 &ldquo;Skip Counting (2s, 5s, 10s)&rdquo;** — Code adds **10s at Class 2**; the framework places skip-counting by 10 at S6.13 (Class 3).
- **`S6.12` vs L73 &ldquo;Formal Fractions (Half/Quarter)&rdquo;** — Code **drops three-fourths and the &lsquo;of a collection&rsquo; variant**. That variant was a specifically flagged gap in the earlier repo comparison, and NAS names it explicitly.
- **`S7.1` vs L76 &ldquo;4-Digit & 5-Digit Place Value&rdquo;** — Code adds **5-digit**. NIPUN's Class 3 target stops at 9999.
- **`S7.9` vs L84 &ldquo;3D Nets & Spatial Perspective&rdquo;** — Code adds **spatial perspective**; the framework has nets as *introductory* only.
- **`S3.10` vs L27 &ldquo;Shape Composition & Decomposition&rdquo;** — The code's name for L27 is the framework's name for **S4.15** (one level higher). The shape-composition sub-strand labels look shifted by one.

---

## 3. The edge sets disagree substantially

Translating the code's prerequisites into S-space:

| | Count |
|---|---|
| Edges in the research documents | 104 |
| Edges in the code (translated) | 124 |
| **Both agree the edge exists** | **58** |
| Only in the research documents | 46 |
| Only in the code | 66 |
| Of the 58 shared, **type disagreements** | **28** |

The two graphs agree on fewer than half the edges either of them asserts. **They would not produce the same diagnostic paper.**

### The most consequential single disagreement

`S3.3 → S4.1` — object-mediated numeral comparison into fully abstract comparison. The research documents type this as a **hard prerequisite**; it is the single most load-bearing cross-chain edge in the graph and the one the Level-10 finding turned on. **The code types it `often_precedes` — a soft relation.** Under the code's typing, passing S4.1 would not license inferring S3.3, and apex selection would return a different (larger) test set.

A direct contradiction in the other direction: `S1.4 → S1.5` is **co-occurring** in the documents but **`required_for_procedure`** in the code.

### Why the counts differ

The code records only one `relationshipType` per level, applied to *all* of that level's prerequisites, whereas the research graph types each edge individually. That alone explains part of the divergence and is worth fixing on the code side — a level with two prerequisites of genuinely different strength cannot currently be expressed.

---

## 4. What to do with this

1. **Adopt one notation.** These IDs will carry response data indefinitely; renaming later orphans the history. The mapping is deterministic either way, so this is a naming decision, not a research one.
2. **Reconcile the edges before the diagnostic ships.** 58 of ~150 agreement is not a detail — the apex set, and therefore the printed paper, depends on which graph is right.
3. **Let the code express per-edge types**, as the research graph does.
4. **Settle the seven content divergences in §2**, several of which move a concept a full year.

---

## 5. Per-level differences (data for review)

Machine-readable: `fln_L_vs_S_per_level.csv` (all 93 rows, every column).

| Status | Levels |
|---|---|
| Clean — no difference at all | **13** |
| Different prerequisite *set* only | 52 |
| Different prerequisite *type* only | 20 |
| Both set and type differ | 6 |
| Strand assignment also differs | 2 |
| **Total** | **93** |

**Only 13 of 93 levels are identical across the two graphs.**

### 5.1 Strand disagreements — 2 levels

Both are the same underlying question: *does comparison belong to Pre-Number or to Number Sense?*

| L | S | Capability | Code says | Docs say |
|---|---|---|---|---|
| `L8` | `S2.1` | Quantity Comparison | SK09 → Number Sense | Pre-Number |
| `L20` | `S3.3` | Numeral Comparison (Object-Mediated) | SK09 → Number Sense | Pre-Number |

This is the Chain A → Chain B boundary. The framework places comparison in Pre-Number on Piaget's comparison-first principle; the code assigns SK09 (Number Comparison), which sits in Number Sense. Both readings are defensible — it needs a decision, not a correction.

### 5.2 Prerequisite-type conflicts — the consequential ones

These are levels where both graphs agree an edge exists but disagree on whether it is a **hard prerequisite**. Apex selection depends entirely on this distinction, so each row changes what appears on the printed paper.

| L | S | Capability | Conflict |
|---|---|---|---|
| `L5` | `S1.5` | Counting Small Sets (1-3) | S1.4: docs=co-occurs/code=requires |
| `L8` | `S2.1` | Quantity Comparison | S1.1: docs=requires/code=often-precedes |
| `L9` | `S2.2` | Seriation (3 Objects) | S2.1: docs=requires/code=often-precedes |
| `L12` | `S2.5` | Counting 6-10 | S2.4: docs=requires/code=often-precedes |
| `L16` | `S2.9` | Conceptual Subitizing | S1.7: docs=requires/code=supports |
| `L21` | `S3.4` | Seriation with Transitivity | S2.2: docs=requires/code=supports |
| `L22` | `S3.5` | Flexible Classification | S2.3: docs=requires/code=supports |
| `L24` | `S3.7` | Comparative Vocabulary (Formalizing) | S2.8: docs=requires/code=supports |
| `L25` | `S3.8` | Patterns (2-Item Indep & 3-Item Intro) | S2.7: docs=requires/code=often-precedes |
| `L27` | `S3.10` | Shape Composition & Decomposition | S2.10: docs=requires/code=supports |
| `L28` | `S4.1` | Abstract Numeral Comparison | S3.3: docs=requires/code=often-precedes |
| `L29` | `S4.2` | Close Numeral Comparison | S4.1: docs=requires/code=often-precedes |
| `L34` | `S4.7` | Single-Digit Subtraction | S4.6: docs=parallel/code=requires |
| `L36` | `S4.9` | Non-Standard Length Estimation | S3.7: docs=requires/code=supports |
| `L38` | `S4.11` | 3-Item Pattern Completion | S3.8: docs=requires/code=often-precedes |
| `L40` | `S4.13` | Ordinal Positions (1st-10th) | S3.6: docs=requires/code=often-precedes |
| `L42` | `S4.15` | Advanced Shape Composition | S3.10: docs=requires/code=supports |
| `L53` | `S5.11` | Uniform Non-Standard Measurement | S4.10: docs=requires/code=supports S4.9: docs=requires/code=supports |
| `L61` | `S5.19` | Skip Counting (2s, 5s, 10s) | S5.16: docs=requires/code=often-precedes |
| `L64` | `S6.3` | 3-Digit Comparison & Ordering | S4.2: docs=requires/code=often-precedes |
| `L70` | `S6.9` | Relating 2D Faces to 3D Solids | S4.8: docs=requires/code=supports |
| `L71` | `S6.10` | Telling Time (Hours & Half-Hours) | S5.14: docs=co-occurs/code=requires |
| `L84` | `S7.9` | 3D Nets & Spatial Perspective | S6.9: docs=requires/code=supports |
| `L86` | `S7.11` | Complex Money Problems | S6.11: docs=requires/code=often-precedes |
| `L87` | `S7.12` | Advanced Number Patterns | S6.13: docs=requires/code=often-precedes |
| `L88` | `S7.13` | Bar Graphs & Data Interpretation | S6.14: docs=requires/code=often-precedes |
| `L89` | `S7.14` | Factors & Multiples | S6.6: docs=requires/code=often-precedes |

### 5.3 Levels where the prerequisite *sets* differ

Listed in the CSV. Summary: 46 edges exist only in the research documents, 66 only in the code.
