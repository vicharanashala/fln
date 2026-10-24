# FLN Onboarding Document — Ravi Bhatt

## 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy. It refers to the basic reading, writing, language, and mathematical skills that children develop during their early years of education.

These skills are essential because they provide the foundation for future learning. If children struggle with basic concepts, they may find it difficult to understand more advanced topics.

A digital FLN platform can help teachers assess students, identify learning gaps, provide suitable practice activities, and track their progress. The goal is to make foundational learning more accessible, structured, and effective.

## 2. What do you understand by FLN (as a system)?

I understand FLN as a system that connects students, teachers, learning content, assessments, and progress tracking.

The system can follow a continuous learning cycle:

1. Assess the student's current understanding.
2. Identify the concepts where the student needs improvement.
3. Provide appropriate questions and learning activities.
4. Record the student's responses or teacher observations.
5. Evaluate progress and plan further learning activities.

An effective FLN system should support different learning levels and assessment methods. Some skills can be assessed through written answers, while others require teachers to observe a child's performance.

Question quality, appropriate assessment modes, multilingual content, and reliable progress data are important for ensuring that the system provides meaningful educational support.

## 3. Current State of the Repository — What Has Been Done So Far

During onboarding, I explored the FLN repository and started tracing the backend implementation related to question generation, question templates, and worksheet PDF generation.

The following files were inspected:

- `backend/src/utils/conceptQuestionGenerator.ts`
- `backend/src/services/questionService.ts`
- `backend/src/levelGenerator.ts`
- `backend/src/routes/questionTemplates.ts`
- `backend/src/seedBalvatikaQuestionTemplates.ts`
- `backend/src/paperGenerator.ts`
- `backend/src/pdfMerge.ts`
- `backend/src/index.ts`
- `backend/src/db.ts`
- `backend/src/config/environment.ts`

### Question generation

In `backend/src/utils/conceptQuestionGenerator.ts`, the `generateQuestionsByConcept()` function generates questions using a loop that runs from question 1 to question 4 (lines 13–21). The default branch also creates generic questions containing the concept ID, level number, and question number (around lines 220–230).

In `backend/src/levelGenerator.ts`, `QUESTIONS_PER_LEVEL` is set to `4` (lines 6–7). The level generator first attempts to use question templates and has a fallback path through the question service (lines 22–38).

These observations identify where question count and fallback behavior are controlled.

### Question templates and imports

In `backend/src/routes/questionTemplates.ts`, the route defines the assessment modes `written`, `observed`, and `both` (around line 30).

The `buildTemplate()` function accepts an optional assessment mode and defaults it to `written` when none is provided (around lines 195–245). The single-template form validates and passes the selected mode to the builder.

The bulk CSV import defines its accepted column names in `CSV_COLUMNS` (around lines 315–323). The import handler reads fields such as `conceptId`, `generationIntent`, and `answerSpec`, but its call to `buildTemplate()` does not pass `assessmentMode` (around lines 619–648).

The existing seeder, `backend/src/seedBalvatikaQuestionTemplates.ts`, includes assessment-mode values in its records, while the seeded `stem` and `answerSpec` fields are empty (around lines 208–218).

### Worksheet PDF generation

In `backend/src/paperGenerator.ts`, the worksheet-generation code embeds `StandardFonts.Helvetica` and `StandardFonts.HelveticaBold` (around lines 953–956).

The `printableText()` helper checks each character against the supported character set. Unsupported characters are replaced with `?` (around lines 910–917). Question text and answer choices are processed before being drawn onto the worksheet (around lines 981–983 and 1028–1037).

In `backend/src/pdfMerge.ts`, Helvetica Bold is used to draw student identification labels onto merged PDF pages (around lines 22–23 and 58–63).

These findings show that the PDF generation path needs investigation for content containing Hindi characters.

### Local development setup

I attempted to run the backend locally using `npm run dev`. The server started at `http://localhost:5000`, but the remote MongoDB connection failed. The application reported that it was falling back to file-based storage.

This helped me understand part of the local development setup. The database connection issue remains separate from the question-generation and PDF-rendering gaps discussed below.

## 4. Gaps Observed in the Code

The following gaps are based on my source-code inspection and are related to the reported project issues. The observations describe the current implementation I inspected; the proposed changes still require testing and maintainer review.

### Gap 1 — Fixed question count and generic fallback questions

**Related issue:** [#760 — Balvatika question generation](https://github.com/vicharanashala/fln/issues/760)

**Where:**
- `backend/src/utils/conceptQuestionGenerator.ts`, lines 13–21 and around 220–230.
- `backend/src/services/questionService.ts`, lines 10–17.
- `backend/src/levelGenerator.ts`, lines 6–7 and 22–38.

**What I observed:** The concept-based generator loops from question 1 to question 4, so each call generates four questions. Its default branch creates generic questions containing the concept ID and question number, with numeric answers such as 10, 20, 30, and 40. The level generator also defines `QUESTIONS_PER_LEVEL` as `4` and attempts to use templates before falling back to the concept-based question service.

**Why it matters:** A fixed count can prevent the generator from meeting a different question-count requirement. Generic fallback questions may not assess the intended learning concept, which can reduce the usefulness of an assessment for teachers and students.

**What needs further verification:** Test the output for all relevant Balvatika levels, identify levels that use the generic fallback, and check for repeated questions. The reported issue calls for ten questions per Balvatika level without placeholders or repeats.

### Gap 2 — Bulk CSV import does not preserve assessment mode

**Related issue:** [#761 — Balvatika question-bank and assessment-mode handling](https://github.com/vicharanashala/fln/issues/761)

**Where:**
- `backend/src/routes/questionTemplates.ts`, around lines 30 and 195–245.
- `backend/src/routes/questionTemplates.ts`, around lines 315–323.
- `backend/src/routes/questionTemplates.ts`, around lines 579–648.
- `backend/src/seedBalvatikaQuestionTemplates.ts`, around lines 69–185 and 208–218.

**What I observed:** The route defines three assessment modes: `written`, `observed`, and `both`. The template builder accepts an optional `assessmentMode` and defaults it to `written`. The single-template form passes the selected mode to the builder.

However, the CSV column list does not include `assessmentMode`, and the bulk import handler does not read or pass this field to `buildTemplate()`. It reads `answerSpec`, but that field does not replace the assessment-mode setting.

The existing seed data also contains records with different assessment modes and empty `stem` and `answerSpec` fields.

**Why it matters:** A template imported from CSV can receive the default `written` mode even if it was intended for observation. This can lead to an activity being handled in an unsuitable assessment format for the teacher and child.

**What needs further verification:** Test CSV import behavior, confirm how the worksheet generator filters templates by assessment mode, and determine the intended approval status for new or imported question-bank content with the maintainers.

### Gap 3 — Standard PDF fonts replace unsupported Hindi characters

**Related issue:** [#757 — Hindi text in worksheet PDFs](https://github.com/vicharanashala/fln/issues/757)

**Where:**
- `backend/src/paperGenerator.ts`, lines 910–917.
- `backend/src/paperGenerator.ts`, lines 953–956.
- `backend/src/paperGenerator.ts`, lines 981–983 and 1028–1037.
- `backend/src/pdfMerge.ts`, lines 22–23 and 58–63.

**What I observed:** The `printableText()` helper normalizes text to NFC and checks each character against the supported character set. If a character is unsupported, the function replaces it with `?`. The worksheet-generation path embeds the standard Helvetica and Helvetica Bold fonts rather than a Hindi-capable font.

The inspected code therefore shows that unsupported characters can be changed before question text is drawn in the PDF. The text drawn by `pdfMerge.ts` in the inspected section is a student identification label, not the main Hindi question content.

**Why it matters:** If Hindi characters are replaced with question marks, children and teachers may receive worksheets with missing or altered text. This can make questions difficult to understand and reduce the usefulness of the assessment.

**What needs further verification:** Generate a sample worksheet containing Hindi text and inspect the resulting PDF. Confirm the behavior with representative Devanagari characters before choosing a font-embedding and rendering solution. The related [PR #830](https://github.com/vicharanashala/fln/pull/830) should also be reviewed before starting work.

## 5. Ideas for the Project

The following ideas are directly connected to the gaps identified in Section 4.

### A. Make question generation configurable and reliable

**Related gap:** Gap 1 — `backend/src/utils/conceptQuestionGenerator.ts` and `backend/src/levelGenerator.ts`.

Make the requested question count configurable where appropriate. Avoid generic placeholder questions when a suitable question generator or approved template is unavailable. Add tests for the required question count, missing templates, and repeated questions across the relevant Balvatika levels.

### B. Preserve assessment mode during bulk import

**Related gap:** Gap 2 — `backend/src/routes/questionTemplates.ts`.

Investigate adding `assessmentMode` to the CSV import columns and passing the validated value to `buildTemplate()`. Test imports for `written`, `observed`, and `both`, including invalid values and missing fields. Confirm the intended approval workflow with maintainers before changing how imported questions become eligible for use.

### C. Support Hindi text in worksheet PDFs

**Related gap:** Gap 3 — `backend/src/paperGenerator.ts`.

Investigate embedding and using a font that supports Devanagari characters. Add a reproducible test or sample worksheet containing Hindi text and verify that the output preserves the characters correctly without breaking existing worksheet generation.

### D. Add focused regression tests

**Related gaps:** Gaps 1, 2, and 3.

Add tests for question generation, CSV assessment-mode handling, and multilingual PDF rendering. Keep the tests focused on the relevant behavior and follow the repository's existing testing conventions.

These ideas should be implemented incrementally after reviewing existing tests, related pull requests, and dependencies. Question-bank content and approval policies should be confirmed with the maintainers rather than decided solely through code changes.

## 6. Your Contribution

During my initial onboarding, I explored the FLN repository and traced the implementation of question generation, question-template imports, and worksheet PDF generation.

My concrete work so far includes:

- Inspected the concept-based question generator and identified the fixed four-question loop and generic fallback branch.
- Traced how the level generator uses templates and falls back to the question service.
- Inspected the question-template route and identified that bulk CSV import does not pass `assessmentMode` to the template builder.
- Inspected the PDF text-handling helper and confirmed that unsupported characters are replaced with `?`.
- Ran the backend locally using `npm run dev`. The server started at `http://localhost:5000`, but the remote MongoDB connection failed and the application fell back to file-based storage.

I have not yet completed a code fix or regression test for these gaps. My next step is to verify the behavior with focused tests and sample outputs, review related pull requests, and discuss any content-approval decisions with the maintainers before proceeding with code contributions.

I aim to make small, focused, tested, and issue-linked contributions that follow the repository's conventions and support the educational needs of teachers and students.