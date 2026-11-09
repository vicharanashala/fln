import { listLevels } from '@fln/curriculum';
import type { LevelRow } from './types';

/** The rows the `levels` collection must hold: every curriculum level, straight from @fln/curriculum. */
export function levelRows(): LevelRow[] {
  return listLevels().map(l => ({
    levelNumber: l.levelNumber, title: l.levelTitle, conceptId: l.conceptId,
    stage: l.stage, ageGroup: l.ageGroup, strand: l.strand, group: l.group,
  }));
}
