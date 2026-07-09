# Worksheet Workflow (Personalization Portal)

Full lifecycle of class-level worksheet generation, printing, timing management, and answer ingestion.

---

## Step 1: Generate Cycle Worksheets

- **Trigger:** Click one of three buttons:
  - "Generate Baseline Worksheets"
  - "Generate Mid-Year Worksheets"
  - "End-of-year"
- **API:** `POST /api/worksheets/generate`
- **Body:** `{ classId, cycle: 'Baseline' | 'Mid-year' | 'End-of-year' }`
- **Server logic:**
  1. Checks school exists
  2. **Teacher ban check** (§6.5) — if `user.isBanned` is true, returns 403
  3. **School access lock check** (§6.5) — if `school.isAccessLocked`, returns 403
  4. **Pairwise lock check** (§13.2 R-11) — if another role already generated for same class+cycle, returns 423
  5. Generates personalized questions per student using `generateQuestionsForLevel(student.currentLevel, subLevel)`
  6. Creates `Worksheet` with strict sequential timings:
     - **Print Window:** 1 hour
     - **Exam Window:** 45 minutes
     - **Submission Window:** 1 hour
  7. Logs the activity

## Step 2: Timing Cycle Monitor

Displays which window is currently active:

| Window | Duration | Color |
|---|---|---|
| Download & Print | 1 hour | Blue |
| Exam | 45 min | Amber |
| Ingestion & Upload | 1 hour | Green |
| Closed | — | Red |

## Step 3: Printable Worksheets View

- Shows all student worksheets with personalized questions
- Buttons:
  - **"Download PDF"** — if PDF URL available
  - **"Generate Worksheet PDF"** — `POST /api/worksheets/generate-pdf` with `{ worksheetId }`
  - **"Regenerate PDF"** — same endpoint when PDF already exists
  - **"Bulk Print A4"** — triggers `window.print()`

## Step 4: ICR Answer Ingestion

- Select a student from dropdown
- View their questions
- Fill answers (manual or sim buttons: Auto-solve, Fail Q1, Fail All)
- **API:** `POST /api/evaluation/submit`
- **Body:** `{ worksheetId, studentId, answers }`
- **Server logic:**
  1. Checks submission timing — delayed if past `submissionWindowEnd`
  2. Grades via `evaluateAIWorksheet()` (Gemini AI with fallback)
  3. Calculates subLevel based on performance at recommended level
  4. Saves `AnswerSubmission` and `EvaluationReport`
  5. Updates student: `currentLevel`, `currentSubLevel`, `targetLevel`, `levelHistory`, `streak`
  6. **Delayed submission escalation** (§6.5):
     - Increments `delayedAttemptsCount`
     - At 3 delays → teacher is **banned** (`isBanned: true`)
     - If all teachers in school are banned → school **access locked** (`isAccessLocked: true`)

## Step 5: Grading Scorecard

- Correct Score (X/Y)
- Level Progression (Lx.y)
- Sub-Level (Mastery / Easier / Remedial)
- Concept Mastery breakdown (per topic)
- AI Narrative Summary
