/**
 * Hand-authored classification of levels_main.html's 59 levels into competency
 * strands (it has no strand field of its own). Separate id space from
 * RoleDashboards.tsx's 93-entry FLN_LEVELS_LIST — don't conflate the two.
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

// Derived from LEVEL_STRAND_MAP so it can't drift out of sync; used to
// normalize loosely-named topic strings elsewhere.
export const KNOWN_COMPETENCIES: string[] = Object.keys(STRAND_TO_EASIEST_LEVEL);

/** Easiest level in a strand for a weak-competency name, ignoring the student's overall level; null if unmatched. */
export function mapCompetencyToLevel(competency: string): number | null {
  const target = competency.trim().toLowerCase();
  const match = Object.keys(STRAND_TO_EASIEST_LEVEL).find(s => s.toLowerCase() === target);
  return match !== undefined ? STRAND_TO_EASIEST_LEVEL[match] : null;
}

/** Reverse lookup of mapCompetencyToLevel; null for unclassified ids (Review/Assessment levels or out of range). */
export function getStrandForLevel(levelId: number): string | null {
  return LEVEL_STRAND_MAP[levelId] ?? null;
}

/**
 * Hand-duplicated from levels_main.html's LEVELS array (only loaded inside
 * Puppeteer) — re-verify against it if that file's LEVELS array changes.
 */
const LEVEL_SUBS_COUNT: Record<number, number> = {
  1: 3, 2: 3, 3: 3, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3,
  11: 3, 12: 3, 13: 3, 14: 3, 15: 2, 16: 3, 17: 3, 18: 3, 19: 2, 20: 3,
  21: 3, 22: 3, 23: 3, 24: 3, 25: 3, 26: 3, 27: 3, 28: 3, 29: 3, 30: 3,
  31: 3, 32: 3, 33: 3, 34: 3, 35: 2, 36: 3, 37: 3, 38: 3, 39: 3, 40: 3,
  41: 4, 42: 4, 43: 4, 44: 3, 45: 4, 46: 3, 47: 3, 48: 1, 49: 3, 50: 4,
  51: 4, 52: 3, 53: 3, 54: 3, 55: 3, 56: 3, 57: 3, 58: 3, 59: 1,
};

/** Subs-variation count for a level id, or null if unknown. */
export function getSubsCountForLevel(levelId: number): number | null {
  return LEVEL_SUBS_COUNT[levelId] ?? null;
}

// Each strand's level ids in ascending progression order, derived from
// LEVEL_STRAND_MAP so it can't drift out of sync.
const STRAND_LEVEL_SEQUENCE: Record<string, number[]> = {};
for (const [idStr, strand] of Object.entries(LEVEL_STRAND_MAP)) {
  const id = Number(idStr);
  (STRAND_LEVEL_SEQUENCE[strand] ??= []).push(id);
}
for (const strand of Object.keys(STRAND_LEVEL_SEQUENCE)) {
  STRAND_LEVEL_SEQUENCE[strand].sort((a, b) => a - b);
}

/**
 * Next-harder level id in the same strand, or null if already the hardest
 * (or unclassified). Used by calculateNextScheduleState to advance a
 * student or detect a competency has no further content.
 */
export function getNextLevelInStrand(levelId: number): number | null {
  const strand = getStrandForLevel(levelId);
  if (strand === null) return null;
  const sequence = STRAND_LEVEL_SEQUENCE[strand];
  const idx = sequence.indexOf(levelId);
  if (idx === -1 || idx === sequence.length - 1) return null;
  return sequence[idx + 1];
}
