import express from 'express';
import { randomUUID } from 'crypto';
import { dbStore, UserRole, ScanSubmission, ScanSubmissionPageState, ScanProcessingStage, ExtractedResponse, ExtractedResponseBoundingBox, ExtractedResponseReviewState } from '../db';
import { getAuthUser } from '../auth';
import { persistExtractedResponses, ExtractedResponseInput } from '../services/scanExtraction';

// ===========================================================================
// OCR/ICR scan submissions & extracted responses (Issue #366)
//
// Tracks a scan submission through upload → quality check → rasterize →
// extract, and exposes the teacher review gate over the extracted responses
// (confirm, or correct with a separately-stored `correctedAnswer` that never
// overwrites the original OCR output).
//
// This is purely additive persistence. It does NOT change how evaluation
// scoring works, and it does NOT duplicate the per-question teacher override
// at /api/evaluation/:reportId/override — a scan that has been reviewed here
// can still flow through the existing evaluation lifecycle unchanged.
// ===========================================================================

const SCAN_STAGES: ScanProcessingStage[] = ['uploaded', 'quality_checked', 'rasterized', 'extracted', 'failed'];
const REVIEW_STATES: ExtractedResponseReviewState[] = ['pending', 'reviewed', 'corrected'];

type ScopedUser = {
  id: string;
  role: UserRole;
  schoolId?: string;
  assignedSchools?: string[];
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
};

/**
 * The set of school ids a user may operate on, or `null` for "all schools"
 * (superadmin). Mirrors the geo-scoping used by GET /api/students and
 * GET /api/evaluations (state -> district -> block) so scan data follows the
 * same school hierarchy as the rest of the app.
 */
async function accessibleSchoolIds(user: ScopedUser): Promise<Set<string> | null> {
  if (user.role === UserRole.SUPERADMIN) return null;
  if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
    return new Set(user.schoolId ? [user.schoolId] : []);
  }
  if (user.role === UserRole.VOLUNTEER) {
    return new Set(user.assignedSchools || []);
  }
  const schools = await dbStore.getSchools();
  const inScope = schools.filter(school => {
    if (user.role === UserRole.ADMIN) return school.stateCode === user.stateCode;
    if (user.role === UserRole.DISTRICT_ADMIN) return school.districtCode === user.districtCode;
    if (user.role === UserRole.BLOCK_ADMIN) return school.blockCode === user.blockCode;
    return false;
  });
  return new Set(inScope.map(s => s.id));
}

/** True when the user may create/read a submission attributed to `schoolId`. */
async function canAccessSchool(user: ScopedUser, schoolId: string): Promise<boolean> {
  const ids = await accessibleSchoolIds(user);
  return ids === null || ids.has(schoolId);
}

async function canAccessSubmission(user: ScopedUser, submission: ScanSubmission): Promise<boolean> {
  const isTopAdmin = user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN;
  // A submission with no school can only be touched by its uploader or a
  // top-level admin. This must not be keyed on the caller's own school scope.
  if (!submission.schoolId) return isTopAdmin || submission.uploaderId === user.id;
  return canAccessSchool(user, submission.schoolId);
}

export function registerScanSubmissionRoutes(app: express.Express) {

  // Create a scan submission. The school is resolved from the calling user
  // where known; admins may pass one explicitly.
  app.post('/api/scan-submissions', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { fileName, classId, studentId, pageCount } = req.body || {};
    const requestedSchoolId = req.body?.schoolId;
    let schoolId: string | undefined;
    if (requestedSchoolId !== undefined && requestedSchoolId !== null) {
      // A supplied school must be a real string the caller is authorized for.
      // Scoped users (teacher/volunteer/geo-admin) cannot file a submission
      // under an arbitrary school by passing its id.
      if (typeof requestedSchoolId !== 'string' || requestedSchoolId.trim() === '') {
        return res.status(400).json({ error: 'schoolId must be a non-empty string.' });
      }
      const candidate = requestedSchoolId.trim();
      if (!(await canAccessSchool(user, candidate))) {
        return res.status(403).json({ error: 'You are not authorized to create a submission for this school.' });
      }
      schoolId = candidate;
    } else if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      schoolId = user.schoolId;
    } else if (user.role === UserRole.VOLUNTEER) {
      schoolId = (user.assignedSchools || [])[0];
    }
    // Admin roles without an explicit school may create an unassigned
    // submission (e.g. a state-level bulk sample).

    const now = new Date().toISOString();
    const submission: ScanSubmission = {
      id: 'scan_' + randomUUID().slice(0, 8),
      schoolId,
      classId: classId || undefined,
      studentId: studentId || undefined,
      uploaderId: user.id,
      fileName: fileName || undefined,
      pageCount: Number.isInteger(pageCount) && pageCount > 0 ? pageCount : undefined,
      stage: 'uploaded',
      createdAt: now,
      updatedAt: now,
    };
    await dbStore.addScanSubmission(submission);
    res.json(submission);
  });

  // List scan submissions, scoped to the calling user's school hierarchy.
  app.get('/api/scan-submissions', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    let submissions = await dbStore.getScanSubmissions();

    // Scope to the caller's schools. `accessibleSchoolIds` returns null only
    // for superadmin (all schools). A school-less submission is NOT visible
    // merely because it lacks a school: scoped users see only their own
    // uploads; top-level admins keep the existing broad view.
    const accessible = await accessibleSchoolIds(user);
    if (accessible !== null) {
      const isTopAdmin = user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN;
      submissions = submissions.filter(s => {
        if (!s.schoolId) return isTopAdmin || s.uploaderId === user.id;
        return accessible.has(s.schoolId);
      });
    }

    res.json(submissions);
  });

  // Update a submission's processing state (stage, pages, quality, error).
  app.patch('/api/scan-submissions/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const submission = await dbStore.getScanSubmissionById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Scan submission not found.' });
    if (!(await canAccessSubmission(user, submission))) {
      return res.status(403).json({ error: 'You do not have access to this scan submission.' });
    }

    const { stage, pages, scanQuality, error, fileName, pageCount } = req.body || {};
    const updates: Partial<ScanSubmission> = { updatedAt: new Date().toISOString() };
    if (stage !== undefined) {
      if (!SCAN_STAGES.includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage. Allowed: ' + SCAN_STAGES.join(', ') });
      }
      updates.stage = stage;
    }
    if (pages !== undefined) {
      if (!Array.isArray(pages)) {
        return res.status(400).json({ error: 'pages must be an array.' });
      }
      const normalizedPages: ScanSubmissionPageState[] = [];
      for (const p of pages) {
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
          return res.status(400).json({ error: 'Each page must be an object.' });
        }
        const pageNumber = Number(p.pageNumber);
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
          return res.status(400).json({ error: 'Each page needs a 1-based integer pageNumber.' });
        }
        if (typeof p.rasterized !== 'boolean') {
          return res.status(400).json({ error: `Invalid rasterized for page ${pageNumber}: expected a boolean.` });
        }
        if (p.extractionStatus !== 'pending' && p.extractionStatus !== 'done' && p.extractionStatus !== 'error') {
          return res.status(400).json({ error: `Invalid extractionStatus for page ${pageNumber}: expected pending, done or error.` });
        }
        if (p.error !== undefined && typeof p.error !== 'string') {
          return res.status(400).json({ error: `Invalid error for page ${pageNumber}: expected a string.` });
        }
        normalizedPages.push({
          pageNumber,
          rasterized: p.rasterized,
          extractionStatus: p.extractionStatus,
          ...(typeof p.error === 'string' ? { error: p.error } : {}),
        });
      }
      updates.pages = normalizedPages;
    }
    if (scanQuality !== undefined) {
      const q = scanQuality as Record<string, any>;
      const valid =
        q !== null && typeof q === 'object' && !Array.isArray(q)
        && (q.status === 'pass' || q.status === 'warning' || q.status === 'reject')
        && q.checks !== null && typeof q.checks === 'object'
        && (q.checks.resolution === 'pass' || q.checks.resolution === 'fail')
        && (q.checks.orientation === 'pass' || q.checks.orientation === 'warning')
        && Array.isArray(q.reasons) && q.reasons.every((r: unknown) => typeof r === 'string')
        && typeof q.canOverride === 'boolean'
        && q.metrics !== null && typeof q.metrics === 'object' && !Array.isArray(q.metrics)
        && Number.isFinite(q.metrics.width) && Number.isFinite(q.metrics.height);
      if (!valid) {
        return res.status(400).json({
          error: 'Invalid scanQuality: expected { status, checks: { resolution, orientation }, reasons: string[], canOverride, metrics: { width, height } }.'
        });
      }
      updates.scanQuality = q as ScanSubmission['scanQuality'];
    }
    if (error !== undefined) {
      if (typeof error !== 'string') {
        return res.status(400).json({ error: 'error must be a string.' });
      }
      updates.error = error;
    }
    if (fileName !== undefined) {
      if (typeof fileName !== 'string') {
        return res.status(400).json({ error: 'fileName must be a string.' });
      }
      updates.fileName = fileName;
    }
    if (pageCount !== undefined) {
      if (!Number.isInteger(pageCount) || pageCount < 1) {
        return res.status(400).json({ error: 'pageCount must be a positive integer.' });
      }
      updates.pageCount = pageCount;
    }

    const updated = await dbStore.updateScanSubmission(submission.id, updates);
    res.json(updated || submission);
  });

  // Fetch a single submission and (optionally) its extracted responses.
  app.get('/api/scan-submissions/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const submission = await dbStore.getScanSubmissionById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Scan submission not found.' });
    if (!(await canAccessSubmission(user, submission))) {
      return res.status(403).json({ error: 'You do not have access to this scan submission.' });
    }

    const includeResponses = req.query.includeResponses === '1' || req.query.includeResponses === 'true';
    const responses = includeResponses
      ? await dbStore.getExtractedResponses({ scanSubmissionId: submission.id })
      : undefined;

    res.json({ ...submission, extractedResponses: responses });
  });

  // Persist extracted responses for a submission. See persistExtractedResponses
  // for the immutability semantics (never overwrite a reviewed/corrected row).
  app.post('/api/scan-submissions/:id/extracted-responses', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const submission = await dbStore.getScanSubmissionById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Scan submission not found.' });
    if (!(await canAccessSubmission(user, submission))) {
      return res.status(403).json({ error: 'You do not have access to this scan submission.' });
    }

    const { responses } = req.body || {};
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'responses must be a non-empty array.' });
    }

    const items: ExtractedResponseInput[] = [];
    for (const r of responses) {
      if (typeof r?.questionId !== 'string' || !r.questionId) {
        return res.status(400).json({ error: 'Each response needs a questionId.' });
      }
      const pageNumber = Number(r.pageNumber);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        return res.status(400).json({ error: `Invalid pageNumber for question ${r.questionId}: expected a 1-based integer.` });
      }
      if (typeof r.rawText !== 'string') {
        return res.status(400).json({ error: `Invalid rawText for question ${r.questionId}: expected a string.` });
      }
      const confidence = r.ocrConfidence;
      if (confidence !== undefined && confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
        return res.status(400).json({ error: `Invalid ocrConfidence for question ${r.questionId}: expected a number in [0,1] or null.` });
      }
      // Bounding box is optional and only carried when a caller actually has
      // one (e.g. joined from DiagnosticAnswerKey.answerRegions). When present,
      // every supplied edge must be a finite number.
      let boundingBox: ExtractedResponseBoundingBox | null = null;
      if (r.boundingBox && typeof r.boundingBox === 'object') {
        boundingBox = {};
        for (const key of ['x_mm', 'y_mm', 'w_mm', 'h_mm'] as const) {
          const value = r.boundingBox[key];
          if (value === undefined || value === null) continue;
          if (!Number.isFinite(value)) {
            return res.status(400).json({ error: `Invalid boundingBox.${key} for question ${r.questionId}: expected a finite number.` });
          }
          boundingBox[key] = value;
        }
      }
      items.push({
        questionId: r.questionId,
        pageNumber,
        rawText: r.rawText,
        ocrConfidence: confidence === undefined ? null : confidence,
        ocrProvider: typeof r.ocrProvider === 'string' && r.ocrProvider ? r.ocrProvider : undefined,
        boundingBox,
        studentId: typeof r.studentId === 'string' ? r.studentId : undefined,
      });
    }

    const outcome = await persistExtractedResponses(submission.id, items, submission.studentId);

    // Also advance the submission to 'extracted' if it hasn't already finished.
    if (submission.stage !== 'extracted' && submission.stage !== 'failed') {
      await dbStore.updateScanSubmission(submission.id, { stage: 'extracted', updatedAt: new Date().toISOString() });
    }

    res.json({ success: true, ...outcome });
  });

  // List extracted responses for a submission, with the review-gate filters.
  app.get('/api/scan-submissions/:id/extracted-responses', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const submission = await dbStore.getScanSubmissionById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Scan submission not found.' });
    if (!(await canAccessSubmission(user, submission))) {
      return res.status(403).json({ error: 'You do not have access to this scan submission.' });
    }

    const { reviewState, requiresReview, questionId } = req.query;
    const filter: { scanSubmissionId: string; reviewState?: ExtractedResponseReviewState; requiresReview?: boolean; questionId?: string } = { scanSubmissionId: submission.id };
    if (reviewState && REVIEW_STATES.includes(reviewState as ExtractedResponseReviewState)) filter.reviewState = reviewState as ExtractedResponseReviewState;
    if (requiresReview === 'true' || requiresReview === '1') filter.requiresReview = true;
    if (requiresReview === 'false' || requiresReview === '0') filter.requiresReview = false;
    if (questionId && typeof questionId === 'string') filter.questionId = questionId;

    const responses = await dbStore.getExtractedResponses(filter);
    res.json(responses);
  });

  // Teacher review gate (V0.1 Step 5): confirm a pending/ambiguous response,
  // or record a correction. Corrections NEVER touch rawText — they are stored
  // separately in correctedAnswer.
  app.post('/api/extracted-responses/:id/review', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const extracted = await dbStore.getExtractedResponseById(req.params.id);
    if (!extracted) return res.status(404).json({ error: 'Extracted response not found.' });

    const submission = await dbStore.getScanSubmissionById(extracted.scanSubmissionId);
    if (!submission) return res.status(404).json({ error: 'Parent scan submission not found.' });
    if (!(await canAccessSubmission(user, submission))) {
      return res.status(403).json({ error: 'You do not have access to this extracted response.' });
    }

    const { action, correctedAnswer } = req.body || {};
    if (action !== 'confirm' && action !== 'correct') {
      return res.status(400).json({ error: 'action must be "confirm" or "correct".' });
    }

    const now = new Date().toISOString();
    let updates: Partial<ExtractedResponse>;
    if (action === 'correct') {
      // A correction keeps the original rawText intact and records the
      // teacher's interpretation separately.
      if (typeof correctedAnswer !== 'string' || correctedAnswer.trim() === '') {
        return res.status(400).json({ error: 'correctedAnswer is required for action "correct".' });
      }
      updates = { reviewState: 'corrected', correctedAnswer, reviewedBy: user.id, reviewedAt: now, updatedAt: now };
    } else {
      if (correctedAnswer !== undefined && correctedAnswer !== null && correctedAnswer !== '') {
        return res.status(400).json({ error: 'action "confirm" must not include correctedAnswer — use "correct" instead.' });
      }
      if (extracted.reviewState === 'corrected') {
        return res.status(409).json({ error: 'This response already has a correction. Use action "correct" to change it.' });
      }
      // Confirming accepts the original OCR output as-is.
      updates = { reviewState: 'reviewed', reviewedBy: user.id, reviewedAt: now, updatedAt: now };
    }

    const updated = await dbStore.updateExtractedResponse(extracted.id, updates);
    res.json(updated || extracted);
  });
}