# utils

## Overview
Small, framework-free helper modules used by components and panels: CSV export, FLN level progress arithmetic, OCR question alignment, question-bank auditing, question-family vocabulary and worksheet-template summarising. Each module has a sibling `*.test.ts`.

## Interface
- `csv.ts`: `csvCell`, `buildCsv(headers, rows)`, `downloadCsv(filename, csv)`.
- `flnLevelProgress.ts`: `getLevelProgressPercentage`, `getNextFLNLevel` (both clamp to `MAX_FLN_LEVEL` from `../data/skillProgressionMap`).
- `ocrQuestionMatching.ts`: `questionsLikelyMatch(extracted, known)`, `alignExtractedQuestions`.
- `questionBankAudit.ts`: `runQuestionBankAudit`, `normalizeQuestionText`, `extractQuestionText/Id/Level/Answer`, `extractSvgContent`, `CATEGORY_LABELS`, `CATEGORY_SEVERITIES`, types `IssueCategory`, `IssueSeverity`, `AuditIssue`, `AuditResult`.
- `questionFamily.ts`: `QUESTION_FAMILIES`, `QUESTION_FAMILY_LABELS`, `isQuestionFamily`, type `QuestionFamily`.
- `worksheetTemplates.ts`: `isPrintable`, `summarizeTemplatesByConcept`, type `ConceptTemplateSummary`.

## Invariants
- `csvCell` quotes every cell and prefixes cells starting with `= + - @`, tab or CR with an apostrophe to defuse spreadsheet formulas; `downloadCsv` prepends a UTF-8 BOM.
- Level progress is always clamped to 0-100 percent and level 1..`MAX_FLN_LEVEL`.
- `QUESTION_FAMILIES` mirrors `backend/src/types/questionTemplateParams.ts`; `questionFamily.test.ts` fails if the lists drift.

## Side Effects
- `downloadCsv` creates a Blob URL and a temporary `<a>` element in `document.body` to trigger a browser download. All other functions are pure.

## Verification
- Run: `npm test --workspace @fln/frontend` (vitest run, from repo root)
