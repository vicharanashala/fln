// Single source of truth for thresholds that recur across the backend.
// CLAUDE.md flags these as a known source of drift ("if you change one, grep
// for the others") — this file is that "one place". Currently consumed by
// backend/src only; frontend still has its own literal copies (it runs on
// the mock interceptor today, not this backend) — wiring it up is tracked
// as a separate follow-up, not done here.

// Curriculum has 93 levels (S1.1–S7.18, see backend/src/config/curriculumMap.ts).
// Note: some older docs reference "59" as the cap — that was true of an
// earlier, smaller curriculum revision. 93 is the current, verified cap.
export const MAX_LEVEL = 93;

// A student is considered "certified" once they reach this level.
export const CERTIFICATION_LEVEL = 5;

// Score bands used when grading diagnostics/worksheets and mapping concept
// mastery (Strong / Satisfactory / Needs Practice).
export const SCORE_BAND_STRONG = 80; // percent >= this -> "Strong" / advance a level
export const SCORE_BAND_SATISFACTORY = 60; // percent >= this -> "Satisfactory"
