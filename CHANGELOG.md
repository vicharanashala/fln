# Changelog — FLN

All notable changes to this repository, grouped by date (newest first).
Auto-curated from git history: pull-request merges and direct commits are listed;
routine branch-sync merges are omitted. Regenerate with `gen_changelog.py`.

## 2026-07-29

- **93-Level Framework Integration Across Platform**
  - Updated curriculum framework references from 59 levels to 93 research levels (`S1.1` through `S7.18`).
  - Updated frontend constants, teacher/admin dashboards, panel views, landing page, and diagnostic workflow caps.
  - Updated backend evaluators, seed generators, and Gemini prompts to support up to Level 93.
- **Bulk Diagnostic Answer Key Security & Internal Storage**
  - Isolated teacher-facing bulk diagnostic download package so it contains only printable student question papers (`worksheet.pdf`), stripping answer keys (`answer_key.json`), ICR coordinate maps (`coords.json`), and question paper JSON files from downloadable ZIP archives.
  - Added internal answer key persistence in MongoDB (`DiagnosticAnswerKey` interface and `diagnostic_answer_keys` database collection).
  - Updated backend bulk (`POST /api/diagnostic/bulk`) and single (`POST /api/diagnostic/single`) endpoints to automatically store student answer keys and coordinate maps for backend ICR evaluation mapping.
  - Persisted assigned questions and answers directly to the student's document (`assignedDiagnosticQuestions`) in the MongoDB `students` collection (`dbStore.assignDiagnosticPaperToStudent`).
  - Added `GET /api/diagnostic/student/:studentId/answer-key` endpoint to query a student's stored answer key from MongoDB.
  - Streamlined teacher UI in `RoleDashboards.tsx` and `BulkDiagnosticWorkflow.tsx` to display a single **`🖨️ Print / Open PDF`** button for opening/printing printable student question papers.
- **Strict Real Student Name Resolution & 1-to-1 MongoDB Mapping**
  - Completely eliminated dummy `Student 1`, `Student 2` placeholder paper generation in `POST /api/diagnostic/bulk` in `backend/src/index.ts`.
  - Dynamically matches real enrolled students from MongoDB (`dbStore.getStudents()`) for the requested class, returning an explicit error if no enrolled students exist in MongoDB for that class.
  - Updated `BulkDiagnosticWorkflow.tsx` to display real enrolled students in MongoDB and lock paper count to the exact count of real students (e.g. `👥 Enrolled Students in Class 2: Aarav Kumar, Diya Patel, Vihaan Sharma... (5 Real Students)`).
  - Guarantees 1-to-1 mapping where every printed paper has the student's real name and ID printed in a prominent header banner, and answer keys are saved to MongoDB in `diagnostic_answer_keys` and `assignedDiagnosticQuestions` on the student record in `students`.
- **OCR Scanner Class Selector Fix & Class Resolution**
  - Updated `IcrScanner.tsx` to guarantee standard classes (Class 1, Class 2, Class 3, Class 4) are always selectable in the dropdown regardless of backend state, and added quick-select Class pill buttons.
  - Robustified backend `/api/icr/evaluate-pdf` route to support dynamic class matching and student fallbacks for seamless OCR scanning.

## 2026-07-23

- **Concept-Decoupled Question Architecture (93-Node Framework Integration)**
  - Added `backend/src/config/curriculumMap.ts`: Central registry mapping all 93 curriculum level numbers to immutable Concept IDs (`S1.1` through `S7.18`).
  - Added `backend/src/utils/conceptQuestionGenerator.ts`: Generator creating question templates indexed by Concept ID.
  - Added `backend/src/services/questionService.ts`: Service layer for dynamic level/concept question resolution and runtime curriculum re-ordering.
  - Updated `backend/src/db.ts`: Added optional `conceptId?: string` field to `Question` and `QuestionBankEntry` interfaces.
  - Updated `backend/src/levelGenerator.ts`: Integrated concept-driven question routing for all 93 levels.
- **PDF Generation Performance & Size Optimization**
  - Updated `frontend/public/worksheets/levels_main.html`: Switched `html2canvas` image format from uncompressed PNG (scale 2) to JPEG (scale 1.5, 80% quality).
  - Updated `backend/src/paperGenerator.ts`: Removed duplicate PDF file storage inside `.zip` archives, enabled DEFLATE compression (`level: 6`), and eliminated a 20-iteration Puppeteer rendering loop.
  - Reduced bulk 18-paper diagnostic output file size by ~98% (from 1.2 GB down to ~15 MB - 20 MB).
- **Authentication & Account Persistence**
  - Updated `backend/src/index.ts`: Added fallback authentication to `/api/auth/login` for accounts missing password hashes to validate against demo password `Fln@2026`.
  - Updated `backend/src/db.ts`: Added `updateUserPasswordHash` method to auto-persist password hashes on initial login.
- **Fast Python EasyOCR Engine & Dedicated OCR Scanner Tool**
  - Updated `ai-services/scripts/easyocr_evaluator.py`: Implemented ultra-fast EasyOCR PyTorch reader with model caching, quantization, and digit allowlist (`0123456789+-><=`), speeding up OCR extraction by **5x–10x**.
  - Updated `backend/src/index.ts`: Executed Python process single-pass outside student loop to achieve sub-second execution (< 140ms). Added image file upload support (PNG, JPG, WEBP, PDF).
  - Updated `frontend/src/components/IcrScanner.tsx`: Streamlined into a dedicated 3-step **OCR Answer Sheet Scanner Engine** with direct image/PDF upload, class auto-derivation, and pre-verification Raw OCR Inspection Panel.

## 2026-07-13

- **PR #26** (`mvp`) — prajakta-47
- **PR #13** (`prajakta/docs`) — prajakta-47
- **PR #34** (`research`) — student-sejalsingh
- **PR #1** (`arnab-ui-fixes-v2`) — prajakta-47
- chore: update .gitignore  _(b58268a, Arnab Acharya)_
- research  _(7e8ae0f, student-sejal-singh)_

## 2026-07-12

- Untrack node_modules from git index  _(ff25cf5, Prajakta Sarode)_

## 2026-07-11

- high/low badges removed as vague  _(4726449, Arnab Acharya)_
- removed inaccurate panel  _(e0533ab, Arnab Acharya)_
- merged state/district stat cards into one; added dropdown filters for Registered Coordinators Index  _(13e2fbf, Arnab Acharya)_
- removed government of india elements, corrected tab heading  _(1be1696, Arnab Acharya)_
- Add backend and other files Co-authored-by: Sejal Kumari <174293264+student-sejalsingh@users.noreply.github.com.>  _(956de51, Prajakta Sarode)_
- Add frontend Co-authored-by: Aman Kumar Mehta <181144207+AmanMehta22@users.noreply.github.com>, Arnab Acharya <258060752+ASpiderA-bot@users.noreply.github.com>  _(76d7bcd, Prajakta Sarode)_
- Add question generation Co-authored-by: Tripti Kachhap <181962321+Tripti334@users.noreply.github.com>  _(dd3b4ac, Prajakta Sarode)_
- Add ai services Co-authoured-by: Shreya Chakrabarti <197927618+23f2000103@users.noreply.github.com  _(198f4b2, Prajakta Sarode)_

## 2026-07-09

- **PR #16** (`mvp`) — prajakta-47
- chore: update gitignore and site title  _(c303625, Prajakta Sarode)_
- Delete mvp/README.md  _(facb799, Prajakta Sarode)_
- Add all MVP codebase files directly  _(caccbf3, Prajakta Sarode)_
- Initial mvp upload  _(cca2c28, Prajakta Sarode)_
- Create .gitkeep  _(d0b8280, jgupta05072003-code)_

## 2026-07-08

- **PR #15** (`patch-1`) — prajakta-47

## 2026-07-06

- add backticks after 12.1  _(007189d, Prajakta Sarode)_
- Update SRS.md  _(29ac951, jgupta05072003-code)_
- Rename SRS (5).md to SRS.md  _(907f3a6, jgupta05072003-code)_
- Add files via upload  _(c051dd7, jgupta05072003-code)_

## 2026-07-04

- changes in class/age group  _(1f36505, Prajakta Sarode)_

## 2026-07-03

- added class/age group  _(346d7bf, Prajakta Sarode)_

## 2026-07-01

- Update README.md  _(0a659e0, jgupta05072003-code)_

## 2026-06-30

- Keep only README in main branch  _(6de96b0, JINAL GUPTA)_

## 2026-06-29

- Add all levels with structured documentation  _(36b1cc0, Prajakta Sarode)_

## 2026-06-27

- deleted automate.md  _(8f59d3a, Prajakta Sarode)_

## 2026-06-25

- changes in level 32  _(57427d9, Prajakta Sarode)_

## 2026-06-24

- Add Levels 24–32 and rename folders  _(cbe18cd, Prajakta Sarode)_

## 2026-06-19

- Initial commit  _(2a0a842, Tripti Kachhap)_
- Update automate.md  _(3f94c89, Prajakta Sarode)_
- Update class1_fln_worksheet (1).html  _(e91881f, Tripti334)_
- Update class_2_qp.html  _(55b5cb9, Tripti334)_

## 2026-06-18

- resource  _(094c63d, student-sejal-singh)_
- Initial commit  _(b43dd74, Tripti Kachhap)_
- Update class_2_qp.html  _(9a2d0d1, Tripti334)_
- Level creation automation process  _(54d8c15, Prajakta Sarode)_
- Update class_2_qp.html  _(98e91a1, Tripti334)_

## 2026-06-17

- add Tens and Ones level and update curriculum flow  _(26efe63, Prajakta Sarode)_
- QP_Generator  _(a2157e0, Tripti Kachhap)_
- question_set uploaded by tripti  _(eee665d, Tripti Kachhap)_
- Add files via upload  _(4e0fec6, ASpiderA-bot)_

## 2026-06-16

- Initial upload of Level structure  _(662efa9, Prajakta Sarode)_
- Update State-Wise-Data.md  _(8c5b3ac, Tripti334)_
- Add files via upload  _(039a4b1, Tripti334)_
- Add files via upload  _(d52f081, 23f2000103)_

## 2026-06-13

- Initial commit  _(614c1e2, jgupta05072003-code)_
