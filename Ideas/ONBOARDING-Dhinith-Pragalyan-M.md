# Onboarding – Dhinith Pragalyan M

## 1. Introduction

As part of my contribution to the Foundational Literacy and Numeracy (FLN) platform, I developed and verified the **Admin Question Bank Audit & Integrity Check** tool. 

The FLN platform serves young students from Preschool through Class 4 across a progressive curriculum ladder spanning 93 developmental levels. Central to this platform is the Question Bank, which feeds automated diagnostic tests, level evaluations, and personalized printable worksheets. 

Ensuring the data integrity, completeness, and formatting consistency of assessment questions is paramount. The **Question Bank Audit & Integrity Check** tool provides administrators and superadmins with a high-performance, client-side, non-destructive static analysis engine and interactive dashboard to audit question records against 6 core integrity rules, review categorized issue breakdowns, inspect problematic items in a read-only environment, and track overall question-bank health.

---

## 2. Problem Understanding

### Why Question Bank Data Integrity Matters
In foundational numeracy assessments, questions must be unambiguous, mathematically sound, developmentally calibrated to the exact FLN level, and accompanied by correct answer definitions. When thousands of question items are compiled across curriculum stages, inconsistencies can degrade the educational assessment pipeline:

- **Missing or Empty Question Text**: Questions lacking a prompt or containing truncated text ($< 3$ characters) render assessments unusable and confuse students.
- **Missing Correct Answers**: Missing answer definitions prevent the automated scoring and OCR pipelines from accurately evaluating student submissions.
- **Invalid Choice Arrays**: Multiple-choice questions (`answer_type === 'choice'`) with missing arrays, fewer than two options, or duplicate choices break UI rendering and invalidate multiple-choice logic.
- **Out-of-Bounds FLN Levels**: Levels mapped below `1` or above `93` violate the national curriculum framework bounds.
- **Duplicate Question Text**: Undetected identical question prompts across test papers reduce practice variety and assessment validity.
- **Malformed SVG Markup**: Questions containing broken SVG illustrations (missing `<svg` or `</svg>` tags) cause rendering artifacts and UI crashes in printable worksheets and web interfaces.

### Inefficiency of Manual Inspection
Manually reviewing thousands of question records, choices, and embedded vector graphics across 93 curriculum levels is error-prone, labor-intensive, and unscalable.

### Need for Safe, Non-Destructive Administration
Administrators require a centralized, deterministic validation mechanism that highlights issues without directly modifying or risking accidental deletion of the underlying database records.

---

## 3. Proposed Solution

The **Admin Question Bank Audit & Integrity Check** is an automated static validation tool embedded within the Admin/Superadmin portal.

```
Question Bank Dataset (1,202 Records)
               │
               ▼
   runQuestionBankAudit(questions)
   [Pure TypeScript Static Engine]
               │
     ┌─────────┴─────────┐
     ▼                   ▼
  6 Integrity       Index-Based
  Rules Check      1:1 Tracking
     └─────────┬─────────┘
               │
               ▼
          AuditResult
  (Health Score, Issue Counts, Issues)
               │
               ▼
     Admin Question Bank UI
 ┌────────────────────────────────────────┐
 │ • KPI Scorecards (Total, Valid, Score) │
 │ • Category Issue Breakdown Pills       │
 │ • Interactive Filterable Issues Table  │
 │ • Read-Only Question Inspector Modal   │
 └────────────────────────────────────────┘
```

### Key Architectural Characteristics
- **Client-Side & Deterministic**: Executes static analysis on the in-memory dataset in milliseconds without taxing backend servers.
- **100% Non-Destructive**: Read-only validation that does not alter, patch, or delete question records in the database.
- **Comprehensive Categorization**: Flags issues with explicit categories and severity ratings (`Critical` vs. `Warning`).
- **Granular Inspection**: Enables administrators to inspect the full prompt, answer, choice list, SVG markup, and raw JSON record for any flagged issue.

### The Six Audit Integrity Rules

| Rule Category | Severity | Detection Logic |
|---|---|---|
| **`MISSING_TEXT`** | `Critical` | Flags questions where `questionText`, `question`, or `text` is `undefined`, `null`, empty, whitespace-only, or $< 3$ meaningful characters. |
| **`MISSING_ANSWER`** | `Critical` | Flags questions where `answer` is `undefined`, `null`, empty string, or whitespace-only. *Explicitly preserves numeric `0` and string `"0"` as valid answers.* |
| **`INVALID_CHOICES`** | `Critical` | Evaluates when `answer_type === 'choice'`. Flags if `choices` is not an array, contains fewer than 2 non-empty items, or contains duplicates after trimming. |
| **`DUPLICATE_TEXT`** | `Warning` | Normalizes text (`trim()`, `toLowerCase()`, collapses whitespace `\s+`). Flags all question records sharing identical normalized prompts. |
| **`INVALID_LEVEL`** | `Warning` | Validates that canonical level (`level` or `source_level`) is an integer within the curriculum range $1 \le \text{level} \le 93$. |
| **`MALFORMED_SVG`** | `Warning` | Evaluates when SVG content exists (`svgHtml` or `svgAsset`). Flags markup missing opening `<svg` or closing `</svg>` tags. |

### Health Score Formula
$$\text{Health Score} = \left( \frac{\text{Valid Questions}}{\text{Total Questions}} \right) \times 100 \quad (\text{rounded to 1 decimal place})$$

A question is considered **Valid** if and only if it has **zero** audit issues across all six rules.

---

## 4. Technical Implementation

The feature was implemented cleanly across 3 new files and 2 modified navigation/routing files without altering any backend logic or database schemas:

### File Structure & Scope
```text
frontend/src/
├── utils/
│   ├── questionBankAudit.ts        [NEW] Pure static audit utility & TypeScript types
│   └── questionBankAudit.test.ts   [NEW] 12-scenario unit test suite
└── components/
    ├── Layout.tsx                  [MODIFIED] Added Question Bank nav for Admin roles
    ├── PanelViews.tsx              [MODIFIED] Added question_bank panel route
    └── panels/
        └── QuestionBankPanel.tsx   [NEW] Audit dashboard & read-only inspector UI
```

### 1. Pure Audit Engine (`questionBankAudit.ts`)
- **Zero Side Effects**: Free of React hooks, DOM manipulation, network calls, or state mutations.
- **Index-Based Tracking**: Uses a zero-based array index map (`Map<number, number>`) to track issue counts per question. This guarantees 1:1 accounting and prevents issue count collisions when questions in different sub-levels share local IDs (e.g., `L22-Q1`).
- **Core Interfaces**:
  ```typescript
  export type IssueCategory =
    | 'MISSING_TEXT'
    | 'MISSING_ANSWER'
    | 'INVALID_CHOICES'
    | 'DUPLICATE_TEXT'
    | 'INVALID_LEVEL'
    | 'MALFORMED_SVG';

  export type IssueSeverity = 'critical' | 'warning';

  export interface AuditIssue {
    id: string;
    questionId: string;
    level: number | null;
    category: IssueCategory;
    categoryLabel: string;
    severity: IssueSeverity;
    message: string;
    questionSnippet: string;
    rawQuestion: any;
  }

  export interface AuditResult {
    total: number;
    valid: number;
    issueCount: number;
    healthScore: number;
    categoryCounts: Record<IssueCategory, number>;
    issues: AuditIssue[];
  }
  ```

### 2. Admin Audit Dashboard (`QuestionBankPanel.tsx`)
- **Data Ingestion**: Fetches questions via `apiFetch('/api/admin/questions')` with graceful fallback to the seeded question pool if offline.
- **KPI Metrics Bar**: Displays Total Questions, Valid Questions, Issues Found, and Health Score percentage.
- **Category Filter Pills**: Interactive filter pills showing live issue counts per category.
- **Filterable Issues Table**: Tabular view displaying Severity badge, Category label, Question ID, FLN Level, Question Snippet, Issue Reason, and an Inspect action button.
- **Read-Only Question Inspector**: Modal window displaying comprehensive question metadata, prompt text, expected answer, choice badges, inline SVG preview, issue diagnostics, and formatted raw JSON.

### 3. Application Routing & Navigation
- **`PanelViews.tsx`**: Maps `panel === 'question_bank'` to `<QuestionBankPanel currentUser={currentUser} token={token} />`.
- **`Layout.tsx`**: Adds the `Question Bank` navigation item with `Database` icon for authorized administrative roles (`UserRole.SUPERADMIN`, `UserRole.ADMIN`, `UserRole.DISTRICT_ADMIN`, `UserRole.BLOCK_ADMIN`).

---

## 5. Admin User Experience

The audit workflow is designed to be intuitive and safe for non-technical administrators:

1. **Accessing the Portal**: Log in as an administrator (e.g., Superadmin, State Admin, District Admin, or Block Admin).
2. **Opening the Tool**: Click **Question Bank** in the sidebar navigation.
3. **Triggering the Audit**: Click **"Run Integrity Audit"** to re-analyze the question bank on demand.
4. **Evaluating Overall Health**: Review the KPI scorecards (Total Questions, Valid Questions, Issues Found, Health Score %).
5. **Analyzing Issue Categories**: Review the breakdown pills (`Duplicate Question`, `Missing Text`, `Missing Answer`, `Invalid Choices`, `Invalid Level`, `Malformed SVG`).
6. **Filtering & Searching**: Click any category pill or use the search bar to filter issues by Question ID, snippet keywords, or error description.
7. **Inspecting a Flagged Question**: Click **"Inspect"** on any row to open the read-only inspection modal.
8. **Reviewing Diagnostics**: View why the question was flagged, inspect the exact prompt, answer, choices, SVG graphics, and raw JSON record.
9. **Safe Dismissal**: Close the inspector with `Close Inspector` or `Esc` without any risk of accidental data mutation.

---

## 6. Testing & Verification

The feature underwent exhaustive automated and manual verification:

### Verification Summary Table

| Verification Step | Target / Command | Result | Status |
|---|---|---|:---:|
| **Unit Tests** | `npx tsx frontend/src/utils/questionBankAudit.test.ts` | 12/12 scenarios passed | **PASS** |
| **TypeScript Validation** | `npm run lint` (`tsc --noEmit`) | 0 compilation errors across `@fln/frontend` and `@fln/backend` | **PASS** |
| **Production Build** | `npm run build:frontend` | Vite v6.4.3 production bundle built cleanly in 6.27s | **PASS** |
| **Real Dataset Audit** | `data/questionBank.json` (1,202 records) | Processed all 1,202 records with 1:1 index tracking | **PASS** |
| **Browser E2E Testing** | `http://localhost:5173/` | Navigation, KPI cards, filter pills, search, inspector verified | **PASS** |
| **Git Safety & Scope** | `git diff --check`, `git status` | 0 backend files changed, 0 DB mutations, clean diff | **PASS** |

### 12 Unit Test Scenarios Covered
```text
✓ Test 1:  Valid question -> 0 issues (Health Score 100%)
✓ Test 2:  Empty/short question text (< 3 chars or whitespace) -> MISSING_TEXT
✓ Test 3:  Missing/null/undefined answer -> MISSING_ANSWER
✓ Test 4:  Numeric 0 and string "0" -> NOT flagged (Valid answers)
✓ Test 5:  Choice question with < 2 choices or duplicates -> INVALID_CHOICES
✓ Test 6:  Duplicate questions with whitespace/case differences -> DUPLICATE_TEXT
✓ Test 7:  Level 0 (below range) -> INVALID_LEVEL
✓ Test 8:  Level 94 (above range) -> INVALID_LEVEL
✓ Test 9:  Valid level boundaries (Level 1 and Level 93) -> 0 issues
✓ Test 10: Malformed SVG (missing opening or closing tag) -> MALFORMED_SVG
✓ Test 11: Valid SVG (<svg ... </svg>) -> 0 issues
✓ Test 12: Multiple issues on a single question -> All issues captured independently
```

### Real Dataset Audit Findings (`data/questionBank.json`)
Running the audit engine across the actual `data/questionBank.json` dataset produced:

```json
{
  "total": 1202,
  "valid": 790,
  "issues": 412,
  "healthScore": 65.7,
  "categoryCounts": {
    "MISSING_TEXT": 0,
    "MISSING_ANSWER": 0,
    "INVALID_CHOICES": 0,
    "DUPLICATE_TEXT": 412,
    "INVALID_LEVEL": 0,
    "MALFORMED_SVG": 0
  }
}
```

- **Analysis of Duplicate Findings**: The 412 duplicate-text warnings represent standardized curriculum template prompts repeated across sub-levels (e.g., *"Arrange in ASCENDING (smallest → largest): | Given: ..."*, *"Write the place value of the underlined digit:"*). The audit correctly flags them as duplicate prompts for administrative awareness without falsely classifying them as malformed records.

---

## 7. Key Technical Decisions

### 1. Decoupled Pure Audit Engine
The validation engine was designed as a pure, standalone TypeScript function completely independent of React, DOM APIs, and backend frameworks. This ensures:
- Instant unit testing with `tsx` / Node.js.
- Reusability in CI/CD pre-commit hooks, background validation jobs, or CLI scripts.
- Zero state side-effects or memory leaks.

### 2. Numeric Zero (`0`) Preservation
In foundational mathematics, `0` is a frequent and legitimate answer (e.g., $5 - 5 = 0$ or counting objects in an empty basket). Using naive JavaScript truthiness checks (`if (!answer)`) incorrectly flags `0` as missing. The audit engine explicitly checks `answer === undefined || answer === null || (typeof answer === 'string' && answer.trim() === '')`, preserving numeric `0` and string `"0"`.

### 3. Whitespace- & Case-Insensitive Normalization
Duplicate detection normalizes text via `.trim().toLowerCase().replace(/\s+/g, ' ')`. This catches duplicate questions regardless of accidental double-spaces, leading/trailing whitespace, or uppercase/lowercase differences.

### 4. Index-Based Internal Issue Tracking
In raw JSON datasets, questions across different sections often share local question numbers (e.g., multiple items named `L22-Q1`). Keying internal tracking maps by string IDs caused collisions. Keying by the array index (`idx: number`) ensures that every record is evaluated independently, yielding exact 1:1 total and valid counts.

### 5. Strictly Non-Destructive Architecture
Automatic database mutations on bulk datasets risk accidental content corruption. The audit tool is strictly read-only, serving as a diagnostic analysis and inspection tool rather than an automated mutator.

---

## 8. Challenges & Solutions

| Challenge | Root Cause | Solution Implemented |
|---|---|---|
| **Non-Unique Question IDs** | Real datasets reuse `questionNumber: 1` across sections within the same level. | Transitioned internal issue tracking in `questionBankAudit.ts` to use array index keys while preserving display IDs for the UI. |
| **Numeric Zero False Positives** | `0` is falsy in JavaScript conditional checks. | Refined the answer check to specifically target `null`, `undefined`, and empty strings while explicitly treating `0` and `"0"` as valid. |
| **Duplicate Collisions Across Sub-Levels** | Curriculum templates reuse identical prompt text with different numbers. | Implemented group-based duplicate indexing that reports all affected records with linked IDs. |
| **Optional SVG Markup Validation** | Some questions have SVGs while others are purely text/number based. | Guarded SVG integrity checking to only trigger when non-empty SVG strings are present. |
| **Read-Only Constraint Enforcement** | Risk of admin users attempting to edit question records in the UI. | Designed the Question Inspector as an explicit read-only drawer with syntax highlighting and diagnostic explanations, intentionally omitting edit/save controls. |

---

## 9. Results & Impact

1. **Instant Dataset Diagnostics**: Administrators can evaluate all 1,202 questions in milliseconds directly in their browser.
2. **Centralized Health Metric**: Provides a transparent, single-number metric (**65.7% Health Score**) reflecting dataset consistency.
3. **Zero Risk to Production Data**: 100% frontend-only static analysis ensures that auditing the question bank cannot corrupt or delete database records.
4. **Actionable Categorization**: Distinguishes between critical blocking errors (Missing Text, Missing Answer, Invalid Choices) and informative warnings (Duplicate Prompts).
5. **Detailed Read-Only Inspection**: Gives administrators full transparency into question prompts, expected answers, choices, and underlying JSON schemas.

---

## 10. Future Enhancements

The following features represent natural extensions of this work for future development cycles:

- **Audit Report Export**: Export categorized integrity audit results to CSV, PDF, or JSON for offline review.
- **Admin Remediation Workflow**: An authorized, staged workflow allowing administrators to propose, review, and apply fixes to flagged questions.
- **Automated CI/CD Quality Gate**: Run `questionBankAudit` in GitHub Actions pull request checks to prevent malformed questions from being merged into seed data.
- **Historical Audit Trend Tracking**: Store periodic audit scores to visualize dataset quality improvements over time.
- **Enhanced SVG Grammar Parsing**: Deeper static validation of SVG viewbox dimensions and nested XML elements.
- **Duplicate Cluster Visualizer**: Visual graph grouping questions that share duplicate prompts or structural templates.

---

## 11. Conclusion

The **Admin Question Bank Audit & Integrity Check** provides the FLN platform with a robust, production-quality static validation tool. By combining a pure TypeScript analysis engine with a clean, responsive Admin UI, the feature gives platform administrators immediate visibility into question bank quality while upholding strict non-destructive data safety standards.
