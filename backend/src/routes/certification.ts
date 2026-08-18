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
 *     - Per-student view (with studentId): any role that passes canAccessStudent
 *     - status filter is optional; default returns all
 */
import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, Certification, CertificationStatus, UserRole, Student } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import {
  runCertificationEligibility,
  resolveCertificationReview,
  CertificationReviewError,
  ReviewDecision,
} from '../certificationRecords';

const ALLOWED_REVIEW_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN];
const QUEUE_VIEW_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN];
const VALID_STATUSES: CertificationStatus[] = ['active', 'review_needed', 'revoked'];

export function registerCertificationRoutes(app: express.Express) {
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
    if (!canAccessStudent(user, student)) {
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
      // Per-student view — any role with access to the student.
      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!canAccessStudent(user, student)) {
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
    const filtered = status ? all.filter(c => c.status === status) : all;
    res.json(filtered);
  });
}