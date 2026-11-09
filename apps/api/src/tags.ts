import { CORE_SKILLS, tagsForLevel } from '@fln/curriculum';
import type { LevelRow, Question } from './types';

/**
 * Everything a question belongs to. Only `subskillIds` is chosen by the author; the rest is read from the
 * curriculum every time, so a question's level, concept, strand, stage and skills can never disagree.
 */
export interface QuestionTags {
  levelNumber: number;
  conceptId: string;
  strand: string;
  stage: number;
  ageGroup: string;
  group: string;
  primarySkillIds: string[];
  supportingSkillIds: string[];
  subskillIds: string[];
}

export function tagsFor(question: Pick<Question, 'subskillIds'>, level: LevelRow): QuestionTags {
  const t = tagsForLevel(level.levelNumber);
  return {
    levelNumber: level.levelNumber, conceptId: level.conceptId, strand: level.strand, stage: level.stage, ageGroup: level.ageGroup, group: level.group,
    primarySkillIds: t?.primarySkills.map(s => s.id) ?? [], supportingSkillIds: t?.supportingSkills.map(s => s.id) ?? [],
    subskillIds: question.subskillIds,
  };
}

/** Returns a message when a tag is not a subskill of this level's skills, or undefined when all are fine. */
export function subskillProblem(levelNumber: number, subskillIds: readonly string[]): string | undefined {
  const allowed = new Set(tagsForLevel(levelNumber)?.subskills.map(s => s.id) ?? []);
  const bad = subskillIds.filter(id => !allowed.has(id));
  return bad.length ? `These skills do not belong to this level: ${bad.join(', ')}.` : undefined;
}

/** The whole skill list with subskills, for forms and coverage tables. */
export function taxonomy() {
  return CORE_SKILLS.map(s => ({ id: s.id, name: s.name, domain: s.domain, definition: s.definition, subskills: s.subskills }));
}
