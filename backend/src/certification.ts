// FLN certification distance: how many levels a student still needs to cover,
// after their most recent diagnostic placement, to be certified for their
// current grade — not a flat "reach level 5" bar. Certification is grade-relative:
// each class (2, 3, 4) has its own top level in the 93-level framework (see
// frontend/src/components/RoleDashboards.tsx FLN_LEVELS_LIST, the source of
// truth for level->class assignment). Only Classes 2-4 are enrolled today
// (backend/src/seed.ts CLASSES) — the platform doesn't run Preschool 1-3 or
// Class 1 students, so this map intentionally stops at Class 2's lower bound.
export const CLASS_CERTIFICATION_LEVEL: Record<string, number> = {
  'Class 2': 61,
  'Class 3': 75,
  'Class 4': 93,
};

// Levels 1-27 belong to Preschool 1-3 (before Class 2's own content starts at
// level 28) — the "no prior data" baseline used in getDistanceToCertification.
export const PRE_CLASS2_LEVEL_CEILING = 27;

/**
 * Levels remaining until certification for the student's current grade.
 * 0 means certified (already at or above the grade's ceiling). Returns
 * `null` if classGroup isn't a recognized enrolled grade (Class 2-4) —
 * callers should treat that as "unknown", not "certified" or "0 away".
 */
export function getDistanceToCertification(classGroup: string, currentLevel: number): number | null {
  const ceiling = CLASS_CERTIFICATION_LEVEL[classGroup];
  if (ceiling == null) return null;
  return Math.max(0, ceiling - currentLevel);
}

export function isCertified(classGroup: string, currentLevel: number): boolean {
  const distance = getDistanceToCertification(classGroup, currentLevel);
  return distance === 0;
}
