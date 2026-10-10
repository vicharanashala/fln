**1. What is FLN?**

FLN (Foundational Literacy and Numeracy) is about helping young children develop the basic reading, comprehension, and mathematics skills they need for later learning. This project focuses on building a system that can assess these foundational skills, identify where a student currently stands, provide targeted practice, and track progress over time.

The current repository is focused on mathematics. It supports personalized assessment and worksheet generation for students across the curriculum levels currently implemented in the system.

**2. What do you understand by FLN as a system?**

FLN is a connected assessment and learning workflow involving students, teachers, and administrators.

- Students have profiles containing their current learning level, assessment history, and progress.
- Teachers manage students/classes, generate assessments and worksheets, and review evaluation results.
- Administrators get higher-level views of schools, teachers, and student progress.
- Assessments produce information about a student's current level and areas that need more practice.
- Worksheets use that information to provide personalized practice.
- Completed assessments can be scanned and evaluated, after which the student's profile and progression can be updated.

The high-level cycle is:

Assess -> identify the student's current level/weak areas -> generate targeted practice -> reassess -> update progress.

For my contribution, I traced the personalized worksheet flow from the frontend to the backend PDF generator:

WorksheetWorkflow.tsx -> POST /api/worksheets/generate-pdf -> renderWorksheetPdf() in backend/src/paperGenerator.ts

**3. Current State of the Repository - What Has Been Done So Far**

Based on the repository areas I inspected while working on issue #597.

- Tech stack: React 19 + Vite + Tailwind on the frontend, Node.js + Express + TypeScript in the primary backend, MongoDB as the database, and a separate Python-based AI/OCR pipeline.

- Authentication and access control: The backend uses authentication and role-based access checks for different platform users.

- Student and teacher workflows: The platform supports student profiles, teacher dashboards, assessment generation, worksheet generation, result processing, and progress tracking.

- Question and curriculum system: Questions and worksheets are connected to curriculum levels and concepts. The repository is currently going through an ongoing curriculum and question-authoring migration, so new code needs to avoid assuming that the existing level structure is permanently fixed.

- Worksheet generation: Teachers can request standard or personalized worksheets. The personalized worksheet flow sends a request to the backend, where renderWorksheetPdf() in backend/src/paperGenerator.ts creates the PDF.

- PDF generation: The worksheet generator already handled worksheet metadata, student information, question rendering, and PDF output. However, while investigating issue #597, I found that personalized worksheet rendering only printed the first four questions.

- Testing: The backend has TypeScript checks and a Node.js test setup. I added a focused regression test for the worksheet PDF pagination bug.

**4. Gaps Observed in the Code**

1. Personalized worksheet PDFs silently dropped questions

- Where: backend/src/paperGenerator.ts, renderWorksheetPdf() (lines 597-704; the previous question rendering used slice(0, 4)).

- What: Personalized worksheets could contain more than four questions, but the PDF renderer only processed the first four.

- Why it matters: Questions after the fourth were silently missing from the final printable worksheet. The generated document therefore did not represent the complete set of questions selected for the student.

2. Worksheet PDF rendering had no pagination for additional questions

- Where: backend/src/paperGenerator.ts, renderWorksheetPdf() (pagination logic at lines 620-704).

- What: The previous implementation created one page per student and rendered the question list directly onto that page. Simply removing the four-question limit would not be sufficient because additional questions could extend into the footer or outside the printable area.

- Why it matters: A worksheet needs to preserve every selected question while keeping the PDF readable and printable.

**5. Ideas for the Project**

1. Stronger automated PDF regression coverage

- What: Expand PDF-generation tests to validate page counts, question numbering, and generated content for different question counts and multiple students.

- Why: A page-count regression catches missing pagination, while content and numbering checks can catch cases where pages exist but questions are still missing or duplicated.

- How: Generate PDFs with controlled test questions and inspect the resulting PDF using pdf-lib. Add cases for 0, 1, 4, 5, 7, 8, and larger question sets.

2. Dynamic PDF layout calculation

- What: Calculate how many questions fit on a page from the actual available vertical space instead of relying only on a fixed questions-per-page constant.

- Why: Question text and answer areas can vary in size, so a fixed count may not remain safe if future question formats become longer or require more space.

- How: Measure the rendered question/answer block, track the remaining page height, and create a new page when the next block cannot fit while preserving the existing header and footer.

3. Broader paper-generation test coverage

- What: Add focused tests for the other PDF-generation paths in paperGenerator.ts.

- Why: PDF generation is user-facing output, so regressions can result in incomplete or unusable worksheets even when the API request itself succeeds.

- How: Build small deterministic fixtures for each supported paper-generation path and validate PDF creation, page counts, and key output properties.

**6. My Contribution**

Fixed issue #597: Personalized worksheet PDF silently drops all questions past the 4th.

- Problem: renderWorksheetPdf() previously used slice(0, 4) when rendering personalized worksheet questions, so questions after the fourth were silently excluded from the generated PDF.

- Fix: Removed the four-question rendering limit and added pagination to the PDF generation flow.

- Pagination: The generator now renders up to seven questions per page using the existing page layout. Additional questions continue onto subsequent pages.

- Question numbering: Question numbers continue across pages. For example, an eight-question worksheet renders Q1-Q7 on the first page and Q8 on the second.

- Page numbering: Each page now displays its current page number and total page count.

- Regression test: Added backend/tests/paper-generator.test.ts. The test generates a worksheet containing eight questions and verifies that the resulting PDF contains two pages, catching the original four-question truncation behavior.

- Validation: The focused regression test passes successfully. git diff --check also passes. npm run lint reports six existing errors in unrelated backend files, including missing vite type/module resolution and duplicate identifiers in src/routes/admin.ts.
