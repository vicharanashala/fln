/**
 * SRS R-7 — Certification orchestration for the LEGACY backend.
 *
 * Wires the pure eligibility engine (certification.ts) to the legacy
 * MongoDB-backed DBStore (db.ts). Called fire-and-forget from
 * backend/src/index.ts at the two EvaluationReport creation sites
 * (:825 diagnostic, :1376 worksheet evaluation submit).
 *
 * Per-student serialisation: a module-level Map<studentId, Promise<void>>
 * chains concurrent triggers for the same student so they run in order.
 * Lost on process restart, which is acceptable for single-process dev/prod.
 * Revisit when scaling to multiple replicas (use a Mongo-backed lock then).
 *
 * Errors are caught and logged via dbStore.addLog; never propagated to the
 * caller (worksheet submission must not fail because certification recompute
 * failed).
 */
import { randomUUID } from 'crypto';
import { dbStore, Student, School, Certification, CertificationStatus, UserRole } from './db';
import { decideEligibility, EligibilityDecision } from './certification';
import { getRequirementsForClassLevel } from './competencyRequirements';
import { notifyCertificationReviewNeeded } from './modules/certification/services/notification.service';

const inFlight: Map<string, Promise<void>> = new Map();

function parseClassNumber(classGroup: string): number {
  // Student.classGroup is stored as "Class 2" / "Class 3" / "Class 4".
  // Falls back to 0 (unknown) on a malformed value; the engine still runs
  // but no requirements match so the decision is empty.
  const m = classGroup.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function summariseForReview(decision: EligibilityDecision): string {
  const parts: string[] = [];
  if (decision.missingTopics.length > 0) {
    parts.push(`below threshold: ${decision.missingTopics.join(', ')}`);
  }
  if (decision.unassessedTopics.length > 0) {
    parts.push(`unassessed: ${decision.unassessedTopics.join(', ')}`);
  }
  return parts.length > 0 ? `New evidence — ${parts.join('; ')}` : 'New evidence';
}

export async function runCertificationEligibilityForStudent(
  student: Student,
  evaluatedAt: string = new Date().toISOString()
): Promise<void> {
  const conceptMastery = await dbStore.getLatestConceptMastery(student.id);
  if (!conceptMastery) {
    // Student has no EvaluationReports (race or new student). Nothing to decide.
    return;
  }

  const classNumber = parseClassNumber(student.classGroup);
  if (classNumber < 2 || classNumber > 4) {
    // Out of R-7 scope (class 1, or unknown). Skip silently — not an error.
    return;
  }

  const requirements = getRequirementsForClassLevel(classNumber, 5);
  const mandatory = requirements.filter((r) => r.isMandatory);
  if (mandatory.length === 0) {
    return; // no requirements seeded for this bucket
  }

  const decision: EligibilityDecision = decideEligibility(
    mandatory,
    conceptMastery,
    evaluatedAt
  );

  const existing = await dbStore.getCertificationByStudentClassLevel(
    student.id,
    classNumber,
    5
  );

  if (!existing) {
    if (decision.outcome === 'eligible') {
      const now = new Date().toISOString();
      await dbStore.addCertification({
        id: 'cert_' + randomUUID(),
        studentId: student.id,
        classNumber,
        level: 5,
        decisionSnapshot: decision,
        status: 'active',
        version: 1,
        issuedAt: now,
        certificateId: 'CERT-' + student.id + '-' + classNumber,
        createdAt: now,
        updatedAt: now,
      });
    }
    return;
  }

  // Revoked certs are terminal — the engine never re-evaluates them. If new
  // evaluation evidence arrives, log it for observability (a wrongful revoke
  // surfaces as a flurry of these entries) and exit. The cert itself is
  // preserved as the immutable audit record of the admin's decision.
  if (existing.status === 'revoked') {
    try {
      await dbStore.addLog({
        id: 'log_revoked_' + Date.now(),
        timestamp: new Date().toISOString(),
        schoolId: student.schoolId,
        schoolName: 'GPS',
        userId: 'system',
        userEmail: 'system@fln.org',
        userRole: UserRole.SUPERADMIN, // closest existing role; this is a system log
        activityType: 'verify',
        status: 'Success',
        details: `[certification] new evaluation evidence arrived for REVOKED cert ${existing.id} (student ${student.id}, class ${classNumber}, level 5); ignoring. Review admin override.`,
      });
    } catch (logErr) {
      console.error('[certification] revoked-cert log failed', logErr);
    }
    return;
  }

  // Cert exists. Re-evaluate against the new evidence.
  const now = new Date().toISOString();
  let nextStatus: CertificationStatus = existing.status;
  let reviewReason: string | undefined = existing.reviewReason;

  if (existing.status === 'active' && decision.outcome !== 'eligible') {
    // Post-certification data correction → review-flag, not silent un-cert.
    nextStatus = 'review_needed';
    reviewReason = summariseForReview(decision);
  } else if (existing.status === 'review_needed') {
    // Keep review_needed; the admin endpoint (POST /api/certification/review/:id)
    // resolves it. Refresh the reason so admins see the latest evidence.
    reviewReason = summariseForReview(decision);
  }
  // existing.status === 'active' && decision.outcome === 'eligible' → no-op.

  if (nextStatus !== existing.status || reviewReason !== existing.reviewReason) {
    const updated = await dbStore.updateCertification(existing.id, {
      decisionSnapshot: decision,
      status: nextStatus,
      version: existing.version + 1,
      reviewReason,
      updatedAt: now,
    });
    // Fire admin notification when a cert newly transitions into
    // `review_needed`. Fire-and-forget — never block on it.
    if (nextStatus === 'review_needed' && existing.status !== 'review_needed') {
      notifyCertificationReviewNeeded(updated, reviewReason ?? 'New evidence').catch((err) => {
        console.error('[cert-notify] notification failed:', err);
      });
    }
  }
}

/**
 * Public entrypoint used by the route handlers. Chains per-student so two
 * simultaneous worksheet submissions don't race on the same student's cert.
 * Never throws — failures are logged to stderr so the route handler's
 * response is unaffected.
 */
export function runCertificationEligibility(student: Student): void {
  const prev = inFlight.get(student.id) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(() =>
      runCertificationEligibilityForStudent(student).catch((err) => {
        console.error(
          `[certification] eligibility failed for student ${student.id}:`,
          err
        );
      })
    );
  inFlight.set(student.id, next);
  // Self-clean the map once the chain settles, so it doesn't grow forever.
  next.finally(() => {
    if (inFlight.get(student.id) === next) {
      inFlight.delete(student.id);
    }
  });
}

// --- Admin review resolution (SRS R-7, Phase 3) ---

export type ReviewDecision = 'confirm' | 'revoke';

export class CertificationReviewError extends Error {
  constructor(
    message: string,
    public readonly code: 'WRONG_STATE' | 'MISSING_REASON' | 'INVALID_DECISION',
    public readonly currentStatus?: CertificationStatus
  ) {
    super(message);
    this.name = 'CertificationReviewError';
  }
}

export interface Reviewer {
  id: string;
  email: string;
}

export interface ResolveResult {
  updated: Certification;
  logDetails: string;
}

/**
 * Pure: decide what a Certification row becomes after an admin review.
 *
 * Does NOT touch the database. The route handler applies the result via
 * dbStore.updateCertificationIfVersion (optimistic concurrency).
 *
 * Throws CertificationReviewError on:
 *   - decision not in {'confirm', 'revoke'} (INVALID_DECISION)
 *   - decision === 'revoke' with empty/whitespace reason (MISSING_REASON)
 *   - cert.status !== 'review_needed' (WRONG_STATE; currentStatus included)
 *
 * On confirm: clears reviewReason, sets status='active', stamps reviewedBy/
 * reviewedAt, bumps version. decisionSnapshot is preserved — it records
 * what the engine saw, not what the admin did.
 *
 * On revoke: overwrites reviewReason with the admin's trimmed reason,
 * sets status='revoked', stamps reviewedBy/reviewedAt, bumps version.
 * Same decisionSnapshot preservation.
 */
export function resolveCertificationReview(
  cert: Certification,
  decision: ReviewDecision,
  reviewer: Reviewer,
  reason?: string
): ResolveResult {
  if (decision !== 'confirm' && decision !== 'revoke') {
    throw new CertificationReviewError(
      `decision must be 'confirm' or 'revoke', got: ${String(decision)}`,
      'INVALID_DECISION'
    );
  }

  if (cert.status !== 'review_needed') {
    throw new CertificationReviewError(
      `cert is not in 'review_needed' state (current: '${cert.status}')`,
      'WRONG_STATE',
      cert.status
    );
  }

  const trimmedReason = reason?.trim();
  if (decision === 'revoke' && !trimmedReason) {
    throw new CertificationReviewError(
      "'reason' is required when decision is 'revoke'.",
      'MISSING_REASON'
    );
  }

  const now = new Date().toISOString();

  if (decision === 'confirm') {
    const updated: Certification = {
      ...cert,
      status: 'active',
      reviewReason: undefined,
      reviewedBy: reviewer.id,
      reviewedAt: now,
      version: cert.version + 1,
      updatedAt: now,
    };
    return {
      updated,
      logDetails: `Admin ${reviewer.email} confirmed certification ${cert.id} for student ${cert.studentId} (class ${cert.classNumber}, level ${cert.level})`,
    };
  }

  // decision === 'revoke'
  const updated: Certification = {
    ...cert,
    status: 'revoked',
    reviewReason: trimmedReason,
    reviewedBy: reviewer.id,
    reviewedAt: now,
    version: cert.version + 1,
    updatedAt: now,
  };
  return {
    updated,
    logDetails: `Admin ${reviewer.email} revoked certification ${cert.id} for student ${cert.studentId} (class ${cert.classNumber}, level ${cert.level}): ${trimmedReason}`,
  };
}

// --- Analytics stats helpers (SRS R-7, Phase 4) ---

export interface CountFilter {
  schoolId?: string;
  studentId?: string;
}

export interface SchoolStat {
  schoolId: string;
  name: string;
  certified: number;
  total: number;
  rate: number;
}

/**
 * Pure: count students with at least one active Certification, optionally
 * filtered by school or student. A student with multiple active cert rows
 * (e.g. one per class they passed) is counted once.
 *
 * Phase 4 decision: "ANY active cert = certified." Matches the closest
 * reading of today's `currentLevel >= 5` shortcut. Per-cohort counting
 * (e.g. certified for class 4 only) is future work.
 */
export function countActiveCertificationsFromMemory(
  students: Student[],
  certifications: Certification[],
  filter?: CountFilter
): number {
  const activeStudentIds = new Set<string>();
  for (const c of certifications) {
    if (c.status === 'active') activeStudentIds.add(c.studentId);
  }
  let count = 0;
  for (const s of students) {
    if (filter?.schoolId && s.schoolId !== filter.schoolId) continue;
    if (filter?.studentId && s.id !== filter.studentId) continue;
    if (activeStudentIds.has(s.id)) count++;
  }
  return count;
}

/**
 * Pure: build per-school {certified, total, rate} for analytics dashboards.
 * Rate is an integer percent (0-100), or 0 when total is 0.
 */
export function buildPerSchoolStats(
  students: Student[],
  certifications: Certification[],
  schools: School[]
): SchoolStat[] {
  const activeStudentIds = new Set<string>();
  for (const c of certifications) {
    if (c.status === 'active') activeStudentIds.add(c.studentId);
  }
  const studentsBySchool: Record<string, Student[]> = {};
  for (const s of students) {
    if (!studentsBySchool[s.schoolId]) studentsBySchool[s.schoolId] = [];
    studentsBySchool[s.schoolId].push(s);
  }
  return schools.map((sch) => {
    const roster = studentsBySchool[sch.id] || [];
    const certified = roster.filter((s) => activeStudentIds.has(s.id)).length;
    const total = roster.length;
    const rate = total > 0 ? Math.round((certified / total) * 100) : 0;
    return { schoolId: sch.id, name: sch.name, certified, total, rate };
  });
}