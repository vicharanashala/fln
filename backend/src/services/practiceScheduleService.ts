import { dbStore, PracticeSchedule } from '../db';
import { mapCompetencyToLevel, KNOWN_COMPETENCIES, getSubsCountForLevel, getNextLevelInStrand } from '../flnLevels';
import { randomUUID } from 'crypto';

// Shared practice-schedule creation, reconciliation, and interval-advance
// logic, used by routes/microPractice.ts and routes/students.ts.

// Normalizes a raw conceptMastery topic against the 9 known competency names:
// exact match first, else a substring match only if unambiguous — otherwise
// returns the raw string unchanged rather than guess.
export function normalizeCompetencyName(raw: string): string {
  const target = raw.trim().toLowerCase();
  if (!target) return raw;

  const exact = KNOWN_COMPETENCIES.find(c => c.toLowerCase() === target);
  if (exact) return exact;

  if (target.length >= 4) {
    const candidates = KNOWN_COMPETENCIES.filter(c => c.toLowerCase().includes(target));
    if (candidates.length === 1) return candidates[0];
  }

  return raw;
}

// Single creation point for a competency's PracticeSchedule, used at both
// generation and submit time. A schedule missing currentLevelId (legacy,
// pre-this-field) is backfilled to the competency's easiest level rather
// than trusting its old, unvalidated 0/1/2 value.
export async function getOrInitPracticeSchedule(
  studentId: string,
  studentName: string,
  teacherId: string,
  competency: string
): Promise<PracticeSchedule> {
  const schedules = await dbStore.getPracticeSchedules();
  const existing = schedules.find(s => s.studentId === studentId && s.competency === competency);

  if (existing && existing.currentLevelId != null) {
    return existing;
  }

  const easiestLevelId = mapCompetencyToLevel(competency);
  if (easiestLevelId == null) {
    throw new Error(`No level found for competency "${competency}".`);
  }

  if (existing) {
    // Legacy schedule (predates currentLevelId) — backfill in place.
    const updated = await dbStore.updatePracticeSchedule(existing.id, {
      currentLevelId: easiestLevelId,
      currentSubIdx: 0
    });
    return updated || { ...existing, currentLevelId: easiestLevelId, currentSubIdx: 0 };
  }

  const created: PracticeSchedule = {
    id: 'sched_' + randomUUID().slice(0, 8),
    studentId,
    studentName,
    teacherId,
    competency,
    intervalDays: 1,
    currentLevelId: easiestLevelId,
    currentSubIdx: 0,
    resolved: false,
    nextDueDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  await dbStore.addPracticeSchedule(created);
  return created;
}

// Ensures a PracticeSchedule row exists for every 'Needs Practice' competency
// — without it, a newly-weak competency has no schedule and silently never
// shows in Due Today. Only creates missing rows; called before reconcile,
// which handles rows that already exist.
export async function ensurePracticeSchedulesForWeakCompetencies(
  studentId: string,
  studentName: string,
  teacherId: string,
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' }
): Promise<void> {
  const seen = new Set<string>();
  for (const rawCompetency of Object.keys(conceptMastery)) {
    if (conceptMastery[rawCompetency] !== 'Needs Practice') continue;
    const competency = normalizeCompetencyName(rawCompetency);
    if (seen.has(competency)) continue;
    seen.add(competency);
    try {
      await getOrInitPracticeSchedule(studentId, studentName, teacherId, competency);
    } catch {
      // Doesn't map to any of the 9 known strands (e.g. a free-text
      // topics_to_focus string from the AI pipeline that isn't a
      // recognized competency name) — nothing real to schedule, skip it.
    }
  }
}

// Reconciles existing PracticeSchedule rows against a new formal diagnostic
// re-assessment (not ICR/worksheet-submit reports). previousCurrentLevel/
// newCurrentLevel are on the 93-entry scale — never compared directly
// against currentLevelId's 59-id scale, only via class band.
export async function reconcilePracticeSchedulesWithDiagnostic(
  studentId: string,
  studentName: string,
  teacherId: string,
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' },
  previousCurrentLevel: number,
  newCurrentLevel: number
): Promise<void> {
  const schedules = await dbStore.getPracticeSchedules();
  const studentSchedules = schedules.filter(s => s.studentId === studentId);
  if (studentSchedules.length === 0) return;

  // Normalize conceptMastery's keys too, so a canonical schedule competency
  // still matches a differently-spelled key.
  const normalizedMastery: { [competency: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' } = {};
  for (const [raw, value] of Object.entries(conceptMastery)) {
    normalizedMastery[normalizeCompetencyName(raw)] = value;
  }

  // Crossing a ~10-level class band means the student moved into
  // meaningfully different grade-level material, not just a small nudge.
  const previousBand = Math.floor((previousCurrentLevel - 1) / 10);
  const newBand = Math.floor((newCurrentLevel - 1) / 10);
  const crossedClassBand = previousBand !== newBand;

  for (const schedule of studentSchedules) {
    const competency = normalizeCompetencyName(schedule.competency);
    const status = normalizedMastery[competency];
    if (status === undefined) continue; // diagnostic gave no signal on this strand

    if (status !== 'Needs Practice') {
      // Now Strong/Satisfactory — resolved regardless of current position.
      await dbStore.updatePracticeSchedule(schedule.id, { resolved: true });
      continue;
    }

    // Still 'Needs Practice'.
    if (schedule.resolved) {
      // Previously resolved, but this new (more authoritative) diagnostic
      // re-flags it weak — un-resolve and restart at the easiest level,
      // same as a fresh weak competency.
      const easiestLevelId = mapCompetencyToLevel(competency);
      if (easiestLevelId != null) {
        await dbStore.updatePracticeSchedule(schedule.id, {
          resolved: false,
          currentLevelId: easiestLevelId,
          currentSubIdx: 0,
          intervalDays: 1
        });
      }
      continue;
    }

    if (crossedClassBand) {
      // Still weak, but overall placement moved into different grade-level
      // material — discard the old position, restart fresh.
      const easiestLevelId = mapCompetencyToLevel(competency);
      if (easiestLevelId != null) {
        await dbStore.updatePracticeSchedule(schedule.id, {
          currentLevelId: easiestLevelId,
          currentSubIdx: 0,
          intervalDays: 1,
          resolved: false
        });
      }
    }
    // else: still weak, same class band — leave currentLevelId/currentSubIdx/
    // intervalDays exactly as-is; no reason to discard existing progress.
  }
}

// Interval multiplier from up to the last 3 scores (current + up to 2 prior),
// reflecting how consistently the student has hit this tier — approximates
// Half-Life Regression's use of practice history instead of just the latest score.
function intervalFactorFromHistory(
  scorePercent: number,
  recentScorePercents: number[],
  inTier: (p: number) => boolean
): number {
  const window = [scorePercent, ...recentScorePercents].slice(0, 3);
  if (window.length < 2 || !window.every(inTier)) return 1.5;
  return window.length >= 3 ? 3 : 2.5;
}

// Three-tier scoring against real levelId/subIdx: >=80% advances subIdx
// (or the next strand level, or resolves if none left); 50-79% holds;
// <50% halves the interval. Interval only grows on success, shrinks on failure, never on a hold.
export function calculateNextScheduleState(
  currentIntervalDays: number,
  currentLevelId: number,
  currentSubIdx: number,
  correctCount: number,
  totalCount: number,
  recentScorePercents: number[] = []
): { intervalDays: number; levelId: number; subIdx: number; resolved: boolean } {
  const scorePercent = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  if (scorePercent >= 80) {
    const factor = intervalFactorFromHistory(scorePercent, recentScorePercents, p => p >= 80);
    const intervalDays = Math.min(30, Math.round(currentIntervalDays * factor));
    const subsInLevel = getSubsCountForLevel(currentLevelId) ?? 1;

    if (currentSubIdx + 1 < subsInLevel) {
      return { intervalDays, levelId: currentLevelId, subIdx: currentSubIdx + 1, resolved: false };
    }
    const nextLevelId = getNextLevelInStrand(currentLevelId);
    if (nextLevelId != null) {
      return { intervalDays, levelId: nextLevelId, subIdx: 0, resolved: false };
    }
    return { intervalDays, levelId: currentLevelId, subIdx: currentSubIdx, resolved: true };
  }

  if (scorePercent >= 50) {
    return { intervalDays: currentIntervalDays, levelId: currentLevelId, subIdx: currentSubIdx, resolved: false };
  }

  const factor = intervalFactorFromHistory(scorePercent, recentScorePercents, p => p < 50);
  const intervalDays = Math.max(1, Math.round(currentIntervalDays / factor));
  return { intervalDays, levelId: currentLevelId, subIdx: currentSubIdx, resolved: false };
}
