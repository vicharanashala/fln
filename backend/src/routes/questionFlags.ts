// ---------------------------------------------------------------------------
// Question-level auto-flag & curriculum review queue (SRS R-15)
//
// "If 50%+ of students consistently fail an 'easy'-tagged question, the
// system flags it for core-team review."
//
// Endpoints:
//   GET    /api/question-flags          — list flagged questions (Superadmin)
//   POST   /api/question-flags/:id/review — Superadmin reviews (dismiss/revise/keep)
//   POST   /api/question-flags/detect   — backfill across all reports (Superadmin)
//
// Auto-flag detection also runs live inside POST /api/evaluation/submit
// (see evaluation.ts) after each evaluation report is saved.
// ---------------------------------------------------------------------------

import express from 'express';
import { dbStore, UserRole, QuestionBankEntry } from '../db';
import { getAuthUser } from '../auth';
import { validate } from '../middleware/validate';
import { questionFlagReviewSchema } from '../middleware/validate';
import {
  detectQuestionFlags,
  QUESTION_AUTOFLAG_THRESHOLD,
  QUESTION_AUTOFLAG_MIN_STUDENTS,
} from '../services/questionFlagService';

export function registerQuestionFlagRoutes(app: express.Express) {
  // ------------------------------------------------------------------
  // GET /api/question-flags — list flagged questions.
  // Superadmin only: curriculum revision is core-team controlled (SRS G5,
  // §13.2 R-16). Per SRS §4.2, the Superadmin owns curriculum and all
  // core pedagogical decisions; Admin does not have curriculum authority.
  // ------------------------------------------------------------------
  app.get('/api/question-flags', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin required.' });
    }

    const { items: questionBank } = await dbStore.getQuestionBank();

    const flagged = questionBank.filter(q => Boolean(q.questionFlag?.flagged));

    // Enrich with the latest aggregate stats so the reviewer sees
    // the current failure rate, not just the rate at flag time.
    const reports = await dbStore.getEvaluationReports();
    const worksheets = await dbStore.getWorksheets();
    const worksheetsById = new Map<string, any>();
    for (const w of worksheets) worksheetsById.set(w.id, w);

    const questionBankById = new Map<string, QuestionBankEntry>();
    for (const q of questionBank) questionBankById.set(q.questionId, q);

    const detection = detectQuestionFlags({
      reports,
      worksheetsById,
      questionBank: questionBankById,
      minStudents: QUESTION_AUTOFLAG_MIN_STUDENTS,
      threshold: QUESTION_AUTOFLAG_THRESHOLD,
    });

    // Build a live-stats map keyed by question_id.
    const liveStats = new Map(
      detection.flaggedQuestionIds.map(f => [f.questionId, f])
    );

    const enriched = flagged.map(q => {
      const flag = q.questionFlag!;
      const live = liveStats.get(q.questionId);
      return {
        questionId: q.questionId,
        questionText: q.questionText,
        level: q.level,
        levelTitle: q.levelTitle,
        section: q.section,
        conceptId: q.conceptId,
        mappedLevel: q.mappedLevel,
        reviewStatus: q.reviewStatus,
        flag,
        attemptingStudents: live?.attemptingStudents ?? 0,
        failingStudents: live?.failingStudents ?? 0,
        liveFailRate: live?.failRate ?? 0,
      };
    });

    // Most recently flagged first.
    enriched.sort((a, b) => {
      const af = a.flag?.flaggedAt || '';
      const bf = b.flag?.flaggedAt || '';
      return bf.localeCompare(af);
    });

    res.json({ success: true, count: enriched.length, questions: enriched });
  });

  // ------------------------------------------------------------------
  // POST /api/question-flags/:questionId/review — Superadmin reviews a
  // flagged question. Actions:
  //   'dismiss'  — clear flag, keep question as-is
  //   'revise'   — clear flag, mark question for curriculum revision
  //                (updates reviewStatus to 'mapped')
  //   'keep'     — leave flag active, acknowledge review
  //
  // Once a question has been reviewed (any action), it will not be
  // re-flagged automatically on subsequent detection runs.
  // ------------------------------------------------------------------
  app.post('/api/question-flags/:questionId/review', validate(questionFlagReviewSchema), async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin required.' });
    }

    const { questionId } = req.params;
    const { action, reviewNote } = req.body || {}; // 'dismiss' | 'revise' | 'keep'
    if (action !== 'dismiss' && action !== 'revise' && action !== 'keep') {
      return res.status(400).json({ error: "action must be 'dismiss', 'revise', or 'keep'." });
    }

    const question = await dbStore.getQuestionBankEntry(questionId);
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    if (!question.questionFlag?.flagged) {
      return res.status(400).json({ error: 'This question has no active flag.' });
    }

    const flagUpdates: Partial<QuestionBankEntry['questionFlag']> = {
      flagged: false,
      reviewed: true,
      reviewedBy: user.email,
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote ?? null,
    };

    let reviewStatusUpdate: 'untagged' | 'mapped' | 'retired' | undefined;

    if (action === 'dismiss') {
      flagUpdates.reviewAction = 'dismiss';
    } else if (action === 'revise') {
      flagUpdates.reviewAction = 'revise';
      reviewStatusUpdate = 'mapped'; // human has looked at it, needs curriculum work
    } else {
      // keep: flag stays active, just acknowledged as reviewed.
      flagUpdates.flagged = true;
      flagUpdates.reviewAction = 'keep';
    }

    // Persist flag state via the flag-specific update method.
    await dbStore.updateQuestionBankFlag(questionId, {
      ...question.questionFlag,
      ...flagUpdates,
    });

    // Also update reviewStatus if the action warrants it (revise).
    if (reviewStatusUpdate) {
      await dbStore.reviewQuestion(questionId, {
        reviewStatus: reviewStatusUpdate,
        reviewedBy: user.email,
        reviewNote: reviewNote ?? '',
      });
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: '',
      schoolName: 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'ticket',
      status: 'Success',
      details: `Reviewed question auto-flag for ${question.questionText ?? questionId}: action=${action}, note=${reviewNote ?? '(none)'}`,
    });

    const updatedQuestion = await dbStore.getQuestionBankEntry(questionId);
    res.json({ success: true, action, question: updatedQuestion });
  });

  // ------------------------------------------------------------------
  // POST /api/question-flags/detect — run auto-flag detection across all
  // evaluation reports. Superadmin only. Manual backfill/re-run for
  // historic reports; detection also runs live on every evaluation submit.
  //
  // Questions that have already been reviewed (dismissed, revised, or kept)
  // are not re-flagged automatically.
  // ------------------------------------------------------------------
  app.post('/api/question-flags/detect', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin required.' });
    }

    const reports = await dbStore.getEvaluationReports();
    const worksheets = await dbStore.getWorksheets();
    const { items: questionBank } = await dbStore.getQuestionBank();

    const worksheetsById = new Map<string, any>();
    for (const w of worksheets) worksheetsById.set(w.id, w);

    const questionBankById = new Map<string, QuestionBankEntry>();
    for (const q of questionBank) questionBankById.set(q.questionId, q);

    const detection = detectQuestionFlags({
      reports,
      worksheetsById,
      questionBank: questionBankById,
      minStudents: QUESTION_AUTOFLAG_MIN_STUDENTS,
      threshold: QUESTION_AUTOFLAG_THRESHOLD,
    });

    let flaggedPersisted = 0;
    let clearedPersisted = 0;

    for (const f of detection.flaggedQuestionIds) {
      const existing = questionBankById.get(f.questionId);
      const currentlyFlagged = Boolean(existing?.questionFlag?.flagged);
      const alreadyReviewed = Boolean(existing?.questionFlag?.reviewed);

      if (f.failRate >= QUESTION_AUTOFLAG_THRESHOLD && !currentlyFlagged) {
        // New (or re-)flag — only if not already flagged. A previously
        // reviewed/dismissed question can be re-flagged if new evidence
        // shows it is still failing (SRS R-15: "50%+ of students fail").
        await dbStore.updateQuestionBankFlag(f.questionId, {
          flagged: true,
          reason: f.reason,
          flaggedAt: new Date().toISOString(),
          flaggedBy: 'system (auto-flag)',
          reviewed: false,
        });
        flaggedPersisted++;
      } else if (
        f.failRate < QUESTION_AUTOFLAG_THRESHOLD &&
        currentlyFlagged &&
        !alreadyReviewed
      ) {
        // Auto-clear unreviewed flags when the question is no longer failing.
        await dbStore.updateQuestionBankFlag(f.questionId, {
          ...existing!.questionFlag,
          flagged: false,
        });
        clearedPersisted++;
      }
    }

    res.json({
      success: true,
      scanned: detection.scanned,
      flaggedCount: flaggedPersisted,
      clearedCount: clearedPersisted,
      candidates: detection.flaggedQuestionIds,
    });
  });
}
