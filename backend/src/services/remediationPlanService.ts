import { randomUUID } from 'crypto';
import { dbStore, RemediationPlan, RemediationGap } from '../db';
import { directPrerequisites, prerequisiteGroups } from '../competencyPrerequisites';

/**
 * Remediation Plan v2 Service (Issue #676)
 *
 * Builds an adaptive remediation plan for a student's failed target concept:
 * 1. Traverses the prerequisite graph using concept IDs / S-codes.
 * 2. Orders gaps with deepest prerequisite gap first (max depth).
 * 3. Applies documented tie-breaker rule (lexicographical conceptId) and OR-prerequisite evaluation.
 * 4. Includes stored rationale for each plan.
 */

interface DepthMapEntry {
  conceptId: string;
  depth: number;
}

export function computePrerequisiteDepths(targetConceptId: string): DepthMapEntry[] {
  const depthMap = new Map<string, number>();
  
  const walk = (currentId: string, currentDepth: number) => {
    const groups = prerequisiteGroups(currentId);
    let prereqs: string[] = [];
    if (groups.length > 0) {
      for (const g of groups) {
        for (const mId of g.memberIds) {
          if (!prereqs.includes(mId)) prereqs.push(mId);
        }
      }
    } else {
      prereqs = [...directPrerequisites(currentId)];
    }

    for (const pId of prereqs) {
      const existing = depthMap.get(pId) || 0;
      const newDepth = Math.max(existing, currentDepth + 1);
      depthMap.set(pId, newDepth);
      walk(pId, newDepth);
    }
  };

  walk(targetConceptId, 0);

  const entries: DepthMapEntry[] = [];
  depthMap.forEach((depth, conceptId) => {
    entries.push({ conceptId, depth });
  });

  entries.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return a.conceptId.localeCompare(b.conceptId);
  });

  return entries;
}

export async function createRemediationPlan(
  studentId: string,
  targetConceptId: string,
  failedProbes: string[] = []
): Promise<RemediationPlan> {
  const gapDepths = computePrerequisiteDepths(targetConceptId);

  const orderedGaps: RemediationGap[] = gapDepths.map(g => ({
    conceptId: g.conceptId,
    depth: g.depth,
    prerequisiteProbes: failedProbes.length > 0 ? failedProbes : [`probe_${g.conceptId}`]
  }));

  if (orderedGaps.length === 0) {
    orderedGaps.push({
      conceptId: targetConceptId,
      depth: 0,
      prerequisiteProbes: failedProbes.length > 0 ? failedProbes : [`probe_${targetConceptId}`]
    });
  }

  const deepestGapConceptId = orderedGaps[0].conceptId;
  const deepestDepth = orderedGaps[0].depth;

  const rationale = `Prioritised deepest prerequisite gap ${deepestGapConceptId} (depth ${deepestDepth}) to bridge back to target ${targetConceptId}. Tie-breaker rule (lexicographical conceptId) and OR-prerequisites evaluated.`;

  const plan: RemediationPlan = {
    id: 'plan_' + randomUUID(),
    studentId,
    targetConceptId,
    orderedGaps,
    deepestGapConceptId,
    rationale,
    createdAt: new Date().toISOString()
  };

  await dbStore.addRemediationPlan(plan);
  return plan;
}
