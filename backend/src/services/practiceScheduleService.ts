import { dbStore, PracticeSchedule } from '../db';
import { mapCompetencyToLevel, KNOWN_COMPETENCIES } from '../flnLevels';
import { randomUUID } from 'crypto';

// Shared practice-schedule creation and reconciliation logic, used by both
// index.ts and routes/students.ts.

// Normalizes a raw conceptMastery topic string against the 9 known
// competency names. Exact match (case-insensitive) first; otherwise, if the
// raw string is a substring of EXACTLY ONE known competency (e.g.
// "Operations" -> "Number Operations"), use that. If it's ambiguous — the
// fragment could plausibly belong to more than one known competency (e.g.
// "Number" matches both "Number Sense" and "Number Operations") — we don't
// guess; the raw string is returned unchanged rather than risk an incorrect
// match.
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

// Single creation point for a competency's PracticeSchedule — used both at
// generation time (so generation can read a real position) and at submit
// time (unchanged trigger point for legacy/paperless submissions).
// Guarantees exactly one code path decides what a brand-new or legacy
// (pre-currentLevelId) schedule's starting position is: the competency's
// easiest level, subIdx 0 — persisted as a real levelId instead of implied.
//
// A schedule missing currentLevelId (written before this field existed, or
// any competency string that no longer maps to a strand) is treated as
// needing backfill: currentSubIdx is reset to 0 rather than trusting an old
// 0/1/2 value that was never validated against a specific level.
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

// Ensures a PracticeSchedule row exists for every competency this
// diagnostic flagged 'Needs Practice' — without this, a competency that's
// never been weak before (a brand-new student's first diagnostic, or an
// existing student's newly-weak competency) has NO schedule at all, so it
// silently never appears in Due Today until a teacher happens to
// generate/grade a paper for it. Called before
// reconcilePracticeSchedulesWithDiagnostic, not merged into it: this only
// ever creates missing rows (via the same single creation point,
// getOrInitPracticeSchedule, so it's a no-op for a competency that already
// has one); reconcile's job is comparing old vs. new state for rows that
// already exist, which doesn't apply here.
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
// re-assessment. Called once, right after the diagnostic's EvaluationReport
// is persisted (the formal diagnostic-submit route only — the ICR bulk-scan
// and worksheet-submit routes also create EvaluationReports but are NOT
// formal re-assessments in this sense, and are not hooked here). Never
// creates schedules — that stays getOrInitPracticeSchedule's job at
// generation time; this only updates ones that already exist.
//
// previousCurrentLevel/newCurrentLevel are student.currentLevel before/after
// this diagnostic, on the 93-entry FLN_LEVELS_LIST scale — NOT the same
// numbering as PracticeSchedule.currentLevelId (the 59-id levels_main.html
// scale used by mapCompetencyToLevel below). The two scales are only ever
// compared against each other (via class band), never against currentLevelId.
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

  // Normalize conceptMastery's own keys first (e.g. the diagnostic route can
  // emit a typo'd/loosely-named topic instead of the canonical competency
  // name) — otherwise a schedule whose competency is already canonical never
  // matches a differently-spelled key here, even though
  // ensurePracticeSchedulesForWeakCompetencies (above) already normalizes in
  // the other direction when creating schedules from these same keys.
  const normalizedMastery: { [competency: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' } = {};
  for (const [raw, value] of Object.entries(conceptMastery)) {
    normalizedMastery[normalizeCompetencyName(raw)] = value;
  }

  // The 93-level scale is organized in ~10-level "class bands" (Preschool
  // 1/2/3, Class 1/2/3/4) — crossing a band means the student's overall
  // placement moved into meaningfully different grade-level material, not
  // just a small nudge within the same band.
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
