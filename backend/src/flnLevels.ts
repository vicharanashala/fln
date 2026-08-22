/**
 * Maps FLN weak-competency names (as produced by the evaluation system, e.g.
 * MicroPractice.tsx's ALL_COMPETENCIES) to a starting level in the 59-level
 * micro-practice generation system (frontend/public/worksheets/levels_main.html).
 *
 * levels_main.html's LEVELS array has no strand/topic field of its own, so
 * LEVEL_STRAND_MAP below is a hand-authored classification of each level's
 * title against the 9 competency strands — reviewed and approved level-by-level.
 * Two entries are judgment calls with no exact strand fit: level 2 "Odd One
 * Out" -> Patterns, and level 52 "Maps & Directions" -> Shapes (spatial
 * reasoning). The 5 Review/Assessment levels (11, 23, 35, 48, 59) are
 * intentionally omitted — they draw from a mixed pool across strands, and
 * generateMicroSet (paperGenerator.ts) already rejects them outright.
 *
 * NOTE: this is a separate 59-id numbering space from FLN_LEVELS_LIST in
 * frontend/src/components/RoleDashboards.tsx (a 93-entry reference taxonomy
 * with its own, unrelated id numbering) — the two must not be confused or
 * merged. This map's ids are the ones generateMicroPracticePaper's levelId
 * param expects.
 */
const LEVEL_STRAND_MAP: Record<number, string> = {
  1: 'Number Sense',
  2: 'Patterns',
  3: 'Shapes',
  4: 'Number Sense',
  5: 'Number Sense',
  6: 'Number Sense',
  7: 'Number Operations',
  8: 'Number Operations',
  9: 'Patterns',
  10: 'Number Sense',
  // 11: Review Assessment — excluded
  12: 'Number Sense',
  13: 'Number Sense',
  14: 'Number Sense',
  15: 'Number Sense',
  16: 'Number Operations',
  17: 'Number Operations',
  18: 'Number Sense',
  19: 'Number Sense',
  20: 'Patterns',
  21: 'Number Sense',
  22: 'Number Sense',
  // 23: Review Assessment — excluded
  24: 'Number Sense',
  25: 'Number Sense',
  26: 'Number Operations',
  27: 'Number Operations',
  28: 'Number Sense',
  29: 'Number Sense',
  30: 'Data Handling',
  31: 'Calendar and Time',
  32: 'Number Sense',
  33: 'Number Operations',
  34: 'Measurement',
  // 35: Review Assessment — excluded
  36: 'Number Sense',
  37: 'Number Sense',
  38: 'Number Sense',
  39: 'Number Operations',
  40: 'Number Operations',
  41: 'Number Operations',
  42: 'Number Operations',
  43: 'Measurement',
  44: 'Calendar and Time',
  45: 'Fractions',
  46: 'Money',
  47: 'Data Handling',
  // 48: Foundation Mastery Assessment — excluded
  49: 'Number Sense',
  50: 'Number Operations',
  51: 'Number Operations',
  52: 'Shapes',
  53: 'Number Operations',
  54: 'Fractions',
  55: 'Number Sense',
  56: 'Measurement',
  57: 'Shapes',
  58: 'Shapes',
  // 59: Advanced Mastery Assessment — excluded
};

// Precomputed once at module load: for each strand, the lowest level id
// classified under it (i.e. the easiest level for that strand).
const STRAND_TO_EASIEST_LEVEL: Record<string, number> = {};
for (const [idStr, strand] of Object.entries(LEVEL_STRAND_MAP)) {
  const id = Number(idStr);
  if (STRAND_TO_EASIEST_LEVEL[strand] === undefined || id < STRAND_TO_EASIEST_LEVEL[strand]) {
    STRAND_TO_EASIEST_LEVEL[strand] = id;
  }
}

// The 9 canonical competency/strand names, derived from the same map above
// so this can never drift out of sync with it. Used elsewhere to normalize
// loosely-named topic strings (e.g. from AI-generated evaluation reports)
// back to the exact names mapCompetencyToLevel expects.
export const KNOWN_COMPETENCIES: string[] = Object.keys(STRAND_TO_EASIEST_LEVEL);

/**
 * Given a weak-competency name, returns the easiest (lowest-id) level in
 * levels_main.html's LEVELS array whose strand matches — always the basics
 * for that strand, regardless of the student's overall current level.
 * Returns null if the competency doesn't match any known strand.
 */
export function mapCompetencyToLevel(competency: string): number | null {
  const target = competency.trim().toLowerCase();
  const match = Object.keys(STRAND_TO_EASIEST_LEVEL).find(s => s.toLowerCase() === target);
  return match !== undefined ? STRAND_TO_EASIEST_LEVEL[match] : null;
}

/**
 * Reverse lookup of mapCompetencyToLevel: given a level id from the 59-level
 * micro-practice system, returns the competency/strand it was classified
 * under (see LEVEL_STRAND_MAP above), or null for unclassified ids (the 5
 * Review/Assessment levels, or any id outside 1-59).
 */
export function getStrandForLevel(levelId: number): string | null {
  return LEVEL_STRAND_MAP[levelId] ?? null;
}

/**
 * Each level's `subs` count (number of subIdx variations, 0-indexed) from
 * levels_main.html's LEVELS array. Hand-duplicated here for the same reason
 * as LEVEL_STRAND_MAP above: levels_main.html is loaded and read only inside
 * a Puppeteer page (see paperGenerator.ts), which the scheduling logic in
 * index.ts (calculateNextScheduleState) has no reason to spin up just to
 * check whether a student has exhausted a level's variations. Verified
 * against the live file's `subs:` field for every id 1-59 as of this
 * writing — re-check this map if levels_main.html's LEVELS array changes.
 */
const LEVEL_SUBS_COUNT: Record<number, number> = {
  1: 3, 2: 3, 3: 3, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3,
  11: 3, 12: 3, 13: 3, 14: 3, 15: 2, 16: 3, 17: 3, 18: 3, 19: 2, 20: 3,
  21: 3, 22: 3, 23: 3, 24: 3, 25: 3, 26: 3, 27: 3, 28: 3, 29: 3, 30: 3,
  31: 3, 32: 3, 33: 3, 34: 3, 35: 2, 36: 3, 37: 3, 38: 3, 39: 3, 40: 3,
  41: 4, 42: 4, 43: 4, 44: 3, 45: 4, 46: 3, 47: 3, 48: 1, 49: 3, 50: 4,
  51: 4, 52: 3, 53: 3, 54: 3, 55: 3, 56: 3, 57: 3, 58: 3, 59: 1,
};

/**
 * Number of subIdx variations available for a level id, or null if the id
 * isn't a known level (outside 1-59).
 */
export function getSubsCountForLevel(levelId: number): number | null {
  return LEVEL_SUBS_COUNT[levelId] ?? null;
}

// Precomputed once at module load: for each strand, every level id classified
// under it, sorted ascending — i.e. the strand's real progression order.
// Built from the same LEVEL_STRAND_MAP as STRAND_TO_EASIEST_LEVEL above, so
// it can't drift out of sync with it.
const STRAND_LEVEL_SEQUENCE: Record<string, number[]> = {};
for (const [idStr, strand] of Object.entries(LEVEL_STRAND_MAP)) {
  const id = Number(idStr);
  (STRAND_LEVEL_SEQUENCE[strand] ??= []).push(id);
}
for (const strand of Object.keys(STRAND_LEVEL_SEQUENCE)) {
  STRAND_LEVEL_SEQUENCE[strand].sort((a, b) => a - b);
}

/**
 * Given a level id, returns the next-harder level id in the same strand
 * (the next entry in that strand's ascending id sequence), or null if
 * levelId is already the strand's hardest level (e.g. level 46 "Money",
 * the strand's only level) or levelId is unclassified (a Review/Assessment
 * level or an id outside 1-59). Used by calculateNextScheduleState to move
 * a student onto real new content once a level's variations are exhausted,
 * and to detect when a competency has no further content at all.
 */
export function getNextLevelInStrand(levelId: number): number | null {
  const strand = getStrandForLevel(levelId);
  if (strand === null) return null;
  const sequence = STRAND_LEVEL_SEQUENCE[strand];
  const idx = sequence.indexOf(levelId);
  if (idx === -1 || idx === sequence.length - 1) return null;
  return sequence[idx + 1];
}
