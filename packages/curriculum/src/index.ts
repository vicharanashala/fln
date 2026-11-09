// The one place that knows how many levels there are and which classes they belong to.
// Everything else in v2 imports these; no other file may hard-code a level number.
export * from './curriculumMap';
import { CURRICULUM_MAPPING, type LevelConceptConfig } from './curriculumMap';

export type ClassStage = 'Balvatika' | 'Class 1' | 'Class 2' | 'Class 3' | 'Beyond MVP';

/** Inclusive level ranges per class (README "Level Framework"). Class 4 and above belong to Tenali. */
export const CLASS_LEVEL_RANGES: Record<Exclude<ClassStage, 'Beyond MVP'>, readonly [number, number]> = {
  'Balvatika': [19, 46],
  'Class 1': [47, 60],
  'Class 2': [61, 77],
  'Class 3': [78, 91],
};

/** Highest level in the curriculum map. */
export const MAX_LEVEL: number = Math.max(...Object.keys(CURRICULUM_MAPPING).map(Number));

/** Highest level FLN assesses: the end of Class 3. */
export const MVP_MAX_LEVEL: number = CLASS_LEVEL_RANGES['Class 3'][1];

export function classForLevel(level: number): ClassStage | undefined {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return undefined;
  for (const [name, [from, to]] of Object.entries(CLASS_LEVEL_RANGES)) {
    if (level >= from && level <= to) return name as ClassStage;
  }
  return level > MVP_MAX_LEVEL ? 'Beyond MVP' : undefined;
}

/** The group a level is shown under: before Balvatika, one of the MVP classes, or beyond (Tenali territory). */
export type LevelGroup = 'Before Balvatika' | ClassStage;

export interface LevelRecord extends LevelConceptConfig { group: LevelGroup }

export function groupForLevel(level: number): LevelGroup {
  const first = CLASS_LEVEL_RANGES.Balvatika[0];
  if (level < first) return 'Before Balvatika';
  return classForLevel(level) ?? 'Beyond MVP';
}

/** Every level of the curriculum, in order. This is what the database `levels` collection is filled from. */
export function listLevels(): LevelRecord[] {
  return Object.values(CURRICULUM_MAPPING)
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .map(l => ({ ...l, group: groupForLevel(l.levelNumber) }));
}
