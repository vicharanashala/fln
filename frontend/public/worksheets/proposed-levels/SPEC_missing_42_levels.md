# Spec: 42 Missing Levels — Proposed Diagnostic Papers

**Purpose.** Extend the python diagnostic-paper pipeline (`_build/build_class_papers.py`) to cover the 42 levels in `Research/fln_proposed_levels.md` that are NOT yet in `cog_mapping.json`. Total: 93 levels (51 existing + 42 new).

**Source of truth.** Each spec entry cites the research level code, learning outcome, and topics. Hand-written question text, fixed numbers, no randomness.

**Visual style.** B&W, Times New Roman, 1 question per level, `.q / .q-head / .q-body` blocks matching `sample-15q-diagnostic-bw.html`. Visuals are inline SVG (matching existing `build_class_papers.py` SVG helpers). Icons from `frontend/public/worksheets/icons.js` reused where they apply.

**Class placement.** Per FLN framework convention:
- S1.x → Class 0 / pre-numeracy / no formal class — paper: `class-pre-diagnostic-cognitive.html` (new)
- S2.x → Class 0 / pre-class 1 — same paper
- S3.x → late pre-class 1 / early class 1 — same paper
- S4.x → Class 1 — paper: `class1-diagnostic-cognitive.html` (extend existing) or new `class1-diagnostic-extended.html`
- S5.x → Class 2 — `class-2-diagnostic-cognitive.html` (extend)
- S6.x → Class 3 — `class-3-diagnostic-cognitive.html` (extend)
- S7.x → Class 4 — `class-4-diagnostic-cognitive.html` (extend)

**Question count budget.** 1 question per level. Existing papers: class 2=19, class 3=14, class 4=18. After extension: class 1 (S4) gains 15, new pre-class paper (S1+S2+S3) gains 27. Totals: pre=27, class 1=15, class 2=19, class 3=14, class 4=18 = 93 Qs.

**Status.** DRAFT for review. Sahil: confirm question types and sample wording. I will not write the python generators until u approve.

---

## Stage S1 — Pre-Numeracy (7 levels)

**Pedagogical note.** These levels require **concrete objects** (icons), no numerals. Visual density is high. Numbers are absent or count-only (dots). The existing `icons.js` library is the natural source for objects.

### One-to-One Correspondence  (`S1.1`)
- **LO (verbatim):** Child can perform one-to-one physical matching between two small sets of real objects.
- **Topics:** One-to-one correspondence; object matching.
- **Q type:** Matching — two rows of icons, child draws a line between matching objects (one-to-one pairing)
- **Sample Q:** _"Match each ball to one box. Draw a line."_
  Top row: 3 balls (same icon, drawn via inline SVG circles). Bottom row: 3 boxes (drawn as SVG squares). Right side: 4 boxes (one extra — to test if child notices).
- **Visual:** inline SVG `<circle>` (balls) + `<rect>` (boxes), B&W. ~3-line vertical layout.
- **Asset:** none from icons.js — pure geometric shapes.

### Classification (Single Property)  (`S1.2`)
- **LO (verbatim):** Child can sort a small set of objects correctly by a single named attribute.
- **Topics:** Classification (single property); sorting.
- **Q type:** Sorting — group icons by one shared property (e.g. all fruits together, all vehicles together)
- **Sample Q:** _"Circle the fruits."_
  6 icons in a 2×3 grid: apple, ball, banana, car, mango, kite. Child circles the 3 fruits.
- **Visual:** icons from `icons.js` (apple, ball, banana, car, mango, kite).

### Perceptual Same/Different  (`S1.3`)
- **LO (verbatim):** Child correctly identifies two sets as visually same or different without counting.
- **Topics:** Perceptual same/different; visual set comparison (non-quantitative).
- **Q type:** Two-image comparison — child marks SAME or DIFFERENT
- **Sample Q:** _"Look at the two pictures. Are they the same? Tick (✓) or cross (✗)."_
  Side-by-side: apple vs apple (SAME), ball vs kite (DIFFERENT). Two MCQ pairs.
- **Visual:** icons from `icons.js`.

### Rote Verbal Counting to 10  (`S1.4`)
- **LO (verbatim):** Child recites "1, 2, 3 ... 10" in order, orally.
- **Topics:** Rote counting; number-word sequence.
- **Q type:** Verbal count — child says the number sequence out loud (not a written answer)
- **Sample Q:** _"Count aloud from 1 to 10. Teacher ticks each correct number."_
  Empty 10-box grid for teacher checkmarks. No visual needed beyond the boxes.
- **Visual:** 10 small empty squares in a row.

### Counting Small Sets (1–3) with Support  (`S1.5`)
- **LO (verbatim):** Child counts a set of 1–3 objects accurately with support.
- **Topics:** Counting small sets; touch-and-count.
- **Q type:** Count a small cluster — child counts 1, 2, or 3 objects in a row and writes the numeral (with support: finger-tracing hint)
- **Sample Q:** _"Count the stars. Trace the number, then write it."_
  3 SVG stars in a row. Below: dotted numeral `3` (for tracing) + empty box for writing.
- **Visual:** inline SVG stars (5-point polygon, B&W outline). Dotted numeral via CSS `border-dashed` on a div containing `3`.

### Shape Matching (Perceptual)  (`S1.6`)
- **LO (verbatim):** Child correctly matches two identical real-world shapes visually.
- **Topics:** Shape matching; perceptual shape recognition.
- **Q type:** Match two columns — left column has named shapes (no labels yet, just visual), right column has same shapes rotated or in different sizes
- **Sample Q:** _"Draw a line from each shape on the left to the matching shape on the right."_
  Left: 4 SVG shapes (circle, square, triangle, rectangle). Right: same 4 shapes but rotated / smaller. No labels.
- **Visual:** inline SVG primitives.

### Perceptual Subitizing  (`S1.7`)
- **LO (verbatim):** Child correctly states the quantity of 1–3 objects shown briefly, without counting aloud or pointing.
- **Topics:** Perceptual subitizing; instant quantity recognition.
- **Q type:** Instant recognition — child sees ≤3 dots in a pattern and writes the numeral WITHOUT counting aloud
- **Sample Q:** _"How many dots? Write the number."_
  Two clusters: (a) 3 dots in a triangle pattern (recognizable at a glance), (b) 2 dots side-by-side.
- **Visual:** inline SVG `<circle>` dots arranged in canonical patterns.


## Stage S2 — Pre-Numeracy, Concrete Stage (10 levels)

**Pedagogical note.** Same as S1 but introduces comparison vocabulary (more/less/equal, big/small) and patterns. Still no abstraction — all questions are about visible objects.

### Quantity Comparison (More/Less/Equal)  (`S2.1`)
- **LO (verbatim):** Child correctly identifies which of two groups has more, less, or whether they're equal.
- **Topics:** Quantity comparison; more/less/equal.
- **Q type:** MCQ — child sees two clusters and circles "more", "less", or "equal"
- **Sample Q:** _"Look at the two groups. Tick the group that has MORE apples."_
  Left: 4 apple icons. Right: 6 apple icons. Child circles the right group.
- **Visual:** icons.js apple + repeat via JS-row helper.

### Seriation (3 Objects)  (`S2.2`)
- **LO (verbatim):** Child correctly orders 3 objects by a single given rule.
- **Topics:** Seriation; ordering by one rule.
- **Q type:** Ordering by size — 3 sticks/objects of varying length, child writes 1, 2, 3 below them (shortest = 1, longest = 3)
- **Sample Q:** _"Number the sticks from shortest (1) to longest (3)."_
  3 horizontal SVG rectangles: lengths 30mm, 50mm, 40mm.
- **Visual:** inline SVG `<rect>` of fixed widths.

### Classification (Increasing Complexity)  (`S2.3`)
- **LO (verbatim):** Child sorts a larger/more varied set correctly by one named attribute.
- **Topics:** Classification; sorting (increasing complexity).
- **Q type:** Venn-style grouping — child sorts 6 objects into 2 boxes (e.g. animals vs vehicles)
- **Sample Q:** _"Put the animals in box A and the vehicles in box B. Draw a line from each picture to its box."_
  6 icons in a row above; 2 labelled boxes below.
- **Visual:** icons.js (cat, dog, car, bus, bird, bike).

### Counting to 5 with Cardinality  (`S2.4`)
- **LO (verbatim):** Child counts up to 5 objects and correctly states the total.
- **Topics:** Counting with cardinality; counting to 5.
- **Q type:** Count and write — child counts up to 5 objects and writes the numeral
- **Sample Q:** _"Count the dots. Write the number in the box."_
  3 separate clusters: 2 dots, 5 dots, 4 dots. Empty box below each.
- **Visual:** inline SVG dots.

### Counting 6–10 with Support  (`S2.5`)
- **LO (verbatim):** Child counts 6–10 objects accurately with support.
- **Topics:** Counting 6–10; scaffolded counting.
- **Q type:** Same as S2.4 but clusters of 6–10
- **Sample Q:** _"Count the flowers. Write how many."_
  3 clusters: 6, 8, 10 dots.
- **Visual:** inline SVG.

### Shape Identification (Named)  (`S2.6`)
- **LO (verbatim):** Child correctly names circle, square, and triangle when shown.
- **Topics:** 2D shape naming; shape vocabulary.
- **Q type:** Name the shape — child writes the shape's name below each figure
- **Sample Q:** _"Write the name of each shape: circle, square, triangle, rectangle."_
  4 SVG primitives with a writing line below each.
- **Visual:** inline SVG.

### Simple Repeating Pattern (2-Item)  (`S2.7`)
- **LO (verbatim):** Child correctly continues a 2-item repeating pattern.
- **Topics:** Patterns; 2-item repeating sequences.
- **Q type:** Pattern completion — ABAB pattern, child draws/identifies the next 2 items
- **Sample Q:** _"What comes next? Draw it._
  _Pattern:_ ▲ ■ ▲ ■ ▲ ■ _? ?_
  "
- **Visual:** inline SVG triangles and squares.

### Comparative Vocabulary (Informal)  (`S2.8`)
- **LO (verbatim):** Child correctly uses comparative measurement vocabulary when comparing two real objects.
- **Topics:** Comparative vocabulary; informal measurement language.
- **Q type:** Sentence completion — "The elephant is ___ than the mouse." (big/bigger/biggest)
- **Sample Q:** _"Fill in the blank: The elephant is ____ than the mouse."_
  Visual: small mouse + big elephant side-by-side.
- **Visual:** icons.js (mouse via small circle + ears; elephant).

### Conceptual Subitizing  (`S2.9`)
- **LO (verbatim):** Child correctly states the total of a small set (~4–6) by recognizing sub-groups, without counting one by one.
- **Topics:** Conceptual subitizing; part-whole quantity recognition.
- **Q type:** Like S1.7 but for larger quantities (4–6) in dot-pattern arrangements that allow conceptual grouping (e.g. two rows of 3 instead of 6 random dots)
- **Sample Q:** _"How many dots? Write the number. (You do not have to count one by one.)"_
  2 clusters: 4 dots in a 2×2 square, 6 dots in 2 rows of 3.
- **Visual:** inline SVG, structured patterns.

### Shape Composition: Piece Assembly *(added 2026-07-19)*  (`S2.10`)
- **LO (verbatim):** Child combines 2-3 shapes into a simple picture through trial and error.
- **Topics:** Shape composition; combining shapes.
- **Q type:** Tangram-style — child circles which pieces combine to form the target shape
- **Sample Q:** _"Which two pieces make this square? Circle them."_
  Left: target square (SVG outline). Right: 4 SVG pieces (2 triangles, 1 square, 1 rectangle). Child circles the 2 triangles.
- **Visual:** inline SVG.


## Stage S3 — Numeral Introduction (10 levels)

**Pedagogical note.** Numerals appear for the first time. All questions still have object support (icons) alongside numerals. By end of stage, child begins to abstract (compare numerals without needing to count objects).

### Numeral Recognition (1–10)  (`S3.1`)
- **LO (verbatim):** Child correctly identifies written numerals 1–10.
- **Topics:** Numeral recognition; number symbols.
- **Q type:** Identify the numeral — child circles the numeral they hear (teacher reads aloud)
- **Sample Q:** _"Teacher says: 'Circle the number seven.' (7 is among: 3, 7, 9, 5))_"_
  4 numerals in a row, child circles the matching one.
- **Visual:** plain text in big font, B&W.

### Numeral–Quantity Correspondence  (`S3.2`)
- **LO (verbatim):** Child correctly matches a written numeral to a counted set of that quantity, and vice versa.
- **Topics:** Numeral–quantity correspondence.
- **Q type:** Match — draw a line from each numeral (1–10) to a cluster with that many objects
- **Sample Q:** _"Match each number to the right group of dots._
  _Top: 4, 7, 9_
  _Bottom: cluster of 9, cluster of 4, cluster of 7_
  "
- **Visual:** numerals + SVG dots.

### Numeral Comparison (Object-Mediated)  (`S3.3`)
- **LO (verbatim):** Child correctly compares two numerals when allowed to ground each in counted objects.
- **Topics:** Numeral comparison (object-mediated).
- **Q type:** Compare two clusters, write > or < between them
- **Sample Q:** _"Compare. Write > or <._
  _Cluster A: 5 apples_
  _Cluster B: 3 apples_
  "
- **Visual:** icons.js apple repeated.

### Seriation with Transitivity  (`S3.4`)
- **LO (verbatim):** Child correctly orders 3+ objects and can answer a transitivity question without re-comparing every pair.
- **Topics:** Seriation with transitivity.
- **Q type:** Transitivity — if A > B and B > C, then A > C. Given 3 sticks, mark which is longest and which is shortest.
- **Sample Q:** _"Look at the three sticks. Circle the LONGEST one. Put a cross (×) on the SHORTEST."_
  3 horizontal SVG rects of lengths 25mm, 60mm, 40mm.
- **Visual:** inline SVG.

### Classification (Flexible)  (`S3.5`)
- **LO (verbatim):** Child correctly re-sorts the same set of objects by two different attributes in turn.
- **Topics:** Flexible classification.
- **Q type:** Multiple-property sort — child identifies which property is being used to sort (colour vs shape vs size)
- **Sample Q:** _"These objects are sorted by what property? Tick the right answer._
  _○ Colour  ○ Size  ○ Shape_
  "
  Visual: 2 rows of objects sorted by colour (e.g. red/blue/red/blue).

### Sequencing (Arranges by Sequence)  (`S3.6`)
- **LO (verbatim):** Child correctly arranges a small set of numbers or objects in sequence.
- **Topics:** Sequencing; ordering.
- **Q type:** Order 3–5 numbered items — child writes 1, 2, 3 below them in correct sequence
- **Sample Q:** _"Number the pictures in order (first to last)._
  _🌱 (seed), 🌿 (sprout), 🌳 (tree), 🍎 (apple fruit)_
  "
- **Visual:** inline SVG or simple geometric shapes (3 stages of growth).

### Comparative Vocabulary (Formalizing)  (`S3.7`)
- **LO (verbatim):** Child consistently and correctly uses comparative measurement vocabulary across multiple items.
- **Topics:** Comparative vocabulary (formalizing).
- **Q type:** MCQ — which is the biggest/smallest/most/least among 3 options
- **Sample Q:** _"Circle the BIGGEST animal."_
  3 SVG animals of different sizes: small cat, medium dog, big elephant (relative sizing).
- **Visual:** inline SVG with relative scaling.

### Patterns (2-Item Independent + 3-Item Introduction)  (`S3.8`)
- **LO (verbatim):** Child independently continues a 2-item pattern and, with support, continues a 3-item pattern.
- **Topics:** Patterns; 2-item independent, 3-item introduction.
- **Q type:** Extend a pattern — both ABAB and ABCABC types, child writes/identifies the next item
- **Sample Q:** _"What comes next?_"
  Pattern A: 🔴 🔵 🔴 🔵 🔴 _?_ (2-item)
  Pattern B: 🔴 🔵 🟢 🔴 🔵 _?_ (3-item)
- **Visual:** inline SVG circles in 3 colours (well, B&W so use 3 fill patterns: solid, dashed, dotted).

### Shape Properties (Basic)  (`S3.9`)
- **LO (verbatim):** Child can state at least one defining property of a basic 2D shape (e.g. "a triangle has 3 sides").
- **Topics:** Shape properties (basic).
- **Q type:** Count sides/corners — child counts and writes
- **Sample Q:** _"How many sides does a triangle have? Write the number."_
  Triangles with explicit corner dots; rectangle with sides labelled.
- **Visual:** inline SVG with corner markers.

### Shape Composition: Picture Making *(added 2026-07-19)*  (`S3.10`)
- **LO (verbatim):** Child plans and creates a simple picture from multiple shapes, with some intentionality beyond pure trial and error.
- **Topics:** Shape composition; picture making.
- **Q type:** Composite figure — child identifies which simple shapes make the target picture
- **Sample Q:** _"A house is made of which shapes? Circle them."_
  Visual: a house (square + triangle on top), child circles those shapes from a choice.
- **Visual:** inline SVG.


## Stage S4 — Early Class 1 / Abstract Numbers (15 levels)

**Pedagogical note.** All S4 levels are fully Class 1 territory. My pipeline's `class1-diagnostic-mixed-levels.html` already has 15 questions but doesn't cover S4.x specifically. These specs fill the gap. By end of stage, child works with numerals without needing object support (except place value).

### Numeral Comparison — Fully Abstract  (`S4.1`)
- **LO (verbatim):** Child correctly compares two bare numerals without needing objects.
- **Topics:** Numeral comparison, fully abstract.
- **Q type:** Write > or < between two bare numerals (no objects)
- **Sample Q:** _"Write > or <._
  _7 ☐ 3_
  "
- **Visual:** plain text only.

### Numeral Comparison — Close Values  (`S4.2`)
- **LO (verbatim):** Child correctly compares two close-valued numerals.
- **Topics:** Numeral comparison, close values.
- **Q type:** Like S4.1 but with close values (differ by 1 or 2)
- **Sample Q:** _"Write > or <._
  _8 ☐ 9_
  _6 ☐ 4_
  "
- **Visual:** plain text.

### Counting Objects to 20  (`S4.3`)
- **LO (verbatim):** Child counts up to 20 objects accurately.
- **Topics:** Counting to 20.
- **Q type:** Count clusters of 11–20 objects, write the numeral
- **Sample Q:** _"Count the stars. Write how many."_
  2 clusters: 13 stars (arranged 10+3) and 17 stars (arranged 10+7).
- **Visual:** inline SVG stars.

### Reading/Writing Numbers to 99  (`S4.4`)
- **LO (verbatim):** Child correctly reads and writes any number 1–99.
- **Topics:** Reading/writing to 99.
- **Q type:** Read the number — child writes the numeral they hear (e.g. "forty-two" → 42)
- **Sample Q:** _"Write the number: forty-seven."_
  4 prompts: 23, 47, 58, 91.
- **Visual:** plain text.

### Place Value — Face Value Only (Pre-Conceptual)  (`S4.5`)
- **LO (verbatim):** Child correctly names the two digits of a given 2-digit number.
- **Topics:** Place value, face value only.
- **Q type:** Identify the digit — given a 2-digit number, child circles the tens digit (pre-formal: just which digit is which position)
- **Sample Q:** _"In the number 47, which digit is in the tens place? Circle it."_
  4 prompts: 47, 23, 58, 91.
- **Visual:** plain text, large numerals.

### Addition to 9 (Concrete → Abstract)  (`S4.6`)
- **LO (verbatim):** Child solves addition problems with sums up to 9.
- **Topics:** Addition to 9.
- **Q type:** Add two single-digit numbers (sum ≤ 9) — child writes the answer
- **Sample Q:** _"Add._
  _3 + 4 = ☐_
  _5 + 2 = ☐_
  "
- **Visual:** plain text.

### Subtraction to 9 (Concrete → Abstract)  (`S4.7`)
- **LO (verbatim):** Child solves subtraction problems within 9.
- **Topics:** Subtraction to 9.
- **Q type:** Subtract single-digit numbers (result ≥ 0)
- **Sample Q:** _"Subtract._
  _7 − 3 = ☐_
  _5 − 5 = ☐_
  "
- **Visual:** plain text.

### 3D Shape Properties  (`S4.8`)
- **LO (verbatim):** Child correctly names corners, edges, and surfaces of a solid shape.
- **Topics:** 3D shape properties.
- **Q type:** Name the 3D shape and count faces/edges/vertices
- **Sample Q:** _"Look at the shape. Write its name (cube, cuboid, sphere, cylinder, cone). How many faces does it have?_"_
  1 SVG 3D-like drawing: cube with visible edges.
- **Visual:** inline SVG with dashed hidden edges.

### Length Estimation (Non-Standard Units)  (`S4.9`)
- **LO (verbatim):** Child estimates and verifies an object's length using a body-referenced unit.
- **Topics:** Length estimation, non-standard units.
- **Q type:** Estimate — child guesses how many paper clips long a pencil is, writes the number
- **Sample Q:** _"Estimate: How many paper clips long is this pencil? Write the number."_
  Visual: pencil drawn ~6cm wide + a single paperclip icon as unit reference.
- **Visual:** inline SVG pencil + paperclip from icons.js.

### Capacity Estimation (Non-Standard Units)  (`S4.10`)
- **LO (verbatim):** Child estimates and verifies a container's capacity using an informal unit.
- **Topics:** Capacity estimation, non-standard units.
- **Q type:** Estimate — how many cups fill a jug?
- **Sample Q:** _"Estimate: How many cups of water will fill this jug? Write the number."_
  Visual: SVG jug + small cup icon.
- **Visual:** inline SVG jug, cup from icons.js.

### Patterns, 3-Item Repeating Cycle (Independent)  (`S4.11`)
- **LO (verbatim):** Child independently continues a 3-item pattern, including filling in a missing middle term.
- **Topics:** Patterns, 3-item independent.
- **Q type:** Extend ABCABC pattern with abstract shapes
- **Sample Q:** _"What comes next? Write the shape name._
  _◆ ● ▲ ◆ ● ▲ ◆ _?_
  "
- **Visual:** inline SVG diamond, circle, triangle.

### Zero, as "None"/Empty Set  (`S4.12`)
- **LO (verbatim):** Child correctly identifies zero as the count of an empty set, in context.
- **Topics:** Zero, as "none."
- **Q type:** Conceptual zero — child writes 0 in empty box
- **Sample Q:** _"How many apples are in the empty box? Write the number._
  _Box 1: 🍎🍎🍎 → 3_
  _Box 2: [empty] → ☐_
  "
- **Visual:** inline SVG empty box + filled box.

### Ordinal Numbers  (`S4.13`)
- **LO (verbatim):** Child correctly names and uses ordinal positions 1st–10th.
- **Topics:** Ordinal numbers.
- **Q type:** Position — "Which animal is 3rd from the left?"
- **Sample Q:** _"Look at the line of animals. Which animal is 3rd from the left? Write its name._
  _cat — dog — bird — fish — cow_
  "
- **Visual:** inline SVG horizontal row.

### Number Line Placement (Informal, 0–20)  (`S4.14`)
- **LO (verbatim):** Child approximately places a given numeral (0–20) on a blank number line.
- **Topics:** Number line placement.
- **Q type:** Mark the position of a number on a number line
- **Sample Q:** _"Mark the position of 7 on the number line with a cross (×)."_
  Number line 0–20 with marks every 1, no labels except 0 and 20.
- **Visual:** inline SVG horizontal line with tick marks.

### Shape Composition & Decomposition *(added 2026-07-19)*  (`S4.15`)
- **LO (verbatim):** Child both composes a new shape from parts and decomposes a given shape into parts.
- **Topics:** Shape composition and decomposition.
- **Q type:** Decomposition — given a composite shape (e.g. rectangle divided into 2 triangles), child counts the constituent shapes
- **Sample Q:** _"How many triangles make up this rectangle? Write the number._
  Visual: rectangle with diagonal line.
- **Visual:** inline SVG.


---

## Summary Table

| Stage | Count | Paper |
|---|---|---|
| S1 | 7 | class-pre-diagnostic-cognitive.html (new) |
| S2 | 10 | class-pre-diagnostic-cognitive.html (new) |
| S3 | 10 | class-pre-diagnostic-cognitive.html (new) |
| S4 | 15 | class1-diagnostic-extended.html (**NEW**, separate from class1-diagnostic-mixed-levels.html) |
| S5 | 19 | class-2-diagnostic-cognitive.html (existing, no change) |
| S6 | 14 | class-3-diagnostic-cognitive.html (existing, no change) |
| S7 | 18 | class-4-diagnostic-cognitive.html (existing, no change) |
| **Total** | **93** | **5 papers** (3 existing untouched + 2 new) |

## Assets needed

- **`icons.js`** already has all 126 icons — usable as-is, no edits needed.
- **Inline SVG primitives** (circle, square, triangle, rect, polygon, line) — already in `build_class_papers.py` helpers.
- **No new fonts, no new libraries.**

## What is NOT in scope (call out for later)

- **Multi-version papers** (different random number sets per class for cheating prevention). The Downloads file does this via `Math.random()` — out of scope here per your aesthetic.
- **Answer key PDF generation.** Specs only ask for the question; answer keys can be derived from the python generator's deterministic output and added later.
- **OMR overlay / coord capture.** That's the runtime's job (`worksheetRenderer.ts`), not the static papers'.
- **Translations.** All Qs in English; Hindi/regional versions are a separate task.

## Open questions for you (sahil)

**Resolved (this round):**
- ~~1. Pre-class paper naming.~~ → `class-pre-diagnostic-cognitive.html`
- ~~2. S4 placement.~~ → new `class1-diagnostic-extended.html`, do not touch existing `class1-diagnostic-mixed-levels.html`
- ~~4. Marks.~~ → no marks per Q. Just track right/wrong/skip. CSS `.q-marks` element omitted entirely.

**Still open (need your call before i code):**
1. **Q difficulty.** Easy / medium / hard for each level? I defaulted to MEDIUM in samples. Confirm or change.
2. **Naming for the pre-class paper.** I wrote `class-pre-diagnostic-cognitive.html` — does this match your convention, or should it be `class0-...` / `nursery-...` / something else?
3. **Icons in B&W.** The existing icons.js uses `#1a1a1a` strokes (dark gray, near-black). That's already B&W-print-friendly. Confirm or specify a true `#000` override.

(Each of these is a single line / word answer. Once u answer, i write the python generators the same day.)
