// Centralized FLN domain constants.
//
// Rationale (CLAUDE.md / AUDIT §3.3): magic thresholds — max level 59,
// certification >= 5, score bands 80/60, pass score 50, timing windows —
// were inlined across ~15 backend files with no single source of truth.
// Changing one required a repo-wide grep. Every threshold below is the
// canonical value; all call sites reference it instead of re-inlining.
//
// Keep in sync with any future `shared/` constants module (the planned
// cross-workspace home per CLAUDE.md). Until `shared/` exists, this file
// is the backend's single source of truth.

/** Highest valid FLN level in the retired 1..59 worksheet-engine space.
 *  Worksheet generation (levels_main.html) throws UnknownLevelError above 59
 *  until the 59->93 migration finishes. */
export const MAX_FLN_LEVEL = 59;

/** Level at or above which a student is considered certified. */
export const CERTIFICATION_LEVEL = 5;

/** Pass threshold for evaluation reports (score >= 50 => pass). */
export const PASS_SCORE = 50;

/** Score band: >= 80% => strong / promotes to next level. */
export const SCORE_BAND_STRONG = 80;

/** Score band: >= 60% => satisfactory (50-80% retains current level). */
export const SCORE_BAND_SATISFACTORY = 60;

/** Score band: < 50% => retain or suggest review at level - 1. */
export const SCORE_BAND_REVIEW = 50;

/** Certification rate rounding precision. */
export const CERT_RATE_PRECISION = 0;

/** Topic-mastery formula floor used in analytics (55 + avgLevel*8, etc.).
 *  Kept here so the fabricated analytics coefficients are visible in one
 *  place rather than hand-inlined in db.ts. */
export const TOPIC_MASTERY_BASE = {
  'Number Sense': 55,
  'Number Operations': 45,
  Shapes: 58,
  Fractions: 20,
  Patterns: 38,
  Measurement: 32,
} as const;

/** Topic-mastery per-level coefficient used in analytics. */
export const TOPIC_MASTERY_COEFF = {
  'Number Sense': 8,
  'Number Operations': 9,
  Shapes: 7,
  Fractions: 11,
  Patterns: 10,
  Measurement: 10,
} as const;

/** Auth rate-limit window (ms). Mirrors config.ts authRateLimiter. */
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Auth rate-limit max requests per window. Mirrors config.ts authRateLimiter. */
export const AUTH_RATE_LIMIT_MAX = 50;
