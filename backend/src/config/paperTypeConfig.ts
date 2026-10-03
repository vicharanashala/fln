/**
 * Backend Paper Type Configuration
 *
 * Configures fixed total question counts, level selection strategies, and
 * template eligibility criteria for FLN assessment paper types:
 *   - diagnostic (baseline)
 *   - midline (mid-year)
 *   - endline (end-of-year)
 *   - practice (personalized)
 *   - remedial
 *
 * Implements acceptance criteria for Issue #593 and reconciles prior
 * diagnostic blueprint specifications.
 */

export type PaperType = 'diagnostic' | 'midline' | 'endline' | 'practice' | 'remedial';

export interface LevelSelectionStrategy {
  mode: 'class_band' | 'milestone' | 'prerequisite_gaps';
  defaultLevelRange?: { min: number; max: number };
  subskills?: string[];
}

export interface PaperTypeConfig {
  requestType: PaperType;
  title: string;
  description: string;
  questionCount: number;
  levelSelectionStrategy: LevelSelectionStrategy;
  eligibleStatuses: Array<'approved' | 'active'>;
}

export const PAPER_TYPE_CONFIG: Record<PaperType, PaperTypeConfig> = {
  diagnostic: {
    requestType: 'diagnostic',
    title: 'Diagnostic Assessment',
    description: 'Covers foundational pre-number and arithmetic milestone levels across class level bands',
    questionCount: 10,
    levelSelectionStrategy: {
      mode: 'class_band',
      defaultLevelRange: { min: 47, max: 108 },
    },
    eligibleStatuses: ['approved', 'active'],
  },
  midline: {
    requestType: 'midline',
    title: 'Midline Assessment',
    description: 'Mid-year assessment evaluating foundational progress up to mid-grade levels',
    questionCount: 10,
    levelSelectionStrategy: {
      mode: 'class_band',
      defaultLevelRange: { min: 47, max: 108 },
    },
    eligibleStatuses: ['approved', 'active'],
  },
  endline: {
    requestType: 'endline',
    title: 'Endline Assessment',
    description: 'End-of-year assessment evaluating comprehensive grade-level mastery',
    questionCount: 10,
    levelSelectionStrategy: {
      mode: 'class_band',
      defaultLevelRange: { min: 47, max: 108 },
    },
    eligibleStatuses: ['approved', 'active'],
  },
  practice: {
    requestType: 'practice',
    title: 'Personalized Practice Worksheet',
    description: 'Personalized practice worksheet tuned to student current level milestone',
    questionCount: 8,
    levelSelectionStrategy: {
      mode: 'milestone',
      defaultLevelRange: { min: 47, max: 108 },
    },
    eligibleStatuses: ['approved', 'active'],
  },
  remedial: {
    requestType: 'remedial',
    title: 'Targeted Remedial Worksheet',
    description: 'Targeted remedial worksheet focusing on prerequisite gaps and identified misconceptions',
    questionCount: 8,
    levelSelectionStrategy: {
      mode: 'prerequisite_gaps',
      defaultLevelRange: { min: 47, max: 108 },
    },
    eligibleStatuses: ['approved', 'active'],
  },
};

/** Normalizes incoming paper type / requestType aliases. */
export function normalizePaperType(typeStr: string): PaperType {
  const normalized = typeStr?.toLowerCase().trim();
  if (normalized === 'baseline' || normalized === 'diagnostic') return 'diagnostic';
  if (normalized === 'mid-year' || normalized === 'midyear' || normalized === 'midline') return 'midline';
  if (normalized === 'end-of-year' || normalized === 'endyear' || normalized === 'endline') return 'endline';
  if (normalized === 'remedial') return 'remedial';
  return 'practice';
}

/** Retrieves configuration for a given requestType or alias. */
export function getPaperTypeConfig(requestType: string): PaperTypeConfig {
  const normalized = normalizePaperType(requestType);
  return PAPER_TYPE_CONFIG[normalized];
}

/** Returns list of all paper type configurations. */
export function getAllPaperTypeConfigs(): PaperTypeConfig[] {
  return Object.values(PAPER_TYPE_CONFIG);
}

/**
 * Returns paper type config adapted for a specific class level range if classNumber is provided.
 * Class ranges per SRS §3: Class 1 (47-59), Class 2 (60-76), Class 3 (77-90), Class 4 (91-108).
 */
export function getClassPaperTypeConfig(requestType: string, classNumber?: number): PaperTypeConfig {
  const config = getPaperTypeConfig(requestType);
  if (classNumber === undefined || classNumber === null) return config;

  let min = 47;
  let max = 108;
  if (classNumber <= 1) {
    min = 47; max = 59;
  } else if (classNumber === 2) {
    min = 60; max = 76;
  } else if (classNumber === 3) {
    min = 77; max = 90;
  } else {
    min = 91; max = 108;
  }

  return {
    ...config,
    levelSelectionStrategy: {
      ...config.levelSelectionStrategy,
      defaultLevelRange: { min, max },
    },
  };
}

/**
 * Gate check enforcing template eligibility (#451 gate).
 * Only templates with status 'approved' or 'active' (or missing status for legacy templates) are eligible.
 */
export function isTemplateEligible(template: { status?: string }): boolean {
  if (!template || !template.status) return true;
  const status = template.status.toLowerCase();
  return status === 'approved' || status === 'active';
}
