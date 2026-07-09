# Diagnostic Workflow

Triggers an onboarding AI diagnostic test for a student with no FLN level history.

---

## Step 1: Generate Diagnostic Paper

- **Trigger:** Click **"Run Diagnostic"** on an unplaced student in the roster
- **API:** `POST /api/students/:id/diagnostic`
- **Response:** `{ student, diagnosticPaper: { id, studentId, studentName, questions[], pdfUrl } }`
- **Server logic:**
  1. Extracts class number from the student's `classGroup` (e.g. "Class 2" → 2)
  2. Attempts PDF generation via Puppeteer (`generateDiagnosticPaper`)
  3. Falls back to `generateQuestionsForLevel()` across 8 levels if Puppeteer fails

## Step 2: Fill Answers

Teacher sees the generated questions and can:

- **Manually type** number/text answers
- **Select** from choices (for choice-type questions)
- **Use simulation buttons:**
  - *Solve All Correctly* — fills all correct answers
  - *Fail Question 1* — fills Q1 as "FAIL"
  - *Fail All (Remedial L1.2)* — fills all as "WRONG"

## Step 3: Submit & Grade

- **API:** `POST /api/students/:id/diagnostic/submit`
- **Body:** `{ questions, answers }`
- **Server logic:**
  1. Calls `evaluateAIDiagnostic()` (Gemini AI with fallback to deterministic grading)
  2. Applies **Weakest-Level Mapping**: student is placed at the lowest level where they showed weakness
  3. Calculates `subLevel`: 0 = Mastery, 1 = Easier, 2 = Remedial
  4. Updates student: `currentLevel`, `currentSubLevel`, `targetLevel`, `levelHistory`
  5. Creates `EvaluationReport` and `LogEntry`

## Step 4: Results

Teacher sees:
- Score (X/Y correct)
- Placed Level (Lx.y)
- Target Level
- AI Narrative Feedback Summary
- **"Acknowledge Placement & Roster Student"** button to return to dashboard
