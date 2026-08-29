// ============================================================================
// Learning Path engine  (issue: teacher-mediated remediation loop)
// ============================================================================
//
// The diagnostic already tells a teacher *what* a child got wrong: every
// evaluation report carries `failedLevels` and a `skillGaps` list, and the
// submit handler (backend/src/routes/students.ts) even computes a one-shot
// `prerequisiteLearningPath` for the report card. But that is a snapshot — it
// is recomputed from scratch on every diagnostic and there is nowhere to record
// that a teacher has actually *taught* a gap and the child has moved on.
//
// This module turns those already-computed gaps into a durable, ordered
// remediation journey that a teacher works through node by node:
//
//     failedLevels / skillGaps            (from an EvaluationReport)
//       -> conceptIds                     (via CURRICULUM_MAPPING, S1.1..S7.18)
//       -> resolvePrerequisites()         (competencyPrerequisites.ts edges)
//       -> ordered LearningPathNode[]     (foundations first, then the gaps)
//
// It is deliberately a set of *pure* functions with no database, express, or
// I/O dependency, so the ordering rules can be unit-tested in isolation
// (see learningPathEngine.selftest.ts) and reused by any route or script.
//
// Identity comes from ONE authoritative field — the immutable conceptId tag of
// the 93-level framework. There is no level-number arithmetic, no topic-string
// matching and no second name table: a concept the curriculum cannot resolve
// contributes nothing rather than being guessed at. This mirrors the existing
// prerequisiteLearningPath derivation so the two never disagree.

import {
  resolvePrerequisites,
  describeConcept,
} from './competencyPrerequisites';
import { CURRICULUM_MAPPING } from './config/curriculumMap';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LearningPathStatus = 'not_started' | 'in_progress' | 'mastered';

export const LEARNING_PATH_STATUSES: readonly LearningPathStatus[] = [
  'not_started',
  'in_progress',
  'mastered',
];

export interface LearningPathNode {
  /** Immutable 93-framework concept tag, e.g. "S3.3". The only identity key. */
  conceptId: string;
  /** FLN level number (1..93) this concept sits at. */
  level: number;
  /** Human-readable curriculum title, from CURRICULUM_MAPPING. */
  levelTitle: string;
  /** Strand this concept belongs to (Number Sense, Operations, ...). */
  strand: string;
  /**
   * 'gap'        — a concept the student directly failed in the diagnostic.
   * 'foundation' — a prerequisite of one or more failed concepts; the child
   *                needs it before the gap concepts can be re-attempted.
   */
  kind: 'foundation' | 'gap';
  /** Teacher-advanced progress for this node. */
  status: LearningPathStatus;
  /** conceptIds of the failed ('gap') concepts this node unblocks. [] for gaps. */
  blocks: string[];
  /** How many distinct gap concepts this node unblocks (foundations only). */
  blocksCount: number;
  /** ISO timestamp of the last status change, if any. */
  updatedAt?: string;
  /** ISO timestamp the node was marked 'mastered', if it currently is. */
  masteredAt?: string;
}

export interface LearningPath {
  /** ISO timestamp the path was (re)generated. */
  generatedAt: string;
  /** id of the EvaluationReport this path was derived from, if any. */
  sourceReportId: string | null;
  nodes: LearningPathNode[];
}

/** Minimal shape this engine needs from an EvaluationReport. */
export interface LearningPathInput {
  /** Distinct FLN level numbers the student failed. Preferred gap source. */
  failedLevels?: number[];
  /**
   * Pre-computed skill gaps (conceptId + curriculum identity). Used only as a
   * fallback for older reports that predate `failedLevels`.
   */
  skillGaps?: { conceptId: string; level: number; levelTitle: string; strand: string }[];
  /** id of the report these gaps came from, threaded onto the path. */
  sourceReportId?: string | null;
}

export interface LearningPathSummary {
  total: number;
  mastered: number;
  inProgress: number;
  notStarted: number;
  /** Percentage of nodes mastered, 0..100 (integer). */
  percentMastered: number;
}

// ─── Core builder ─────────────────────────────────────────────────────────────

/**
 * Resolve the set of directly-failed ("gap") concepts from a report, in a
 * stable order and de-duplicated. Prefers `failedLevels` (the authoritative
 * per-level pass/fail breakdown); falls back to `skillGaps` conceptIds for
 * older reports. Concepts the curriculum cannot resolve are dropped.
 */
function gapConceptIdsFrom(input: LearningPathInput): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string | undefined | null) => {
    if (!id || seen.has(id)) return;
    if (!describeConcept(id)) return; // unknown to curriculum → never guess
    seen.add(id);
    ids.push(id);
  };

  if (input.failedLevels && input.failedLevels.length > 0) {
    for (const lvl of [...input.failedLevels].sort((a, b) => a - b)) {
      push(CURRICULUM_MAPPING[lvl]?.conceptId);
    }
  } else if (input.skillGaps && input.skillGaps.length > 0) {
    for (const g of input.skillGaps) push(g.conceptId);
  }
  return ids;
}

/** Index an existing path by conceptId so progress survives a recompute. */
function makeStatusLookup(existing?: LearningPath | null) {
  const map = new Map<string, LearningPathNode>();
  if (existing) for (const n of existing.nodes) map.set(n.conceptId, n);
  return (conceptId: string) => map.get(conceptId);
}

/**
 * Build (or rebuild) a student's learning path from a diagnostic report's gaps.
 *
 * Ordering — foundations before gaps, matching the report card's existing
 * remediationSequence (shared foundations → supporting skills → failed
 * competencies), with deterministic tie-breaks so the output is stable for a
 * given input (which is what makes the self-test possible):
 *
 *   Foundations: by blocksCount desc (a skill that unblocks several gaps is
 *                taught first), then level asc, then conceptId.
 *   Gaps:        by level asc, then conceptId.
 *
 * When `existing` is supplied, every node that still applies keeps its prior
 * status/timestamps — so re-running a diagnostic never silently erases a
 * teacher's recorded progress. Nodes that no longer correspond to a gap simply
 * fall away; genuinely new gaps arrive as 'not_started'.
 */
export function buildLearningPath(
  input: LearningPathInput,
  existing?: LearningPath | null,
): LearningPath {
  const gapIds = gapConceptIdsFrom(input);
  const gapSet = new Set(gapIds);
  const statusFor = makeStatusLookup(existing);

  // Walk each gap's transitive prerequisites (deepest foundation first) and
  // record, for every foundation, which gap concepts it unblocks.
  const foundationOrder: string[] = [];
  const blocksByFoundation = new Map<string, Set<string>>();
  for (const gapId of gapIds) {
    for (const prereqId of resolvePrerequisites(gapId)) {
      if (gapSet.has(prereqId)) continue; // a gap is shown as a gap, not twice
      if (!describeConcept(prereqId)) continue; // unknown to curriculum → skip
      if (!blocksByFoundation.has(prereqId)) {
        blocksByFoundation.set(prereqId, new Set());
        foundationOrder.push(prereqId);
      }
      blocksByFoundation.get(prereqId)!.add(gapId);
    }
  }

  const toNode = (
    conceptId: string,
    kind: 'foundation' | 'gap',
    blocks: string[],
  ): LearningPathNode => {
    const d = describeConcept(conceptId)!; // guarded above; always resolvable
    const prev = statusFor(conceptId);
    const node: LearningPathNode = {
      conceptId,
      level: d.level,
      levelTitle: d.levelTitle,
      strand: d.strand,
      kind,
      status: prev?.status ?? 'not_started',
      blocks,
      blocksCount: blocks.length,
    };
    if (prev?.updatedAt) node.updatedAt = prev.updatedAt;
    if (prev?.status === 'mastered' && prev.masteredAt) node.masteredAt = prev.masteredAt;
    return node;
  };

  const foundationNodes = foundationOrder
    .map((id) => toNode(id, 'foundation', Array.from(blocksByFoundation.get(id) ?? [])))
    .sort(
      (a, b) =>
        b.blocksCount - a.blocksCount ||
        a.level - b.level ||
        a.conceptId.localeCompare(b.conceptId),
    );

  const gapNodes = gapIds
    .map((id) => toNode(id, 'gap', []))
    .sort((a, b) => a.level - b.level || a.conceptId.localeCompare(b.conceptId));

  return {
    generatedAt: new Date().toISOString(),
    sourceReportId: input.sourceReportId ?? null,
    nodes: [...foundationNodes, ...gapNodes],
  };
}

// ─── Mutations / queries ──────────────────────────────────────────────────────

export function isLearningPathStatus(v: unknown): v is LearningPathStatus {
  return typeof v === 'string' && (LEARNING_PATH_STATUSES as readonly string[]).includes(v);
}

/**
 * Return a copy of `path` with a single node's status advanced. Returns null if
 * no node with `conceptId` exists (so callers can 404 instead of silently
 * no-oping). masteredAt is set only while the node is mastered.
 */
export function applyNodeStatus(
  path: LearningPath,
  conceptId: string,
  status: LearningPathStatus,
): LearningPath | null {
  const idx = path.nodes.findIndex((n) => n.conceptId === conceptId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const node: LearningPathNode = { ...path.nodes[idx], status, updatedAt: now };
  if (status === 'mastered') node.masteredAt = now;
  else delete node.masteredAt;

  const nodes = [...path.nodes];
  nodes[idx] = node;
  return { ...path, nodes };
}

/** Roll a path up to headline counts for progress bars / dashboards. */
export function summarizeLearningPath(
  path: LearningPath | null | undefined,
): LearningPathSummary {
  const nodes = path?.nodes ?? [];
  let mastered = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const n of nodes) {
    if (n.status === 'mastered') mastered++;
    else if (n.status === 'in_progress') inProgress++;
    else notStarted++;
  }
  const total = nodes.length;
  return {
    total,
    mastered,
    inProgress,
    notStarted,
    percentMastered: total === 0 ? 0 : Math.round((mastered / total) * 100),
  };
}
