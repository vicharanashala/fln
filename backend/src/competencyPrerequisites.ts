/**
 * Prerequisite edges for the FLN curriculum (108 levels as of PR #517's Stage-3
 * finalisation, 2026-09-18), keyed by conceptId.
 *
 * SOURCE OF TRUTH: `Research/fln_level_networks.md` — Part 2, "The Ten Strand
 * Chains (the actual prerequisite graph)". That document expresses the graph as
 * typed edge lists and states outright that "The Evaluation Engine should
 * consume the edge list".
 *
 * Edge typing is load-bearing. The source document distinguishes three kinds of
 * relationship and warns that conflating them "produces false conclusions":
 *
 *   prereq   (->)  hard cognitive dependency. ONLY these are reproduced below.
 *   sequence (~>)  the material happens to teach them in this order; no
 *                  inference may be drawn in either direction. NOT included.
 *   parallel (||)  co-equal nodes, no dependency at all.               NOT included.
 *
 * Every id here is a conceptId (S1.1 - S7.18) — the immutable identity the
 * question generator already stamps on each Question and the key that
 * CURRICULUM_MAPPING is built around. There is no level-number arithmetic, no
 * name matching, and no translation layer: a failed question's conceptId is
 * looked up directly.
 *
 * This table is generated from the markdown edge lists rather than hand-typed.
 * Regenerate it if the research document's Part 2 tables change; do not edit
 * entries here by hand. `validateConceptPrerequisites()` re-checks the
 * invariants (known ids, no cycles) at runtime.
 */

import { getLevelForConcept } from './config/curriculumMap';

/**
 * "Alternative prerequisite pathways" — group-based prerequisite override,
 * added 2026-09-18, refined 2026-09-19 against an external design review
 * covering NCF-FS/NIPUN, DINA/DINO cognitive-diagnosis literature, ALEKS
 * (Knowledge Space Theory), AND/OR-graph theory, OWL, and MongoDB's own
 * data-modeling guidance.
 *
 * Deliberate naming: this is NOT "AND/OR prerequisites" in the sense of "we
 * aren't sure if this prerequisite matters" — uncertainty belongs in `status`/
 * `evidence`, not in choosing OR. An OR group means "there are multiple
 * legitimate, curriculum-approved ways a learner can arrive at this
 * prerequisite competency" — a reviewed pedagogical claim, not a hedge.
 *
 * Start every node's prerequisites as a single AND group (the flat
 * CONCEPT_PREREQUISITES table below already IS that AND group), and loosen a
 * *specific* node to OR later by adding one entry here — never by restructuring
 * CONCEPT_PREREQUISITES or touching any other node.
 *
 * A node is satisfied when AT LEAST ONE of its groups is fully satisfied (all
 * memberIds in that group are met). Leaving a conceptId out of this map means
 * "one AND group, exactly the members in CONCEPT_PREREQUISITES" — today's
 * existing behaviour, unchanged.
 *
 * FLN prerequisite-graph policy (agreed 2026-09-19, to be confirmed with
 * Pavani before the first real OR case ships):
 *   1. Every hard prerequisite is one or more prerequisite groups.
 *   2. Within an AND group, all members are required.
 *   3. Multiple groups = alternative prerequisite pathways.
 *   4. Default is one AND group per node.
 *   5. OR pathways require curriculum-lead approval + written rationale.
 *   6. Expert judgment proposes a relationship; student data validates or
 *      challenges it — never rewrites the graph automatically.
 *   7. Hard prerequisites (this file) are separate from merely recommended
 *      order — see `relationshipType` and the ⇢/sequence-only edges this file
 *      already excludes.
 *   8. Question->skill mapping (Q-matrix, Lakshya's task) and skill->
 *      prerequisite mapping (this file, curriculum team) have separate
 *      ownership — do not conflate them into one collection/table.
 *   9. Every relationship carries status + evidence (source, not just
 *      confidence).
 *   10. Every AND->OR change is logged (see PrerequisiteGraphChange below).
 *   11. Student mastery/BKT state is a separate layer, never merged into this
 *       graph.
 *   12. No automatic AND->OR promotion from student data alone — a human
 *       (curriculum lead) always approves.
 */
export type PrerequisiteGroupType = 'AND' | 'OR';
export type PrerequisiteGroupStatus = 'PROPOSED' | 'VALIDATED' | 'DEPRECATED';

/** Hard-gates progression vs. merely informs suggested order — policy point 7. */
export type PrerequisiteRelationshipType = 'HARD_PREREQUISITE' | 'RECOMMENDED' | 'SEQUENCE';

export type EvidenceSourceType = 'NCF_FS' | 'NIPUN' | 'EXPERT' | 'PILOT_DATA' | 'RESEARCH';

export interface PrerequisiteEvidence {
  sourceType: EvidenceSourceType;
  reference?: string;
  notes?: string;
  /** Present once status graduates to VALIDATED via real student data — policy point 6. */
  sampleSize?: number;
}

export interface PrerequisiteGroup {
  groupId: string;
  type: PrerequisiteGroupType;
  memberIds: readonly string[];
  relationshipType: PrerequisiteRelationshipType;
  status: PrerequisiteGroupStatus;
  rationale?: string;
  evidence?: PrerequisiteEvidence;
}

/**
 * Append-only audit trail for AND<->OR (or any group-shape) changes — policy
 * point 10. Nothing has changed yet (CONCEPT_PREREQUISITE_GROUP_OVERRIDES is
 * still empty), so this is currently unused; it exists so the *first* real
 * change has somewhere principled to be recorded, rather than a habit being
 * invented ad hoc under deadline later. Not wired to a Mongo collection yet —
 * this is a static-config file, not a live-edited one, so there is nothing to
 * persist until the graph itself becomes editable at runtime.
 */
export interface PrerequisiteGraphChange {
  conceptId: string;
  groupId: string;
  changedAt: string; // ISO date
  changedBy: string;
  previous: Pick<PrerequisiteGroup, 'type' | 'memberIds'>;
  next: Pick<PrerequisiteGroup, 'type' | 'memberIds'>;
  reason: string;
  evidence: PrerequisiteEvidence;
  approvedBy: string;
}

/**
 * Explicit per-node overrides only. Empty today — no edge has been loosened to
 * OR yet (see #466: "which prerequisites are really OR ... settle through
 * teacher sessions, not on paper"). Per policy point 5/6, do not populate this
 * from a guess made while wiring up code: OR requires curriculum-lead approval
 * and either NCF-FS/NIPUN textual support or real pilot/student-response
 * evidence (Pavani's 2026-09-18 call: "we will create a feedback loop where we
 * learn from the student responses and improve the levels") — not expert
 * judgment alone, and not silently. Add a conceptId here only once that
 * evidence and sign-off exist.
 */
export const CONCEPT_PREREQUISITE_GROUP_OVERRIDES: Readonly<Record<string, readonly PrerequisiteGroup[]>> = {
  // Example shape for whoever adds the first OR case, once Pavani has approved
  // a concrete educational example (not merely "we aren't sure"):
  // 'S3.25': [
  //   {
  //     groupId: 'g1', type: 'AND', memberIds: ['S3.2'],
  //     relationshipType: 'HARD_PREREQUISITE', status: 'PROPOSED',
  //     evidence: { sourceType: 'NCF_FS', reference: 'C-8.13' },
  //   },
  //   {
  //     groupId: 'g2', type: 'AND', memberIds: ['S3.1', 'S3.6'],
  //     relationshipType: 'HARD_PREREQUISITE', status: 'PROPOSED',
  //     rationale: 'Alternative route: ...', evidence: { sourceType: 'EXPERT' },
  //   },
  // ],
};

/**
 * Resolved prerequisite groups for a concept: the override if one exists,
 * otherwise the single implicit AND group derived from CONCEPT_PREREQUISITES.
 * The implicit group is tagged HARD_PREREQUISITE/VALIDATED because it
 * reproduces exactly today's existing, already-relied-upon behaviour — not a
 * new provisional claim.
 */
export function prerequisiteGroups(conceptId: string): readonly PrerequisiteGroup[] {
  const override = CONCEPT_PREREQUISITE_GROUP_OVERRIDES[conceptId];
  if (override) return override;
  const flat = CONCEPT_PREREQUISITES[conceptId];
  if (!flat || flat.length === 0) return [];
  return [{
    groupId: 'g1',
    type: 'AND',
    memberIds: flat,
    relationshipType: 'HARD_PREREQUISITE',
    status: 'VALIDATED',
  }];
}

/**
 * Whether conceptId's prerequisites are satisfied, given the set of concepts
 * already mastered. True when at least one HARD_PREREQUISITE group is fully
 * covered by `mastered` (or when the concept has no such groups — an entry
 * node, or one whose only groups are RECOMMENDED/SEQUENCE — policy point 7:
 * only hard prerequisites gate progression).
 */
export function isPrerequisiteSatisfied(conceptId: string, mastered: ReadonlySet<string>): boolean {
  const groups = prerequisiteGroups(conceptId).filter(g => g.relationshipType === 'HARD_PREREQUISITE');
  if (groups.length === 0) return true;
  return groups.some(g => g.memberIds.every(id => mastered.has(id)));
}

export const CONCEPT_PREREQUISITES: Readonly<Record<string, readonly string[]>> = {

  // Chain A — Pre-Number Foundations
  'S2.1': ['S1.1', 'S1.3'],
  'S2.2': ['S2.1'],
  'S3.3': ['S2.1'],
  'S3.4': ['S2.2'],
  'S3.5': ['S2.3'],
  'S4.1': ['S3.3'],

  // Chain B — Number Sense
  'S2.4': ['S1.5'],
  'S2.5': ['S2.4'],
  'S2.9': ['S1.7'],
  'S3.1': ['S2.5'],
  'S3.2': ['S3.1'],
  'S3.6': ['S3.2'],
  'S4.3': ['S3.6', 'S3.11'],
  'S4.13': ['S3.6'],
  'S4.12': ['S2.4', 'S3.2'],
  'S4.4': ['S4.3', 'S3.13'],
  'S4.5': ['S4.4'],
  'S5.1': ['S4.5'],
  'S5.2': ['S5.1'],
  'S5.17': ['S5.2', 'S4.12'],
  'S5.3': ['S5.2'],
  'S6.1': ['S5.3'],
  'S6.2': ['S6.1'],
  'S6.3': ['S6.2', 'S4.2'],
  'S6.4': ['S6.3'],
  'S7.1': ['S6.4'],
  'S7.2': ['S7.1'],
  'S4.2': ['S4.1'],
  'S7.15': ['S7.1'],
  // Added 2026-09-18, PR #517 §5g (Research/fln_level_networks.md Part 2b) — the year-before-Class-1 stage finalisation.
  'S3.11': ['S1.4'],
  'S3.12': ['S2.4'],
  'S3.13': ['S3.1'],

  // Chain C — Number Operations
  'S4.6': ['S4.4', 'S3.14'],
  'S4.7': ['S4.4', 'S3.15'],
  'S5.4': ['S4.6', 'S5.2'],
  'S5.5': ['S4.7'],
  'S5.6': ['S5.4', 'S3.16'],
  'S5.7': ['S3.17'],
  'S5.8': ['S5.6', 'S5.19'],
  'S6.5': ['S5.4', 'S5.5', 'S6.1'],
  'S6.6': ['S5.8'],
  'S6.7': ['S6.6'],
  'S7.3': ['S6.5', 'S7.1'],
  'S7.5': ['S7.4'],
  'S7.14': ['S6.6'],
  // Added 2026-09-18, PR #517 §5g — S5.7 previously had no incoming prerequisite edge.
  'S3.14': ['S2.5'],
  'S3.15': ['S2.5'],
  'S3.16': ['S2.5'],
  'S3.17': ['S1.1'],

  // Chain D — Shapes & Spatial
  'S3.9': ['S1.6'],
  'S4.8': ['S2.6', 'S3.20'],
  'S6.9': ['S4.8', 'S3.21'],
  'S7.9': ['S6.9'],
  'S3.10': ['S2.10'],
  'S4.15': ['S3.10'],
  // Added 2026-09-18, PR #517 §5g.
  'S3.20': ['S2.6'],
  'S3.21': ['S2.6'],
  'S3.22': ['S2.6'],

  // Chain E — Measurement
  'S3.7': ['S2.8'],
  'S4.9': ['S3.7'],
  'S4.10': ['S3.7', 'S3.23'],
  'S5.11': ['S4.9', 'S4.10'],
  'S6.8': ['S5.11'],
  'S7.7': ['S6.8'],
  'S7.8': ['S6.8'],
  'S7.18': ['S6.8'],

  // Chain F — Patterns
  'S3.8': ['S2.7'],
  'S4.11': ['S3.8'],
  'S5.16': ['S4.4'],
  'S5.19': ['S5.16'],
  'S6.13': ['S5.19'],
  'S7.12': ['S6.13'],
  // Added 2026-09-18, PR #517 §5g.
  'S3.18': ['S3.8'],
  'S3.19': ['S3.8'],

  // Chain G — Money
  'S6.11': ['S5.9'],
  'S7.11': ['S6.11'],

  // Chain H — Calendar & Time
  'S7.10': ['S6.10'],
  // Added 2026-09-18, PR #517 §5g — S5.14 previously had no incoming prerequisite edge.
  'S5.14': ['S3.24'],

  // Chain I — Fractions
  'S6.12': ['S5.10'],
  'S7.6': ['S6.12'],

  // Chain J — Data Handling
  'S6.14': ['S5.15'],
  'S7.13': ['S6.14'],
};

/**
 * Human-readable curriculum identity for a conceptId, resolved through the
 * existing CURRICULUM_MAPPING. No second name table is introduced here.
 * Returns undefined for an id the curriculum does not know.
 */
export function describeConcept(
  conceptId: string
): { conceptId: string; level: number; levelTitle: string; strand: string } | undefined {
  const cfg = getLevelForConcept(conceptId);
  if (!cfg) return undefined;
  return {
    conceptId,
    level: cfg.levelNumber,
    levelTitle: cfg.levelTitle,
    strand: cfg.strand,
  };
}

/**
 * Direct prerequisites of a concept: the exact edge list from the source
 * document, in document order. Returns [] for an unknown concept or one with
 * no prerequisite edges — never a guess.
 */
export function directPrerequisites(conceptId: string): readonly string[] {
  return CONCEPT_PREREQUISITES[conceptId] ?? [];
}

/**
 * Transitive prerequisites of a concept, deepest-first.
 *
 * Ordering is deterministic: a depth-first walk in the document's own edge
 * order, emitting each prerequisite after its own prerequisites, so a teacher
 * reading the list top-to-bottom gets a workable teaching sequence. Ids already
 * seen are skipped, which also makes the walk safe against a cycle should one
 * ever be introduced.
 */
export function resolvePrerequisites(conceptId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    for (const p of directPrerequisites(id)) {
      if (seen.has(p)) continue;
      seen.add(p);
      walk(p);
      out.push(p);
    }
  };
  walk(conceptId);
  return out;
}

export interface ConceptPrerequisiteReport {
  totalConceptsWithPrerequisites: number;
  totalEdges: number;
  unknownConceptIds: string[];
  cycles: string[][];
  isValid: boolean;
}

/**
 * Verify the table's invariants: every id (both sides of every edge) is a real
 * conceptId in CURRICULUM_MAPPING, and the graph is acyclic.
 */
export function validateConceptPrerequisites(): ConceptPrerequisiteReport {
  const unknown = new Set<string>();
  let totalEdges = 0;

  for (const [target, prereqs] of Object.entries(CONCEPT_PREREQUISITES)) {
    if (!getLevelForConcept(target)) unknown.add(target);
    for (const p of prereqs) {
      totalEdges++;
      if (!getLevelForConcept(p)) unknown.add(p);
    }
  }

  const cycles: string[][] = [];
  const state = new Map<string, number>(); // 1 = on stack, 2 = done
  const stack: string[] = [];
  const visit = (id: string) => {
    if (state.get(id) === 1) {
      cycles.push(stack.slice(stack.indexOf(id)).concat(id));
      return;
    }
    if (state.get(id) === 2) return;
    state.set(id, 1);
    stack.push(id);
    for (const p of directPrerequisites(id)) visit(p);
    stack.pop();
    state.set(id, 2);
  };
  for (const id of Object.keys(CONCEPT_PREREQUISITES)) visit(id);

  return {
    totalConceptsWithPrerequisites: Object.keys(CONCEPT_PREREQUISITES).length,
    totalEdges,
    unknownConceptIds: Array.from(unknown).sort(),
    cycles,
    isValid: unknown.size === 0 && cycles.length === 0,
  };
}
