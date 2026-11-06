/**
 * Assessment Mode Configuration by Concept ID.
 *
 * Governs whether a concept is assessed via student worksheet ('written'),
 * teacher observation sheet ('observed'), or both ('both').
 *
 * References:
 * - Issue #850: backend/src/config/assessmentMode.ts
 * - Research doc: Research/03-109-levels/fln_year_before_class1.md (Sections 5a–5e)
 * - NCF-FS 2022 (Annexure 1, Tables 29–41)
 *
 * Note on Classes 1–3:
 * Concepts for Classes 1 to 3 are marked `// INTERIM` until confirmed by Pavani ma'am.
 */

export type AssessmentMode = 'written' | 'observed' | 'both';

export interface BalvatikaOutcome {
  outcomeNumber: number;
  conceptId: string;
  mode: AssessmentMode;
  section: '5a' | '5b' | '5c' | '5d' | '5e';
}

/**
 * The 29 Balvatika NCF-FS outcome nodes from research doc sections 5a to 5e
 * (Research/03-109-levels/fln_year_before_class1.md Section 5f):
 * Exactly 9 Student ('written'), 9 Both ('both'), 11 Teacher ('observed').
 */
export const BALVATIKA_OUTCOMES: BalvatikaOutcome[] = [
  // 5a. Already in the graph: keep (8 outcomes on 6 nodes)
  { outcomeNumber: 2, conceptId: 'S3.2', mode: 'both', section: '5a' },
  { outcomeNumber: 7, conceptId: 'S3.1', mode: 'written', section: '5a' },
  { outcomeNumber: 9, conceptId: 'S3.3', mode: 'written', section: '5a' },
  { outcomeNumber: 14, conceptId: 'S3.5', mode: 'both', section: '5a' },
  { outcomeNumber: 15, conceptId: 'S3.4', mode: 'both', section: '5a' },
  { outcomeNumber: 19, conceptId: 'S3.5', mode: 'observed', section: '5a' },
  { outcomeNumber: 24, conceptId: 'S3.7', mode: 'written', section: '5a' },
  { outcomeNumber: 25, conceptId: 'S3.7', mode: 'both', section: '5a' },

  // 5b. Earlier-stage node extended for Balvatika (2 outcomes on 2 nodes)
  { outcomeNumber: 6, conceptId: 'S2.9', mode: 'observed', section: '5b' },
  { outcomeNumber: 18, conceptId: 'S1.6', mode: 'written', section: '5b' },

  // 5c. Later-stage node moved into Balvatika (4 outcomes on 4 nodes)
  { outcomeNumber: 4, conceptId: 'S4.12', mode: 'written', section: '5c' },
  { outcomeNumber: 5, conceptId: 'S4.13', mode: 'written', section: '5c' },
  { outcomeNumber: 20, conceptId: 'S5.13', mode: 'both', section: '5c' },
  { outcomeNumber: 28, conceptId: 'S5.9', mode: 'written', section: '5c' },

  // 5d. Split off into Balvatika (11 outcomes on 11 nodes)
  { outcomeNumber: 1, conceptId: 'S3.11', mode: 'observed', section: '5d' },
  { outcomeNumber: 8, conceptId: 'S3.13', mode: 'written', section: '5d' },
  { outcomeNumber: 10, conceptId: 'S3.14', mode: 'both', section: '5d' },
  { outcomeNumber: 11, conceptId: 'S3.15', mode: 'both', section: '5d' },
  { outcomeNumber: 12, conceptId: 'S3.16', mode: 'observed', section: '5d' },
  { outcomeNumber: 13, conceptId: 'S3.17', mode: 'both', section: '5d' },
  { outcomeNumber: 17, conceptId: 'S3.19', mode: 'observed', section: '5d' },
  { outcomeNumber: 21, conceptId: 'S3.20', mode: 'observed', section: '5d' },
  { outcomeNumber: 22, conceptId: 'S3.21', mode: 'observed', section: '5d' },
  { outcomeNumber: 26, conceptId: 'S3.23', mode: 'observed', section: '5d' },
  { outcomeNumber: 27, conceptId: 'S3.24', mode: 'observed', section: '5d' },

  // 5e. New Balvatika nodes (4 outcomes on 4 nodes)
  { outcomeNumber: 3, conceptId: 'S3.12', mode: 'observed', section: '5e' },
  { outcomeNumber: 16, conceptId: 'S3.18', mode: 'both', section: '5e' },
  { outcomeNumber: 23, conceptId: 'S3.22', mode: 'written', section: '5e' },
  { outcomeNumber: 30, conceptId: 'S3.25', mode: 'observed', section: '5e' },
];

/**
 * Concept ID -> Assessment Mode Registry.
 *
 * For concepts covering multiple outcomes (e.g. S3.5, S3.7), 'both' is assigned
 * so that both written and observation evidence are collected for certification.
 */
export const ASSESSMENT_MODE_BY_CONCEPT: Record<string, AssessmentMode> = {
  // ---------------------------------------------------------------------------
  // Balvatika (Pavani ma'am, Research Doc 5a–5e & Stage 3 Curriculum Map)
  // ---------------------------------------------------------------------------
  // Section 5a (Core Balvatika nodes)
  'S3.1': 'written',
  'S3.2': 'both',
  'S3.3': 'written',
  'S3.4': 'both',
  'S3.5': 'both',
  'S3.7': 'both',

  // Section 5b (Earlier-stage nodes extended for Balvatika)
  'S1.6': 'written',
  'S2.9': 'observed',

  // Section 5c (Later-stage nodes moved to Balvatika Stage 3)
  'S4.12': 'written',
  'S4.13': 'written',
  'S5.9': 'written',
  'S5.13': 'both',

  // Section 5d (Split off later-stage nodes into Balvatika)
  'S3.11': 'observed',
  'S3.13': 'written',
  'S3.14': 'both',
  'S3.15': 'both',
  'S3.16': 'observed',
  'S3.17': 'both',
  'S3.19': 'observed',
  'S3.20': 'observed',
  'S3.21': 'observed',
  'S3.23': 'observed',
  'S3.24': 'observed',

  // Section 5e (New Balvatika nodes)
  'S3.12': 'observed',
  'S3.18': 'both',
  'S3.22': 'written',
  'S3.25': 'observed',

  // Remaining Balvatika Stage 3 nodes (§7 & S1.8 routine sequencing)
  'S1.8': 'both',
  'S3.6': 'written',
  'S3.8': 'written',
  'S3.10': 'written',

  // ---------------------------------------------------------------------------
  // Classes 1 to 3: INTERIM, to be confirmed by Pavani ma'am
  // ---------------------------------------------------------------------------
  // Class 1 (INTERIM)
  'S4.3': 'both',       // INTERIM
  'S4.4': 'written',    // INTERIM
  'S4.6': 'written',    // INTERIM
  'S4.7': 'written',    // INTERIM
  'S4.8': 'both',       // INTERIM
  'S4.9': 'observed',   // INTERIM
  'S4.10': 'observed',  // INTERIM

  // Class 2 (INTERIM)
  'S5.1': 'written',    // INTERIM
  'S5.4': 'written',    // INTERIM
  'S5.5': 'written',    // INTERIM
  'S5.6': 'written',    // INTERIM
  'S5.7': 'both',       // INTERIM
  'S5.8': 'written',    // INTERIM
  'S5.11': 'observed',  // INTERIM
  'S5.12': 'written',   // INTERIM

  // Class 3 (INTERIM)
  'S6.4': 'written',    // INTERIM
  'S6.5': 'written',    // INTERIM
  'S6.6': 'written',    // INTERIM
  'S6.7': 'written',    // INTERIM
  'S6.8': 'both',       // INTERIM
  'S6.9': 'written',    // INTERIM
  'S6.10': 'written',   // INTERIM
  'S6.12': 'written',   // INTERIM
  'S6.13': 'written',   // INTERIM
};

/**
 * Returns the assessment mode for a given concept ID ('written' | 'observed' | 'both'),
 * or undefined if the concept is not present in the mode registry.
 */
export function getAssessmentMode(conceptId: string): AssessmentMode | undefined {
  return ASSESSMENT_MODE_BY_CONCEPT[conceptId];
}
