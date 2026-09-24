import { Express } from 'express';
import { dbStore } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { remediationService } from '../services/remediation/remediation.service';
import { blueprintEngine, isUnderlinedPlaceValueQuestion, isUnderlinedPlaceValuePractice } from '../services/remediation/blueprintEngine';
import { formatRemediationSheetSimple, RemediationLedger } from '../utils/remediationFormatter';

export function registerRemediationRoutes(app: Express) {
  // POST /api/remediation/generate
  app.post('/api/remediation/generate', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { studentId, examId, failedQuestionIds, failedQuestionNums, originalQuestions, studentName } = req.body;

      const student = await dbStore.getStudentById(studentId);
      if (student && !canAccessStudent(user, student)) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this student.' });
      }

      // Support both the new string-ID array and the old numeric array (backward compat)
      const questionIds: string[] =
        Array.isArray(failedQuestionIds) && failedQuestionIds.length > 0
          ? failedQuestionIds.map(String)
          : Array.isArray(failedQuestionNums) && failedQuestionNums.length > 0
            ? failedQuestionNums.map(String)
            : [];

      if (!studentId || !examId || questionIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing studentId, examId, or failed question IDs.' });
      }

      const result = await remediationService.startGeneration(
        studentId,
        examId,
        questionIds,
        originalQuestions,
        typeof studentName === 'string' ? studentName : ''
      );
      res.status(202).json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/remediation/ledgers?studentId=XYZ
  app.get('/api/remediation/ledgers', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const studentId = req.query.studentId as string;
      if (!studentId) {
        return res.status(400).json({ success: false, error: 'studentId is required' });
      }

      const student = await dbStore.getStudentById(studentId);
      if (student && !canAccessStudent(user, student)) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this student.' });
      }

      const ledgers = await dbStore.getRemediationLedgersByStudent(studentId);
      res.status(200).json({ success: true, data: ledgers });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/remediation/ledgers/:ledgerId/generate — retry a failed/aborted ledger
  app.post('/api/remediation/ledgers/:ledgerId/generate', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { ledgerId } = req.params;
      if (!ledgerId) {
        return res.status(400).json({ success: false, error: 'ledgerId is required.' });
      }

      const ledger = await dbStore.getRemediationLedgerById(ledgerId);
      if (!ledger) {
        return res.status(404).json({ success: false, error: 'Remediation ledger not found.' });
      }

      const student = await dbStore.getStudentById(ledger.studentId);
      if (student && !canAccessStudent(user, student)) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this student.' });
      }

      const result = await remediationService.retryGeneration(ledgerId);
      res.status(202).json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/remediation/batch/:examId
  app.get('/api/remediation/batch/:examId', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { examId } = req.params;
      const all = await dbStore.getRemediationLedgersByExam(examId);
      const completed = all.filter(l => l.remediationStatus === 'completed');

      // Filter ledgers by caller's student access permissions
      const accessibleLedgers: any[] = [];
      for (const l of completed) {
        const student = await dbStore.getStudentById(l.studentId);
        if (!student || canAccessStudent(user, student)) {
          accessibleLedgers.push(l);
        }
      }

      if (accessibleLedgers.length === 0) {
        return res.status(404).json({ success: false, error: 'No completed ledgers found for this exam.' });
      }

      const sheets = accessibleLedgers.map(l => formatRemediationSheetSimple(l as unknown as RemediationLedger));
      res.status(200).json({ success: true, examId, count: accessibleLedgers.length, ledgers: accessibleLedgers, sheets });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/remediation/:studentId/:examId
  app.get('/api/remediation/:studentId/:examId', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { studentId, examId } = req.params;

      const student = await dbStore.getStudentById(studentId);
      if (student && !canAccessStudent(user, student)) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this student.' });
      }

      const ledger = await dbStore.getRemediationLedgerByStudentAndExam(studentId, examId);

      if (!ledger) {
        return res.status(404).json({ success: false, error: 'Remediation ledger not found for this student and exam.' });
      }

      // Auto-refresh stale/duplicate practice questions
      let needSave = false;
      if (ledger.remediationStatus !== 'generating' && ledger.remediationStatus !== 'pending') {
        for (const r of ledger.responses || []) {
          const pqs = (r as any).practiceQuestions || [];
          const isDuplicateFlat = pqs.length > 1 && pqs[0].question === pqs[1].question;

          const isUnderlinedMismatch =
            isUnderlinedPlaceValueQuestion((r as any).originalQuestion || '') &&
            !isUnderlinedPlaceValuePractice(pqs);

          const firstBp = blueprintEngine.generate(
            (r as any).originalQuestion,
            (r as any).conceptName,
            (r as any).questionType || 'standard'
          );
          const shouldHaveSub = !!(firstBp.subQuestions && Array.isArray(firstBp.subQuestions) && firstBp.subQuestions.length > 0);
          const hasSub = !!(pqs.length > 0 && pqs[0]?.subQuestions && Array.isArray(pqs[0].subQuestions));
          const isMissingSub = shouldHaveSub && !hasSub;

          if (isDuplicateFlat || isMissingSub || isUnderlinedMismatch || pqs.length === 0) {
            console.log(`[RemediationRoutes] Auto-refreshing stale practice questions for concept: ${(r as any).conceptName}`);
            (r as any).practiceQuestions = await remediationService.getInlineFallback(
              (r as any).originalQuestion,
              (r as any).conceptName,
              (r as any).questionType || 'standard',
              0,
              ledger.studentId,
              (r as any).originalAnswer || ''
            );
            needSave = true;
          }
        }
      }

      if (needSave) {
        await dbStore.updateRemediationLedger(ledger.id, { responses: ledger.responses });
      }

      const sheet = formatRemediationSheetSimple(ledger as unknown as RemediationLedger);
      res.status(200).json({ success: true, data: ledger, sheet });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

