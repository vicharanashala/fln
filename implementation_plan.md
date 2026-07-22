# Adaptive Concept-Wise Reinforcement in Assessments

After every assessment, track per-student concept mastery. When generating the next assessment, automatically inject reinforcement questions for weak concepts — more questions for weaker concepts, tapering off once mastery is achieved.

## Analysis Summary

### Where assessment results are stored today

| What | Where | Details |
|------|-------|---------|
| **EvaluationReport** (per assessment) | [db.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/db.ts#L164-L175) interface, persisted in MongoDB `evaluation_reports` collection | Already has `conceptMastery: { [topic]: 'Strong' \| 'Needs Practice' \| 'Satisfactory' }` — but this is **flat & non-cumulative** (one snapshot per assessment) |
| **AnswerSubmission** | [db.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/db.ts#L152-L162) — MongoDB `answer_submissions` collection | Raw `{ [questionId]: answer }` map |
| **Student.levelHistory** | [db.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/db.ts#L70-L84) | Only tracks level/subLevel transitions, no concept-level detail |

### Where questions are generated today

| Flow | File | Logic |
|------|------|-------|
| **Personalized worksheet generation** (`POST /api/worksheets/generate`) | [index.ts:839-861](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts#L839-L861) | Calls `generateQuestionsForLevel(level, subLevel)` per student |
| **Level question builder** | [levelGenerator.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/levelGenerator.ts) | Builds 4 questions per (level, subLevel). Each question has a `topic` field |
| **AI worksheet generation** | [gemini.ts:464-551](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/gemini.ts#L464-L551) `generateAIPersonalizedWorksheet()` | Gemini API generates 3 questions given level + topic categories |
| **Diagnostic test** | [index.ts:497-556](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts#L497-L556) | Uses Puppeteer pipeline or fallback `generateQuestionsForLevel` |

### Where assessment evaluation happens

| Flow | File | Key Lines |
|------|------|-----------|
| **Diagnostic submit** | [index.ts:590-781](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts#L590-L781) | Runs Python pipeline → fallback to `evaluateAIDiagnostic()`. Creates `EvaluationReport` with `conceptMastery` |
| **Worksheet submit** | [index.ts:1217-1392](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts#L1217-L1392) | Calls `evaluateAIWorksheet()` → creates `EvaluationReport` with `conceptMastery`, updates student level |
| **AI evaluation** | [gemini.ts:557-646](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/gemini.ts#L557-L646) `evaluateAIWorksheet()` | Returns `conceptMastery` map + `score` + `narrative` + `recommendedLevel` |

---

## Open Questions

> [!IMPORTANT]
> **Mastery threshold**: What score/percentage should define "mastered"? The current system uses:
> - `Strong` (≥80%) → advance
> - `Satisfactory` (50-80%) → retain
> - `Needs Practice` (<50%) → remediate
>
> I'll use this same 3-tier model for the reinforcement engine. Should I adjust these thresholds?

> [!IMPORTANT]
> **Reinforcement question count**: I'm proposing to add **1–4 extra reinforcement questions** per weak concept per assessment. The weaker the concept, the more questions:
> - `Needs Practice` → 3-4 reinforcement questions
> - `Satisfactory` → 1-2 reinforcement questions  
> - `Strong` → 0 (skip, mastered)
>
> Is this scale appropriate, or would you prefer different numbers?

> [!IMPORTANT]  
> **Concept granularity**: Currently, topics are broad categories like `Number Sense`, `Shapes`, `Fractions`, `Number Operations`, `Measurement`, `Money`, `Data Handling`, `Calendar & Time`. Should I track at this level, or also track at the **subtopic** level (e.g., `Single-digit Operations`, `Two-digit Operations`, `Place Value`)?

---

## Proposed Changes

### Component 1: New Data Model — `ConceptMasteryProfile`

A **cumulative, per-student, per-concept** profile that evolves over time (unlike the current one-shot `EvaluationReport.conceptMastery`).

#### [NEW] [conceptMastery.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/conceptMastery.ts)

New file defining the `ConceptMasteryProfile` interface and the reinforcement engine logic.

```typescript
export interface ConceptScore {
  topic: string;
  totalAttempts: number;      // how many questions attempted on this topic
  correctCount: number;       // how many answered correctly
  masteryPct: number;         // rolling accuracy percentage
  status: 'Strong' | 'Satisfactory' | 'Needs Practice';
  lastAssessedAt: string;     // ISO date
  consecutiveMasteryCount: number; // times in a row status was 'Strong'
}

export interface ConceptMasteryProfile {
  id: string;
  studentId: string;
  concepts: ConceptScore[];
  updatedAt: string;
}
```

**Key design choices:**
- `consecutiveMasteryCount` tracks how many assessments in a row the concept was "Strong" — once it hits 2+, the concept is considered **fully mastered** and no more reinforcement questions are added.
- `masteryPct` is a rolling weighted average (recent assessments weighted more) rather than a simple lifetime average, so improvement is reflected quickly.

---

### Component 2: Database Layer

#### [MODIFY] [db.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/db.ts)

- Add `ConceptMasteryProfile` to the `DatabaseSchema` interface
- Add `conceptMasteryProfiles` to `COLLECTION_NAMES` (→ MongoDB collection `concept_mastery_profiles`)
- Add CRUD methods to `DBStore`:
  - `getConceptMasteryProfile(studentId: string): Promise<ConceptMasteryProfile | null>`
  - `upsertConceptMasteryProfile(profile: ConceptMasteryProfile): Promise<void>`

---

### Component 3: Post-Assessment Concept Tracker

#### [NEW] [reinforcementEngine.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/reinforcementEngine.ts)

Contains two core functions:

**`updateConceptMastery(studentId, questions, answers, dbStore)`**
- Called immediately after every assessment evaluation (diagnostic or worksheet).
- Extracts per-topic performance from the just-completed assessment.
- Loads the existing `ConceptMasteryProfile` (or creates a new one).
- Updates `totalAttempts`, `correctCount`, `masteryPct` using a weighted rolling formula.
- Recalculates `status` per concept.
- Increments or resets `consecutiveMasteryCount`.
- Persists the updated profile.

**`getReinforcementQuestions(studentId, currentLevel, dbStore)`**
- Called during worksheet generation.
- Loads the student's `ConceptMasteryProfile`.
- Identifies concepts where `status !== 'Strong'` OR `consecutiveMasteryCount < 2`.
- For each weak concept, determines how many reinforcement questions to add:
  - `Needs Practice` → 3 questions
  - `Satisfactory` → 1 question
  - Recently mastered (`Strong` but `consecutiveMasteryCount < 2`) → 1 question (verification)
- Generates reinforcement questions by:
  1. First, trying to pick from `generateQuestionsForLevel()` filtering by matching `topic`.
  2. If not enough, falling back to the AI `generateAIPersonalizedWorksheet()` with the weak topic.
- Returns an array of `Question[]` tagged with `subtopic: 'Reinforcement'` so they're identifiable.

---

### Component 4: Integration into Assessment Submission Endpoints

#### [MODIFY] [index.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts)

**4a. Diagnostic submit (`POST /api/students/:id/diagnostic/submit`, ~line 590–781)**

After the evaluation report is created and the student's level is updated (line 765), add:

```typescript
// Update cumulative concept mastery profile
await updateConceptMastery(student.id, questions, answers, dbStore);
```

**4b. Worksheet submit (`POST /api/evaluation/submit`, ~line 1217–1392)**

After `addEvaluationReport(report)` (line 1291), add:

```typescript
// Update cumulative concept mastery profile
await updateConceptMastery(student.id, studentQuestions, answers, dbStore);
```

---

### Component 5: Integration into Worksheet Generation

#### [MODIFY] [index.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts)

**5a. Personalized worksheet generation (`POST /api/worksheets/generate`, ~line 839–861)**

Current code loops over each student and generates 4 level-appropriate questions. After the existing loop, add reinforcement injection:

```typescript
for (const student of classStudents) {
  const subLvl = student.currentSubLevel || 0;
  const qs = generateQuestionsForLevel(student.currentLevel, subLvl);
  
  // Existing: add level questions
  qs.forEach(q => { /* existing code */ });

  // NEW: Add reinforcement questions for weak concepts
  const reinforcementQs = await getReinforcementQuestions(
    student.id, student.currentLevel, dbStore
  );
  reinforcementQs.forEach(q => {
    compiledQuestions.push({
      ...q,
      question_id: `${student.id}_REINF_${q.question_id}`,
      question: `[Reinforcement - ${q.topic}] ${q.question}`
    });
  });
}
```

---

### Component 6: Frontend Types Update

#### [MODIFY] [types.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/frontend/src/types.ts)

Add the `ConceptMasteryProfile` and `ConceptScore` interfaces so the frontend can display concept mastery data if needed (dashboards, student detail views).

---

### Component 7: API Endpoint for Viewing Concept Mastery

#### [MODIFY] [index.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts)

Add a new read-only endpoint after the existing evaluation history route (~line 1399):

```
GET /api/students/:id/concept-mastery
```

Returns the student's `ConceptMasteryProfile` — useful for teachers/dashboards to see which concepts a student is weak on.

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| [conceptMastery.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/conceptMastery.ts) | **NEW** | `ConceptMasteryProfile` and `ConceptScore` interfaces |
| [reinforcementEngine.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/reinforcementEngine.ts) | **NEW** | `updateConceptMastery()` and `getReinforcementQuestions()` — core engine |
| [db.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/db.ts) | **MODIFY** | Add collection, schema, CRUD methods for `ConceptMasteryProfile` |
| [index.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/index.ts) | **MODIFY** | Hook `updateConceptMastery()` into both submit endpoints; hook `getReinforcementQuestions()` into worksheet generation; add concept mastery API |
| [types.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/frontend/src/types.ts) | **MODIFY** | Add matching frontend types |
| [levelGenerator.ts](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/src/levelGenerator.ts) | **MODIFY** | Add a topic-filtered variant `generateReinforcementQuestionsForTopic()` that generates questions specifically for a given topic |

---

## Verification Plan

### Automated Tests
- Create a test script that simulates:
  1. A student taking a diagnostic with known weak concepts
  2. Verifying that `ConceptMasteryProfile` is created with correct scores
  3. Generating a worksheet and verifying reinforcement questions appear for weak concepts
  4. Simulating the student mastering a concept over 2+ assessments and verifying reinforcement stops

### Manual Verification
- Run the backend with `npm run dev`
- Use the existing test script ([test_submit.cjs](file:///c:/Users/avans/OneDrive/Desktop/FLN%20PHASE%202/fln/backend/test_submit.cjs)) or curl to:
  1. Submit a diagnostic with intentionally wrong answers for specific topics
  2. Check `GET /api/students/:id/concept-mastery` shows `Needs Practice` for those topics
  3. Generate a worksheet and verify it includes reinforcement questions
  4. Submit correct answers for weak topics
  5. Re-check concept mastery shows improvement
  6. Generate another worksheet and verify fewer reinforcement questions
