// Server-side view of the 93-level -> 24-skill -> ~179-subskill curriculum map.
//
// The canonical data lives in `frontend/src/data/skillProgressionMap.ts`. That
// module cannot be imported here: `frontend` and `backend` are separate npm
// workspaces with separate tsconfigs, and the backend ships as a single esbuild
// bundle. So the mapping is snapshotted into `./../data/skillLevelMap.json` by
// `scripts/generate-skill-level-map.ts`, and CI runs that script with `--check`
// to fail the build if the snapshot drifts from the source.
//
// This matters because the Question Intervention API validates every
// (level, skills, subskills) combination server-side. The client's cascading
// dropdowns are a convenience; they are not a guard, and a malformed request
// must not be able to file a logic against a level that cannot host it.

import snapshot from '../data/skillLevelMap.json';

export interface LevelInfo {
  levelId: string;       // "L30"
  levelNumber: number;   // 30
  capability: string;
  stage: string;         // "Class 1"
  sCode: string;         // "S4.3"
  skills: string[];      // union of primary + supporting, sorted
}

export interface SkillInfo {
  id: string;            // "SK05"
  name: string;
  domain: string;
  subskills: Array<{ id: string; name: string }>;
}

const LEVELS = snapshot.levels as Record<string, Omit<LevelInfo, 'levelId'>>;
const SKILLS = snapshot.skills as Record<string, Omit<SkillInfo, 'id'>>;

/** Total number of FLN levels. Read from the snapshot rather than hardcoded as 93. */
export const LEVEL_COUNT: number = snapshot.levelCount;

export function levelIdFor(levelNumber: number): string {
  return `L${levelNumber}`;
}

export function getLevel(levelNumber: number): LevelInfo | undefined {
  const id = levelIdFor(levelNumber);
  const entry = LEVELS[id];
  return entry ? { levelId: id, ...entry } : undefined;
}

export function getSkill(skillId: string): SkillInfo | undefined {
  const entry = SKILLS[skillId];
  return entry ? { id: skillId, ...entry } : undefined;
}

/** Skills validly attachable to a level (primary + supporting). Empty if the level is unknown. */
export function getSkillsForLevel(levelNumber: number): string[] {
  return getLevel(levelNumber)?.skills ?? [];
}

export function isSkillMappedToLevel(skillId: string, levelNumber: number): boolean {
  return getSkillsForLevel(levelNumber).includes(skillId);
}

/** Subskill IDs under the given skills, deduped and sorted. */
export function getSubskillsForSkills(skillIds: string[]): string[] {
  const out = new Set<string>();
  for (const sk of skillIds) {
    for (const ss of SKILLS[sk]?.subskills ?? []) out.add(ss.id);
  }
  return Array.from(out).sort();
}

/**
 * A subskill belongs to a skill when its dotted prefix matches — "SK05.04" is
 * under "SK05". Checked against the snapshot rather than by string surgery
 * alone, so a well-formed but non-existent id like "SK05.99" is still rejected.
 */
export function isSubskillUnderSkills(subskillId: string, skillIds: string[]): boolean {
  const prefix = subskillId.split('.')[0];
  if (!skillIds.includes(prefix)) return false;
  return (SKILLS[prefix]?.subskills ?? []).some(ss => ss.id === subskillId);
}

/**
 * The payload behind `GET /api/question-logics/level-map` — everything the
 * authoring form needs to drive its cascading dropdowns, in one response.
 */
export function buildLevelMapPayload() {
  return {
    levelCount: LEVEL_COUNT,
    levels: Object.entries(LEVELS)
      .map(([levelId, l]) => ({ levelId, ...l }))
      .sort((a, b) => a.levelNumber - b.levelNumber),
    skills: Object.entries(SKILLS).map(([id, s]) => ({ id, ...s })),
  };
}
