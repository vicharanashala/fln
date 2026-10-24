import { CURRICULUM_MAPPING } from './curriculumMap';

export interface CrosswalkEntry {
  mappedLevel: number;
  conceptId: string;
}

/**
 * Reviewed 59-to-93 (legacy level to 93-scheme level & conceptId) crosswalk mapping.
 * Covers all 38 legacy levels (22 to 59) present in data/questionBank.json.
 */
export const LEGACY_59_TO_CONCEPT_MAP: Record<number, CrosswalkEntry> = {
  22: { mappedLevel: 50, conceptId: 'S4.4' },
  23: { mappedLevel: 59, conceptId: 'S4.14' },
  24: { mappedLevel: 50, conceptId: 'S4.4' },
  25: { mappedLevel: 51, conceptId: 'S4.5' },
  26: { mappedLevel: 64, conceptId: 'S5.4' },
  27: { mappedLevel: 65, conceptId: 'S5.5' },
  28: { mappedLevel: 47, conceptId: 'S4.1' },
  29: { mappedLevel: 47, conceptId: 'S4.1' },
  30: { mappedLevel: 73, conceptId: 'S5.15' },
  31: { mappedLevel: 87, conceptId: 'S6.10' },
  32: { mappedLevel: 44, conceptId: 'S4.13' },
  33: { mappedLevel: 66, conceptId: 'S5.6' },
  34: { mappedLevel: 70, conceptId: 'S5.11' },
  35: { mappedLevel: 63, conceptId: 'S5.3' },
  36: { mappedLevel: 61, conceptId: 'S5.1' },
  37: { mappedLevel: 80, conceptId: 'S6.3' },
  38: { mappedLevel: 80, conceptId: 'S6.3' },
  39: { mappedLevel: 82, conceptId: 'S6.5' },
  40: { mappedLevel: 82, conceptId: 'S6.5' },
  41: { mappedLevel: 68, conceptId: 'S5.8' },
  42: { mappedLevel: 67, conceptId: 'S5.7' },
  43: { mappedLevel: 85, conceptId: 'S6.8' },
  44: { mappedLevel: 72, conceptId: 'S5.14' },
  45: { mappedLevel: 69, conceptId: 'S5.10' },
  46: { mappedLevel: 88, conceptId: 'S6.11' },
  47: { mappedLevel: 73, conceptId: 'S5.15' },
  48: { mappedLevel: 78, conceptId: 'S6.1' },
  49: { mappedLevel: 81, conceptId: 'S6.4' },
  50: { mappedLevel: 83, conceptId: 'S6.6' },
  51: { mappedLevel: 84, conceptId: 'S6.7' },
  52: { mappedLevel: 46, conceptId: 'S5.13' },
  53: { mappedLevel: 105, conceptId: 'S7.14' },
  54: { mappedLevel: 89, conceptId: 'S6.12' },
  55: { mappedLevel: 106, conceptId: 'S7.15' },
  56: { mappedLevel: 109, conceptId: 'S7.18' },
  57: { mappedLevel: 107, conceptId: 'S7.16' },
  58: { mappedLevel: 108, conceptId: 'S7.17' },
  59: { mappedLevel: 92, conceptId: 'S7.1' },
};

/**
 * Resolves the 93-scheme mappedLevel and conceptId for a legacy 59-scheme level number.
 */
export function getCrosswalkForLegacyLevel(legacyLevel: number): CrosswalkEntry | null {
  return LEGACY_59_TO_CONCEPT_MAP[legacyLevel] || null;
}

/**
 * Validates all entries in LEGACY_59_TO_CONCEPT_MAP against CURRICULUM_MAPPING.
 * Throws an explicit Error if any mapping disagrees with CURRICULUM_MAPPING.
 */
export function validateCrosswalkInvariants(): void {
  for (const [legacyLevelStr, entry] of Object.entries(LEGACY_59_TO_CONCEPT_MAP)) {
    const legacyLevel = Number(legacyLevelStr);
    const curriculumConfig = CURRICULUM_MAPPING[entry.mappedLevel];

    if (!curriculumConfig) {
      throw new Error(
        `Crosswalk invariant error: Legacy level ${legacyLevel} maps to level ${entry.mappedLevel}, ` +
        `which does not exist in CURRICULUM_MAPPING.`
      );
    }

    if (curriculumConfig.conceptId !== entry.conceptId) {
      throw new Error(
        `Crosswalk invariant error: Legacy level ${legacyLevel} claims conceptId '${entry.conceptId}', ` +
        `but CURRICULUM_MAPPING level ${entry.mappedLevel} has conceptId '${curriculumConfig.conceptId}'.`
      );
    }
  }
}

// Run self-check on module load
validateCrosswalkInvariants();
