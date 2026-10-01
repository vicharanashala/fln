/**
 * Learning relationship graph (Skill -> prerequisite_of -> Skill)
 * encoding the KST/AND-OR prerequisite chain as structured data.
 *
 * GOVERNING RULINGS (Jinal, 11 Sep):
 * - All 10 subskills required (SK13.01–.10), none skippable
 * - No OR-path around SK13.02 (concrete addition) — rejected
 * - SK13.06 (two-digit addition) has two valid AND-routes, combined as one OR-group:
 *     Route 1 (g1): via SK13.05 (Addition within 30)
 *     Route 2 (g2): via SK13.04 (Addition within 20) + place value (SK12)
 *
 * Matches the relational schema in D1.2 / D1.5.
 */

import { getSkill, isSubskillUnderSkills } from './config/skillLevelMap';

export type SkillRelationshipType = 'PREREQUISITE' | 'AND' | 'OR';
export type SkillRelationshipStatus = 'PROPOSED' | 'VALIDATED' | 'DEPRECATED';

export interface SkillRelationship {
  id?: string;
  toSkill: string;           // Target subskill/skill ID (e.g. 'SK13.06')
  fromSkill: string;         // Prerequisite subskill/skill ID (e.g. 'SK13.05', 'SK12')
  groupId: string;           // Clause/Group identifier (e.g. 'g1', 'g2') to group AND members into OR routes
  relationshipType: SkillRelationshipType;
  status: SkillRelationshipStatus;
  rationale?: string;
}

export interface SkillPrerequisiteRoute {
  groupId: string;
  relationshipType: SkillRelationshipType;
  members: string[];
  rationale?: string;
}

export interface SkillPrerequisitesResult {
  targetSkill: string;
  routes: SkillPrerequisiteRoute[];
}

export interface SkillRelationshipsReport {
  totalRelationships: number;
  totalSkillsWithPrerequisites: number;
  unknownSkillIds: string[];
  cycles: string[][];
  isValid: boolean;
}

/**
 * Seed dataset encoding the SK13 subskill prerequisite graph per the 11 Sep rulings.
 */
export const SKILL_RELATIONSHIPS: readonly SkillRelationship[] = [
  // SK13.01 Combine sets — entry subskill, no prerequisites

  // SK13.02 Concrete addition — strictly requires SK13.01 (Ruling 2: no OR path around SK13.02)
  {
    id: 'sr_sk13_02_g1_1',
    toSkill: 'SK13.02',
    fromSkill: 'SK13.01',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Ruling 2: Concrete addition strictly requires set combination (SK13.01); no OR-path around SK13.02',
  },

  // SK13.03 Single-digit addition — requires SK13.02
  {
    id: 'sr_sk13_03_g1_1',
    toSkill: 'SK13.03',
    fromSkill: 'SK13.02',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Single-digit addition requires concrete addition',
  },

  // SK13.04 Addition within 20 — requires SK13.03
  {
    id: 'sr_sk13_04_g1_1',
    toSkill: 'SK13.04',
    fromSkill: 'SK13.03',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Addition within 20 requires single-digit addition',
  },

  // SK13.05 Addition within 30 — requires SK13.04
  {
    id: 'sr_sk13_05_g1_1',
    toSkill: 'SK13.05',
    fromSkill: 'SK13.04',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Addition within 30 requires addition within 20',
  },

  // SK13.06 Two-digit addition — Ruling 3: two valid AND-routes in one OR-group
  // Route 1 (g1): via SK13.05
  {
    id: 'sr_sk13_06_g1_1',
    toSkill: 'SK13.06',
    fromSkill: 'SK13.05',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Ruling 3 Route A: Two-digit addition via addition within 30 (SK13.05)',
  },
  // Route 2 (g2): via SK13.04 + place value (SK12)
  {
    id: 'sr_sk13_06_g2_1',
    toSkill: 'SK13.06',
    fromSkill: 'SK13.04',
    groupId: 'g2',
    relationshipType: 'AND',
    status: 'VALIDATED',
    rationale: 'Ruling 3 Route B: Two-digit addition via addition within 20 (SK13.04) + place value (SK12)',
  },
  {
    id: 'sr_sk13_06_g2_2',
    toSkill: 'SK13.06',
    fromSkill: 'SK12',
    groupId: 'g2',
    relationshipType: 'AND',
    status: 'VALIDATED',
    rationale: 'Ruling 3 Route B: Two-digit addition via addition within 20 (SK13.04) + place value (SK12)',
  },

  // SK13.07 Addition with regrouping — requires SK13.06
  {
    id: 'sr_sk13_07_g1_1',
    toSkill: 'SK13.07',
    fromSkill: 'SK13.06',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Addition with regrouping requires two-digit addition',
  },

  // SK13.08 Three-digit addition — requires SK13.07
  {
    id: 'sr_sk13_08_g1_1',
    toSkill: 'SK13.08',
    fromSkill: 'SK13.07',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Three-digit addition requires addition with regrouping',
  },

  // SK13.09 Multi-digit addition — requires SK13.08
  {
    id: 'sr_sk13_09_g1_1',
    toSkill: 'SK13.09',
    fromSkill: 'SK13.08',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Multi-digit addition requires three-digit addition',
  },

  // SK13.10 Addition word problems — requires SK13.09
  {
    id: 'sr_sk13_10_g1_1',
    toSkill: 'SK13.10',
    fromSkill: 'SK13.09',
    groupId: 'g1',
    relationshipType: 'PREREQUISITE',
    status: 'VALIDATED',
    rationale: 'Addition word problems require multi-digit addition',
  },
];

/**
 * Get all configured skill relationship rows.
 */
export function getAllSkillRelationships(): readonly SkillRelationship[] {
  return SKILL_RELATIONSHIPS;
}

/**
 * Get all relationship rows targeting a specific skill or subskill ID.
 */
export function getRelationshipsForTargetSkill(targetSkillId: string): SkillRelationship[] {
  return SKILL_RELATIONSHIPS.filter(r => r.toSkill === targetSkillId);
}

/**
 * Get structured prerequisite routes for a target skill.
 * Answers "what does a learner need before <targetSkill>".
 */
export function getSkillPrerequisites(targetSkillId: string): SkillPrerequisitesResult {
  const rows = getRelationshipsForTargetSkill(targetSkillId);
  const routeMap = new Map<string, { groupId: string; relationshipType: SkillRelationshipType; members: string[]; rationale?: string }>();

  for (const row of rows) {
    if (!routeMap.has(row.groupId)) {
      routeMap.set(row.groupId, {
        groupId: row.groupId,
        relationshipType: row.relationshipType,
        members: [],
        rationale: row.rationale,
      });
    }
    const route = routeMap.get(row.groupId)!;
    if (!route.members.includes(row.fromSkill)) {
      route.members.push(row.fromSkill);
    }
  }

  return {
    targetSkill: targetSkillId,
    routes: Array.from(routeMap.values()),
  };
}

/**
 * Check whether a target skill's prerequisites are satisfied by a set of mastered skills.
 * A skill is satisfied if it has no prerequisite routes, OR if AT LEAST ONE route has
 * all its member prerequisites present in `masteredSkills`.
 */
export function isSkillPrerequisiteSatisfied(
  targetSkillId: string,
  masteredSkills: ReadonlySet<string> | string[]
): boolean {
  const masteredSet = masteredSkills instanceof Set ? masteredSkills : new Set(masteredSkills);
  const { routes } = getSkillPrerequisites(targetSkillId);

  if (routes.length === 0) return true;

  return routes.some(route => route.members.every(member => masteredSet.has(member)));
}

/**
 * Validates the skill relationship graph:
 * - Checks that all target and prerequisite IDs are known skills or subskills.
 * - Checks that there are no cycle dependencies.
 */
export function validateSkillRelationships(): SkillRelationshipsReport {
  const unknown = new Set<string>();
  const targets = new Set<string>();
  let totalRelationships = SKILL_RELATIONSHIPS.length;

  for (const rel of SKILL_RELATIONSHIPS) {
    targets.add(rel.toSkill);
    if (!isValidSkillOrSubskill(rel.toSkill)) unknown.add(rel.toSkill);
    if (!isValidSkillOrSubskill(rel.fromSkill)) unknown.add(rel.fromSkill);
  }

  // Cycle check using DFS
  const cycles: string[][] = [];
  const state = new Map<string, number>(); // 1 = visiting, 2 = visited
  const stack: string[] = [];

  const visit = (id: string) => {
    if (state.get(id) === 1) {
      cycles.push(stack.slice(stack.indexOf(id)).concat(id));
      return;
    }
    if (state.get(id) === 2) return;

    state.set(id, 1);
    stack.push(id);

    const { routes } = getSkillPrerequisites(id);
    for (const route of routes) {
      for (const member of route.members) {
        visit(member);
      }
    }

    stack.pop();
    state.set(id, 2);
  };

  for (const targetId of targets) {
    visit(targetId);
  }

  return {
    totalRelationships,
    totalSkillsWithPrerequisites: targets.size,
    unknownSkillIds: Array.from(unknown).sort(),
    cycles,
    isValid: unknown.size === 0 && cycles.length === 0,
  };
}

/**
 * Checks if a given ID is a valid skill or subskill.
 */

function isValidSkillOrSubskill(id: string): boolean {
  // Check direct skill ID (e.g. 'SK12', 'SK13')
  if (getSkill(id)) return true;
  // Check subskill ID (e.g. 'SK13.06')
  const prefix = id.split('.')[0];
  return isSubskillUnderSkills(id, [prefix]);
}
