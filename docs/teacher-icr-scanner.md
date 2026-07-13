# ICR Answer Sheet Scanner

Simulates a physical ICR scanner for single-student diagnostic evaluation, with animated scanning experience.

---

## Step 1: Select Student

- **Trigger:** Click **"ICR Answer Sheet Scanner"** on dashboard sidebar
- Select a **class** from dropdown, then a **student** from filtered list
- Displays student info: name, current level, diagnostic status

## Step 2: Generate Paper

- **API:** `POST /api/students/:id/diagnostic`
- Auto-triggered when proceeding to scanner

## Step 3: Place Paper in Scanner

- Visual ICR-9000 scanner machine representation
- Click **"Start Scan"** to begin

## Step 4: Scanning Animation

Animated phases (automatic):
1. **"Feeding Paper..."** (1 second)
2. **"Scanning Answer Sheet..."** (2 seconds, moving light bar)
3. **"ICR Extraction Complete"** (0.8 seconds)

## Step 5: Verify Extracted Answers

- Shows all answers with match/differs-from-key indicators
- Teacher can manually edit each answer

## Step 6: Submit & Evaluate

- **API:** `POST /api/students/:id/diagnostic/submit`
- Same evaluation as DiagnosticWorkflow (Weakest-Level Mapping)

## Step 7: Results

- Score (X/Y)
- Placed Level (Lx.y)
- Status ("Certified" if placed)
- Concept Mastery breakdown
- AI Narrative Summary
- Buttons: **"Scan Another Student"** or **"Back to Dashboard"**
