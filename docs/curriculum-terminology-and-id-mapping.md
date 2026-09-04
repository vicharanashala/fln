# Canonical Curriculum Terminology and ID Mapping

> **Specification Reference:** Closes [#348](https://github.com/vicharanashala/fln/issues/348)  
> **Origin:** FLN V0.1 Deep Audit & Implementation Blueprint (§3, §12 Stage 1, §14 item 1)  
> **Target Audience:** All FLN contributors, curriculum authors, and backend/frontend engineers

---

## 1. Executive Summary & Rationale

Historically, the FLN platform suffered from multiple disconnected ways of identifying learning competencies:
1. **Legacy 1–59 numbering**: Rooted in the early standalone HTML worksheet engine (`levels_main.html`).
2. **Current 1–93 numbering**: Display levels defined in `frontend/src/data/skillProgressionMap.ts`.
3. **Research S-codes**: Pedagogical stage-notations (`S1.1` through `S7.18`) authored in `Research/fln_proposed_levels.md`.
4. **Ad-hoc `subLevel` markers**: Ambiguous numeric flags (`0`, `1`, `2`) attached to evaluation reports without standard semantics.

When curriculum researchers updated the syllabus or inserted intermediate levels, sequential level numbers shifted. If student responses were tied to mutable integers like `level: 42`, **curriculum revisions would silently corrupt or orphan historical student assessment evidence**.

### The Canonical ID Decision
To eliminate ID drift permanently, the platform adopts an **internal immutable `concept_id` (UUID / ObjectId)** as the database primary key. 

* The `concept_id` is generated once upon creation and **never regenerated**.
* Human-readable research codes (`s_code`), current display numbers (`level_number`), and legacy indices (`legacyLevel59`) are **versioned display aliases** of that permanent concept ID.
* Student evaluation reports, item responses, and mastery trajectories point exclusively to `concept_id`.

---

## 2. The 11 Canonical Terms

To avoid ambiguity across pedagogical and engineering teams, the following 11 terms are formally standardized:

| # | Term | Formal Definition | Code / Storage Representation |
|---|---|---|---|
| **1** | **Curriculum Version** | A frozen, reproducible release of the curriculum taxonomy (e.g., `FLN-2026.1`, `v1`). All concept aliases belong to a specific curriculum version. | `curriculumVersion: string` on `CurriculumLevel` |
| **2** | **Concept** | The atomic, indivisible competency unit assessed by the platform (e.g., *Counting to 5 with Cardinality*). Keyed by an immutable primary key. | `conceptId: string` (UUID / ObjectId) |
| **3** | **Level Number** | The current ordered sequence index (1–93) used for display in teacher dashboards, student profiles, and progress charts. Mutable across curriculum releases. | `levelNumber: number` (1..93) |
| **4** | **Strand** | High-level mathematical domain grouping related concepts (e.g., *Number Sense*, *Operations*, *Measurement*, *Geometry*, *Patterns*, *Data Handling*). Derived from core skills. | `strand: string` |
| **5** | **Question** | A concrete assessment prompt or task presented to a student on a worksheet or screen with an expected solution. | `Question` interface in `backend/src/db.ts` |
| **6** | **Template** | A parameterized generator definition specifying constraints, numeral ranges, operations, and SVG artwork themes from which questions are synthesized. | `QuestionTemplate` in `routes/questionTemplates.ts` |
| **7** | **Item Instance** | A single deterministic realization of a template generated with specific pseudo-random seed numbers, SVG assets, and bounding box coordinates. | Generated item in `EvaluationReport.questionResults` |
| **8** | **Response** | The student's recorded physical mark, digit handwriting, or choice selection on paper or screen. | `submittedAnswer: string` / cropped ROI image |
| **9** | **Evidence** | Scored and verified observation produced by rule-based checkers or OCR models (includes confidence scores, raw transcription, and teacher override notes). | `EvaluationReport.questionResults[i]` |
| **10** | **Mastery** | Algorithmic or probabilistic determination of whether a student has attained sufficient competence on a concept node to advance in the curriculum graph. | Concept status in mastery progression matrix |
| **11** | **Remediation** | Targeted practice materials, pedagogical interventions, or micro-worksheets specifically generated to close diagnosed misconception gaps. | Remediation tasks / practice sheets |

---

## 3. Canonical Registry Schema

The single queryable source of truth for the curriculum is the `curriculumLevels` collection in the database, accessed via `dbStore` (`backend/src/db.ts`) and served by `/api/curriculum/levels`.

### Field Specifications

| Field | Type | Required | Description |
|---|---|---|---|
| `concept_id` / `conceptId` | `string` (UUID) | Yes | **Permanent identity**. Immutable primary key generated once upon initial insertion ($setOnInsert). |
| `taxonomy_version` / `curriculumVersion` | `string` | Yes | Curriculum release identifier (e.g. `FLN-2026.1`, `v1`). |
| `s_code` / `sCode` | `string` | Yes | Human-readable pedagogical research code (e.g. `S1.1`, `S3.4`, `S7.18`). |
| `level_number` / `levelNumber` | `integer` (1–93) | Yes | Current ordered display sequence index. Mutable alias. |
| `title` / `capability` | `string` | Yes | Pedagogical competency title (e.g. *One-to-One Correspondence*). |
| `strand` | `string` | Yes | Mathematical strand derived from primary skill domains. |
| `stage` / `class_band` | `string` | Yes | Educational stage (`Bal Vatika 1`, `Bal Vatika 2`, `Bal Vatika 3`, `Class 1`, `Class 2`, `Class 3`, `Class 4`). |
| `primarySkills` | `string[]` | Yes | Array of canonical skill identifiers assessed by this concept. |
| `subskills` | `string[]` | Yes | Granular micro-skills under primary skills. |
| `legacyLevel59` | `integer \| null` | Optional | Migration bridge pointing to the legacy 59-level worksheet generator ID. |
| `status` | `enum` | Yes | Lifecycle status: `active` \| `draft` \| `deprecated`. |
| `hasStaticHtml` | `boolean` | Yes | Recomputed flag: indicates if static HTML worksheet templates exist on disk. |
| `hasBuilder` | `boolean` | Yes | Recomputed flag: indicates if the legacy generator engine can build this level. |

---

## 4. Consolidated Migration Table: 93 Levels, S-Codes & Legacy 59 Mapping

Below is the canonical mapping crosswalk reconciling the 93 active curriculum nodes, their research S-codes, educational stages, capabilities, and the legacy 59-level worksheet engine IDs:

| Level | S-Code | Educational Stage | Capability Title | Strand | Legacy 59 ID (Bridge) |
|---|---|---|---|---|---|
| **L1** | `S1.1` | Bal Vatika 1 | One-to-One Correspondence | Number Sense | Mapped (Ref: #408) |
| **L2** | `S1.2` | Bal Vatika 1 | Classification (Single Property) | Pre-Math / Logic | Mapped |
| **L3** | `S1.3` | Bal Vatika 1 | Perceptual Same/Different | Pre-Math / Logic | Mapped |
| **L4** | `S1.4` | Bal Vatika 1 | Rote Verbal Counting to 10 | Number Sense | Mapped |
| **L5** | `S1.5` | Bal Vatika 1 | Counting Small Sets (1-3) | Number Sense | Mapped |
| **L6** | `S1.6` | Bal Vatika 1 | Shape Matching (Perceptual) | Geometry | Mapped |
| **L7** | `S1.7` | Bal Vatika 1 | Perceptual Subitizing | Number Sense | Mapped |
| **L8** | `S2.1` | Bal Vatika 2 | Quantity Comparison | Number Sense | Mapped |
| **L9** | `S2.2` | Bal Vatika 2 | Seriation (3 Objects) | Measurement | Mapped |
| **L10** | `S2.3` | Bal Vatika 2 | Classification (Increasing Complexity) | Pre-Math / Logic | Mapped |
| **L11** | `S2.4` | Bal Vatika 2 | Counting to 5 (Cardinality) | Number Sense | Mapped |
| **L12** | `S2.5` | Bal Vatika 2 | Counting 6-10 | Number Sense | Mapped |
| **L13** | `S2.6` | Bal Vatika 2 | Shape Identification | Geometry | Mapped |
| **L14** | `S2.7` | Bal Vatika 2 | 2-Item Patterns | Patterns | Mapped |
| **L15** | `S2.8` | Bal Vatika 2 | Comparative Vocabulary | Measurement | Mapped |
| **L16** | `S2.9` | Bal Vatika 2 | Conceptual Subitizing | Number Sense | Mapped |
| **L17** | `S2.10` | Bal Vatika 2 | Basic Shape Composition | Geometry | Mapped |
| **L18** | `S3.1` | Bal Vatika 3 | Numeral Recognition (1-10) | Number Sense | Mapped |
| **L19** | `S3.2` | Bal Vatika 3 | Numeral-Quantity Correspondence | Number Sense | Mapped |
| **L20** | `S3.3` | Bal Vatika 3 | Numeral Comparison (Object-Mediated) | Number Sense | Mapped |
| **L21** | `S3.4` | Bal Vatika 3 | Seriation with Transitivity | Measurement | Mapped |
| **L22** | `S3.5` | Bal Vatika 3 | Flexible Classification | Pre-Math / Logic | Level 22 |
| **L23** | `S3.6` | Bal Vatika 3 | Numeral Sequencing | Number Sense | Level 23 |
| **L24** | `S3.7` | Bal Vatika 3 | Comparative Vocabulary (Formalizing) | Measurement | Level 24 |
| **L25** | `S3.8` | Bal Vatika 3 | Patterns (2-Item Indep & 3-Item Intro) | Patterns | Level 25 |
| **L26** | `S3.9` | Bal Vatika 3 | Basic Shape Properties | Geometry | Level 26 |
| **L27** | `S3.10` | Bal Vatika 3 | Shape Composition & Decomposition | Geometry | Level 27 |
| **L28** | `S4.1` | Class 1 | Abstract Numeral Comparison | Number Sense | Level 28 |
| **L29** | `S4.2` | Class 1 | Close Numeral Comparison | Number Sense | Level 29 |
| **L30** | `S4.3` | Class 1 | Counting Objects to 20 | Number Sense | Level 30 |
| **L31** | `S4.4` | Class 1 | Reading & Writing Numerals to 99 | Number Sense | Level 31 |
| **L32** | `S4.5` | Class 1 | Structured Ten-Frames | Number Sense | Level 32 |
| **L33** | `S4.6` | Class 1 | Unitizing (Bundles of 10) | Number Sense | Level 33 |
| **L34** | `S4.7` | Class 1 | Place Value Identification (Tens & Ones) | Number Sense | Level 34 |
| **L35** | `S4.8` | Class 1 | Canonical Expanded Form (2-Digit) | Number Sense | Level 35 |
| **L36** | `S4.9` | Class 1 | Non-Canonical Regrouping (Concrete) | Number Sense | Level 36 |
| **L37** | `S4.10` | Class 1 | Mental Addition (+1, +2) | Operations | Level 37 |
| **L38** | `S4.11` | Class 1 | Complements of 10 | Operations | Level 38 |
| **L39** | `S4.12` | Class 1 | Addition with Manipulatives (within 20) | Operations | Level 39 |
| **L40** | `S4.13` | Class 1 | Subtraction as Take-Away (Concrete) | Operations | Level 40 |
| **L41** | `S4.14` | Class 1 | Subtraction as Comparison (Concrete) | Operations | Level 41 |
| **L42** | `S4.15` | Class 1 | Forward Number Line Jumps | Operations | Level 42 |
| **L43** | `S5.1` | Class 2 | Backward Number Line Jumps | Operations | Level 43 |
| **L44** | `S5.2` | Class 2 | Bridging Through 10 | Operations | Level 44 |
| **L45** | `S5.3` | Class 2 | Single-Digit Addition Facts (Automated) | Operations | Level 45 |
| **L46** | `S5.4` | Class 2 | 2-Digit + 1-Digit (No Regrouping) | Operations | Level 46 |
| **L47** | `S5.5` | Class 2 | Single-Digit Subtraction Facts | Operations | Level 47 |
| **L48** | `S5.6` | Class 2 | 2-Digit - 1-Digit (No Regrouping) | Operations | Level 48 |
| **L49** | `S5.7` | Class 2 | 2-Digit + 2-Digit (No Regrouping) | Operations | Level 49 |
| **L50** | `S5.8` | Class 2 | 2-Digit - 2-Digit (No Regrouping) | Operations | Level 50 |
| **L51** | `S5.9` | Class 2 | Regrouping Concepts (10 Ones = 1 Ten) | Operations | Level 51 |
| **L52** | `S5.10` | Class 2 | 2-Digit Addition (With Regrouping) | Operations | Level 52 |
| **L53** | `S5.11` | Class 2 | 2-Digit Subtraction (With Decomposition) | Operations | Level 53 |
| **L54** | `S5.12` | Class 2 | Repeated Addition as Equal Groups | Operations | Level 54 |
| **L55** | `S5.13` | Class 2 | Skip-Counting (2, 5, 10) | Operations | Level 55 |
| **L56** | `S5.14` | Class 2 | Multiplication Arrays (Concrete) | Operations | Level 56 |
| **L57** | `S5.15` | Class 2 | Multiplication Facts (2, 5, 10) | Operations | Level 57 |
| **L58** | `S5.16` | Class 2 | Fair Sharing (Equal Distribution) | Operations | Level 58 |
| **L59** | `S5.17` | Class 2 | Measurement with Non-Standard Units | Measurement | Level 59 |
| **L60** | `S5.18` | Class 2 | Ordering by Length/Weight | Measurement | Unmapped |
| **L61** | `S5.19` | Class 2 | Identifying Flat & Solid Shapes | Geometry | Unmapped |
| **L62** | `S6.1` | Class 3 | 3-Digit Reading & Writing | Number Sense | Unmapped |
| **L63** | `S6.2` | Class 3 | 3-Digit Place Value & Expanded Form | Number Sense | Unmapped |
| **L64** | `S6.3` | Class 3 | 3-Digit Addition (Standard Algorithm) | Operations | Unmapped |
| **L65** | `S6.4` | Class 3 | 3-Digit Subtraction (Decomposition) | Operations | Unmapped |
| **L66** | `S6.5` | Class 3 | Multiplication Facts (3, 4, 6) | Operations | Unmapped |
| **L67** | `S6.6` | Class 3 | 2-Digit × 1-Digit Multiplication | Operations | Unmapped |
| **L68** | `S6.7` | Class 3 | Division as Repeated Subtraction | Operations | Unmapped |
| **L69** | `S6.8` | Class 3 | Division Facts (Within Tables) | Operations | Unmapped |
| **L70** | `S6.9` | Class 3 | Equal Sharing with Remainders | Operations | Unmapped |
| **L71** | `S6.10` | Class 3 | Unit Fractions (1/2, 1/3, 1/4) | Fractions | Unmapped |
| **L72** | `S6.11` | Class 3 | Standard Units of Length (m, cm) | Measurement | Unmapped |
| **L73** | `S6.12` | Class 3 | Standard Units of Mass (kg, g) | Measurement | Unmapped |
| **L74** | `S6.13` | Class 3 | Reading Clocks (Hours & Half-Hours) | Time | Unmapped |
| **L75** | `S6.14` | Class 3 | Money Calculations (Rupees & Paise) | Money | Unmapped |
| **L76** | `S7.1` | Class 4 | 4-Digit Reading & Place Value | Number Sense | Unmapped |
| **L77** | `S7.2` | Class 4 | 4-Digit Addition & Subtraction | Operations | Unmapped |
| **L78** | `S7.3` | Class 4 | Multiplication Facts (7, 8, 9) | Operations | Unmapped |
| **L79** | `S7.4` | Class 4 | 2-Digit × 2-Digit Multiplication | Operations | Unmapped |
| **L80** | `S7.5` | Class 4 | 3-Digit ÷ 1-Digit Division | Operations | Unmapped |
| **L81** | `S7.6` | Class 4 | Non-Unit Fractions (2/3, 3/4) | Fractions | Unmapped |
| **L82** | `S7.7` | Class 4 | Like-Denominator Fraction Addition | Fractions | Unmapped |
| **L83** | `S7.8` | Class 4 | Decimal Place Value Introduction | Decimals | Unmapped |
| **L84** | `S7.9` | Class 4 | Perimeter of Simple Polygons | Measurement | Unmapped |
| **L85** | `S7.10` | Class 4 | Area by Grid Counting | Measurement | Unmapped |
| **L86** | `S7.11` | Class 4 | Time Intervals & Elapsed Time | Time | Unmapped |
| **L87** | `S7.12` | Class 4 | Volume by Liquid Measure (L, mL) | Measurement | Unmapped |
| **L88** | `S7.13` | Class 4 | Angles (Right, Acute, Obtuse) | Geometry | Unmapped |
| **L89** | `S7.14` | Class 4 | Symmetry & Reflections | Geometry | Unmapped |
| **L90** | `S7.15` | Class 4 | Pictographs & Bar Graphs | Data Handling | Unmapped |
| **L91** | `S7.16` | Class 4 | Multi-Step Word Problems | Operations | Unmapped |
| **L92** | `S7.17` | Class 4 | Estimation & Mental Rounding | Number Sense | Unmapped |
| **L93** | `S7.18` | Class 4 | Number Patterns & Rules | Patterns | Unmapped |

---

## 5. Deprecation Policy: Ambiguous `subLevel` and Level Arithmetic

### 1. Deprecation of `subLevel`
Historically, `subLevel` appeared in student profile schemas and evaluation adapters (`0`, `1`, `2`) to indicate qualitative difficulty tiers or diagnostic sub-states. Because different modules assigned conflicting meanings to these numbers (e.g. beginner vs remediation vs confidence flag), **the `subLevel` field is officially deprecated in new code**:
* **Policy**: New backend endpoints and frontend components must not introduce or rely upon `subLevel` semantics.
* **Replacement**: Granular capability progression must be modeled via discrete **concept mastery nodes** (`conceptId`), prerequisite edges, or explicit misconception flags (`misconceptionFingerprint.ts`).

### 2. Prohibition of Numeric Level Arithmetic
In legacy scripts, code frequently assumed adjacent levels implied sequential mastery:
```typescript
// ❌ FORBIDDEN: Numeric level arithmetic
const nextLevel = currentLevel + 1;
const isEligible = studentLevel >= 45;
```
* **Why it fails**: Mathematical concepts do not progress in a strict linear sequence; they form a Directed Acyclic Graph (DAG) with parallel branches (e.g. Geometry vs Fractions). Furthermore, re-numbering levels breaks all arithmetic comparisons.
* **Policy**: New code must never perform arithmetic on level numbers.
* **Replacement**: Prerequisites and advancement must always resolve through the canonical prerequisite service (`backend/src/competencyPrerequisites.ts`):
```typescript
// ✅ REQUIRED: Graph-based dependency resolution
import { directPrerequisites, resolvePrerequisites } from '../competencyPrerequisites';

const prerequisites = resolvePrerequisites(conceptId);
```

---

## 6. Codebase File Ownership Manifest

To ensure clear architectural boundaries and avoid duplicated curriculum definitions, the following modules are designated as authoritative owners:

| Subsystem | File & Location | Architectural Responsibility |
|---|---|---|
| **Taxonomy Definition** | `frontend/src/data/skillProgressionMap.ts` | **Canonical source of truth** for skills, subskills, and the 93 level nodes. |
| **Server Snapshot** | `backend/src/data/skillLevelMap.json` | Generated build artifact mirror of the frontend skill progression map. |
| **Drift Verification** | `scripts/generate-skill-level-map.ts` | CI verification script; enforces zero drift between frontend and backend maps (`--check`). |
| **Database Model** | `backend/src/db.ts` (`curriculumLevels`) | Persistence collection keyed by immutable `conceptId`. |
| **Database Seeding** | `backend/src/seedCurriculumLevels.ts` | Additive, idempotent seed populating `curriculumLevels` with immutable `conceptId` generation. |
| **Curriculum API** | `backend/src/routes/curriculum.ts` | Authenticated read endpoints (`/api/curriculum/levels`, `/api/curriculum/coverage`). |
| **Prerequisites Engine** | `backend/src/competencyPrerequisites.ts` | Dependency graph, prerequisite resolution, and mastery advancement logic. |
| **Question Authoring** | `backend/src/routes/questionTemplates.ts` & `questionLogics.ts` | Superadmin question generation intent and constraint authoring per level. |
| **Question Review** | `backend/src/routes/questionBank.ts` & `QuestionReviewPanel.tsx` | Mapping legacy worksheet questions to 93-level concept identities. |
| **Worksheet Engine** | `backend/src/levelGenerator.ts` & `levels_main.html` | Dynamic question synthesis and paper rendering engines. |
| **Misconception Logic** | `backend/src/misconceptionFingerprint.ts` | Deterministic misconception mapping, archetype classification, and diagnostic clustering. |

---

## 7. Exit Gate Verification Checklist

Before any PR affecting curriculum or progression logic is approved, it must meet the following exit criteria:

- [ ] **Canonical Resolution**: The feature references competencies via immutable `conceptId` or resolves them through `/api/curriculum/levels`.
- [ ] **No Level Arithmetic**: No code performs mathematical addition or comparison on numeric level IDs (`level + 1`, `> levelNumber`).
- [ ] **No `subLevel` Reliance**: The feature does not rely on deprecated `subLevel` integers for business logic.
- [ ] **CI Drift Clean**: Running `npx tsx scripts/generate-skill-level-map.ts --check` succeeds without errors.
- [ ] **Additive Seeding**: The change does not alter or re-seed existing `conceptId` values.
