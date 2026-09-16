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
| `legacyLevel59` | `integer \| null` | Optional | Deprecated legacy bridge for procedural generators (1–21); modern question items resolve via question-level concept tagging (#423). |
| `status` | `enum` | Yes | Lifecycle status: `active` \| `draft` \| `deprecated`. |
| `hasStaticHtml` | `boolean` | Yes | Recomputed flag: indicates if static HTML worksheet templates exist on disk. |
| `hasBuilder` | `boolean` | Yes | Recomputed flag: indicates if the legacy generator engine can build this level. |

---

## 4. Legacy Content Transition: Question-Level Concept Tagging (#423)

### Superseding the Level-to-Level Crosswalk Approach
Earlier attempts to reconcile legacy 59-level content with the 93-level curriculum relied on an automated level-to-level mapping (`Research/fln_59_to_93_crosswalk.PROPOSED.json`). That approach was officially retired and superseded on 2026-09-01 (via PR [#423](https://github.com/vicharanashala/fln/pull/423)) for two fundamental reasons:
1. **Unreliable Automated Matching**: Title-only matching produced severe pedagogical errors (e.g. legacy level 4 *"Numbers 1-10"* erroneously matched to L43 *"3-Digit Numbers"*).
2. **1-to-Many Pedagogical Overlaps**: Multiple 93-space levels legitimately draw from the same legacy level tasks rather than conforming to clean 1:1 level mappings. Attempting to force a rigid sequential crosswalk obscured this reality.

### Live Architecture: Tagging Content Instead of Mapping Levels
Instead of mapping *levels to levels*, the platform tags **individual questions directly to canonical 93-level concept IDs** (`conceptId`), allowing the legacy 59 numbering space to be cleanly phased out:

* **Stored Questions (Legacy Levels 22–59)**: The 1,202 concrete questions in `data/questionBank.json` carry stable, deterministic IDs (`questionId` derived from `(level, section, questionNumber)`). Through the Superadmin Question Review workflow (`frontend/src/components/panels/QuestionReviewPanel.tsx` and `backend/src/routes/questionBank.ts`), reviewers assign individual items or entire sections directly to their target 93-level `conceptId`. When mapped, the question inherits that immutable concept identity, linking directly to student assessment evidence.
* **Procedural Generators (Legacy Levels 1–21)**: For early levels backed by procedural generators rather than static question bank items, the level itself is mapped once at the generator boundary.
* **Auditable Retirement**: Rather than deleting obsolete items, questions can be marked with `reviewStatus: 'retired'`, preserving an auditable history of pedagogical decisions.
* **Transparent Gap Visibility**: Content availability is measured dynamically from real tagged questions (`GET /api/question-bank/progress`), making any remaining unauthored levels among the 93 explicit and actionable.

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
