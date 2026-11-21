/**
 * SRS R-7 — Certification Engine routes.
 *
 *   POST /api/certification/review/:certificationId
 *     - Body: { decision: 'confirm' | 'revoke', reason?: string }
 *     - Allowed roles: SUPERADMIN, ADMIN
 *     - Cert must be in 'review_needed' state
 *     - Revoke requires a non-empty reason
 *     - Optimistic concurrency on (id, version) — 409 on race
 *     - IDOR guard via canAccessStudent
 *
 *   GET /api/certifications?status=&studentId=
 *     - Queue view (no studentId): SUPERADMIN, ADMIN
 *     - Per-student view (with studentId): teachers/volunteers who pass canAccessStudent
 *     - status filter is optional; default returns all
 */
import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, Certification, CertificationStatus, UserRole, Student } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { CURRICULUM_MAPPING } from '../config/curriculumMap';
import { getCompetencyForConcept } from '../config/ncfCompetencies';
import {
  runCertificationEligibility,
  resolveCertificationReview,
  CertificationReviewError,
  ReviewDecision,
} from '../services/certificationRecords';

const ALLOWED_REVIEW_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN];
const QUEUE_VIEW_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN];
const CERTIFICATE_VIEW_ROLES = [UserRole.TEACHER, UserRole.VOLUNTEER];
const VALID_STATUSES: CertificationStatus[] = ['active', 'review_needed', 'revoked'];

// Core concepts from the issue #836 requirements table. Balvatika's six
// concepts are confirmed there; Class 1–3 entries are explicitly interim
// assignments pending curriculum-lead confirmation.
const CORE_CONCEPT_IDS_BY_CLASS: Record<number, Set<string>> = {
  0: new Set(['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.7']),
  1: new Set(['S4.3', 'S4.4', 'S4.6', 'S4.7', 'S4.8', 'S4.9', 'S4.10']),
  2: new Set(['S5.1', 'S5.4', 'S5.5', 'S5.6', 'S5.7', 'S5.8', 'S5.11', 'S5.12']),
  3: new Set(['S6.4', 'S6.5', 'S6.6', 'S6.7', 'S6.8', 'S6.9', 'S6.10', 'S6.12', 'S6.13']),
};

export function canViewStudentCertificate(role: UserRole): boolean {
  return CERTIFICATE_VIEW_ROLES.includes(role);
}

export function registerCertificationRoutes(app: express.Express) {
  // Public curriculum metadata for the certificate renderer. Student records
  // remain protected by the per-student certifications route below.
  app.get('/api/certification/concepts', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canViewStudentCertificate(user.role)) {
      return res.status(403).json({ error: 'Forbidden: certificate access is limited to teachers and volunteers.' });
    }

    const rawClassNumber = req.query.classNumber;
    const classNumber = typeof rawClassNumber === 'string' ? Number(rawClassNumber) : NaN;
    if (!Number.isInteger(classNumber) || ![0, 1, 2, 3].includes(classNumber)) {
      return res.status(400).json({ error: 'classNumber must be 0 (Balvatika) or 1, 2, or 3.' });
    }

    const stage = classNumber + 3;
    const concepts = Object.values(CURRICULUM_MAPPING)
      .filter((concept) => concept.stage === stage)
      .map((concept) => ({
        id: concept.conceptId,
        title: concept.levelTitle,
        competency: getCompetencyForConcept(concept.conceptId) ?? null,
        core: CORE_CONCEPT_IDS_BY_CLASS[classNumber].has(concept.conceptId),
      }));

    return res.json(concepts);
  });

  // Admins resolve a 'review_needed' cert to either 'active' (confirm) or 'revoked'.
  app.post('/api/certification/review/:certificationId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!ALLOWED_REVIEW_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { decision, reason } = req.body || {};
    if (decision !== 'confirm' && decision !== 'revoke') {
      return res.status(400).json({ error: "decision must be 'confirm' or 'revoke'." });
    }
    if (decision === 'revoke' && (!reason || !String(reason).trim())) {
      return res.status(400).json({ error: "'reason' is required when decision is 'revoke'." });
    }

    const cert = await dbStore.getCertificationById(req.params.certificationId);
    if (!cert) return res.status(404).json({ error: 'Certification not found.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === cert.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found for certification.' });
    if (!(await canAccessStudent(user, student))) {
      return res.status(403).json({ error: 'Forbidden: student outside your scope.' });
    }

    let result;
    try {
      result = resolveCertificationReview(
        cert,
        decision as ReviewDecision,
        { id: user.id, email: user.email },
        reason
      );
    } catch (err) {
      if (err instanceof CertificationReviewError) {
        if (err.code === 'WRONG_STATE') {
          return res.status(409).json({
            error: `Certification is not in 'review_needed' state (current: '${err.currentStatus}').`,
          });
        }
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    // Optimistic concurrency: only apply if version matches.
    const updated = await dbStore.updateCertificationIfVersion(
      cert.id,
      cert.version,
      {
        status: result.updated.status,
        reviewReason: result.updated.reviewReason,
        reviewedBy: result.updated.reviewedBy,
        reviewedAt: result.updated.reviewedAt,
        updatedAt: result.updated.updatedAt,
      }
    );
    if (!updated) {
      return res.status(409).json({
        error: 'Concurrent modification: another admin acted on this certification. Please refresh and retry.',
      });
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: student.schoolId,
      schoolName: '',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: result.logDetails,
    });

    res.json({ success: true, certification: updated });
  });

  // List Certifications (queue view for admins; per-student view for others).
  app.get('/api/certifications', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;

    let status: CertificationStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as CertificationStatus)) {
        return res.status(400).json({
          error: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
        });
      }
      status = statusParam as CertificationStatus;
    }

    if (studentId) {
      // Certificate views are limited to the roles exposed by CertificatesPanel.
      // School/principal and administrative roles must not gain access merely
      // because canAccessStudent would otherwise permit a profile lookup.
      if (!canViewStudentCertificate(user.role)) {
        return res.status(403).json({ error: 'Forbidden: certificate access is limited to teachers and volunteers.' });
      }

      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!(await canAccessStudent(user, student))) {
        return res.status(403).json({ error: 'Forbidden: student outside your scope.' });
      }
      const all = await dbStore.getCertifications();
      const filtered = all.filter(c => c.studentId === studentId && (!status || c.status === status));
      return res.json(filtered);
    }

    // Queue view — admins only.
    if (!QUEUE_VIEW_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient privileges for queue view.' });
    }
    const all = await dbStore.getCertifications();
    let filtered = status ? all.filter(c => c.status === status) : all;
    // A state admin only sees certifications of students inside their own area.
    if (user.role !== UserRole.SUPERADMIN) {
      const students = await dbStore.getStudentsByIds([...new Set(filtered.map(c => c.studentId))]);
      const byId = new Map(students.map(s => [s.id, s]));
      const stateSchoolIds = user.role === UserRole.ADMIN
  ? new Set(user.stateCode
      ? (await dbStore.getSchools()).filter(s => s.stateCode === user.stateCode).map(s => s.id)
      : [])
  : undefined;
      const allowed = await Promise.all(
  filtered.map(async c => {
    const st = byId.get(c.studentId);
    return !!st
      && await canAccessStudent(user, st)
      && (!stateSchoolIds || stateSchoolIds.has(st.schoolId));
  })
);
filtered = filtered.filter((_, i) => allowed[i]);
    }
    res.json(filtered);
  });
}