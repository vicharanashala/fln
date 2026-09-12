/**
 * Prerequisite edges for the 93-level FLN curriculum, keyed by conceptId.
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
  'S4.3': ['S3.6'],
  'S4.13': ['S3.6'],
  'S4.12': ['S2.4', 'S3.2'],
  'S4.4': ['S4.3'],
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

  // Chain C — Number Operations
  'S4.6': ['S4.4'],
  'S4.7': ['S4.4'],
  'S5.4': ['S4.6', 'S5.2'],
  'S5.5': ['S4.7'],
  'S5.6': ['S5.4'],
  'S5.8': ['S5.6', 'S5.19'],
  'S6.5': ['S5.4', 'S5.5', 'S6.1'],
  'S6.6': ['S5.8'],
  'S6.7': ['S6.6'],
  'S7.3': ['S6.5', 'S7.1'],
  'S7.5': ['S7.4'],
  'S7.14': ['S6.6'],

  // Chain D — Shapes & Spatial
  'S3.9': ['S1.6'],
  'S4.8': ['S2.6'],
  'S6.9': ['S4.8'],
  'S7.9': ['S6.9'],
  'S3.10': ['S2.10'],
  'S4.15': ['S3.10'],

  // Chain E — Measurement
  'S3.7': ['S2.8'],
  'S4.9': ['S3.7'],
  'S4.10': ['S3.7'],
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

  // Chain G — Money
  'S6.11': ['S5.9'],
  'S7.11': ['S6.11'],

  // Chain H — Calendar & Time
  'S7.10': ['S6.10'],

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
