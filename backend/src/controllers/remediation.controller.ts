import { Request, Response } from 'express';
import { dbStore } from '../db';
import { RemediationLedger } from '../models/RemediationLedger.model';
import { remediationService } from '../services/remediation/remediation.service';
import { IRemediationLedger } from '../interfaces/remediationLedger.interface';
import { formatRemediationSheetSimple } from '../utils/remediaitionFormatter';
import { blueprintEngine } from '../services/remediation/blueprintEngine';

export class RemediationController {
  // POST /api/remediation/generate
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const { studentId, examId, failedQuestionNums, originalQuestions } = req.body;

      if (!studentId || !examId || !Array.isArray(failedQuestionNums)) {
        res.status(400).json({ success: false, error: 'Missing studentId, examId, or failedQuestionNums array.' });
        return;
      }

      if (failedQuestionNums.length === 0) {
        res.status(400).json({ success: false, error: 'failedQuestionNums array cannot be empty.' });
        return;
      }

      const result = await remediationService.startGeneration(
        studentId,
        examId,
        failedQuestionNums,
        originalQuestions
      );
      res.status(202).json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/remediation/:studentId/:examId
  async getLedgerByStudentAndExam(req: Request, res: Response): Promise<void> {
    try {
      const { studentId, examId } = req.params;

      let ledger: IRemediationLedger | null = null;
      try {
        ledger = await RemediationLedger.findOne({ studentId, examId }).exec();
      } catch (err) {
        console.warn('Mongoose query failed, searching dbStore:', err);
      }

      if (!ledger) {
        const all = await dbStore.getRemediationLedgers();
        ledger = all.find(l => l.studentId === studentId && l.examId === examId) || null;
      }

      // If no ledger exists yet for this student and exam, auto-start generation and fetch created record
      if (!ledger) {
        console.log(`[RemediationController] Ledger not found for student=${studentId}, exam=${examId}. Auto-triggering generation...`);
        await remediationService.startGeneration(studentId, examId, [1, 2, 3, 4, 5]);
        
        try {
          ledger = await RemediationLedger.findOne({ studentId, examId }).exec();
        } catch { }
        if (!ledger) {
          const all = await dbStore.getRemediationLedgers();
          ledger = all.find(l => l.studentId === studentId && l.examId === examId) || null;
        }
      }

      if (!ledger) {
        res.status(404).json({ success: false, error: 'Remediation ledger not found for this student and exam.' });
        return;
      }

      // Auto-refresh stale/duplicate responses in ledger
      let needSave = false;
      for (const r of ledger.responses || []) {
        const pqs = r.practiceQuestions || [];
        const isDuplicateFlat = pqs.length > 1 && pqs[0].question === pqs[1].question;
        
        // Only consider missing subQuestions if the concept generator actually produces them
        const firstBp = blueprintEngine.generate(r.originalQuestion, r.conceptName, r.questionType || 'standard');
        const shouldHaveSub = !!(firstBp.subQuestions && Array.isArray(firstBp.subQuestions) && firstBp.subQuestions.length > 0);
        const hasSub = !!(pqs.length > 0 && pqs[0]?.subQuestions && Array.isArray(pqs[0].subQuestions));
        const isMissingSub = shouldHaveSub && !hasSub;
        
        if (isDuplicateFlat || isMissingSub || pqs.length === 0) {
          console.log(`[RemediationController] Auto-refreshing stale practice questions for concept: ${r.conceptName}`);
          r.practiceQuestions = remediationService.getInlineFallback(r.originalQuestion, r.conceptName, r.questionType || 'standard') as any;
          needSave = true;
        }
      }

      if (needSave) {
        try {
          await RemediationLedger.updateOne({ id: ledger.id }, { $set: { responses: ledger.responses } }).exec();
        } catch { }
        await dbStore.updateRemediationLedger(ledger.id, { responses: ledger.responses });
      }

      // Send formatted sheet along with JSON data response
      const sheet = formatRemediationSheetSimple(ledger);
      res.status(200).json({ success: true, data: ledger, sheet });

    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/remediation/batch/:examId
  async getBatchLedgers(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;

      let ledgers: IRemediationLedger[] = [];
      try {
        ledgers = await RemediationLedger.find({ examId, remediationStatus: 'completed' }).exec();
      } catch (err) {
        console.warn('Mongoose query failed, searching dbStore:', err);
        const all = await dbStore.getRemediationLedgers();
        ledgers = all.filter(l => l.examId === examId && l.remediationStatus === 'completed');
      }

      if (ledgers.length === 0) {
        res.status(404).json({ success: false, error: 'No completed ledgers found for this exam.' });
        return;
      }

      // Format each ledger
      const sheets = ledgers.map(l => formatRemediationSheetSimple(l));

      // ✅ Return JSON + formatted text
      res.status(200).json({
        success: true,
        examId,
        count: ledgers.length,
        ledgers,
        sheets // array of formatted strings
      });

    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }


  // GET /api/remediation/ledgers?studentId=XYZ
  async getLedgersForStudent(req: Request, res: Response): Promise<void> {
    try {
      const studentId = req.query.studentId as string;
      if (!studentId) {
        res.status(400).json({ success: false, error: 'studentId is required' });
        return;
      }

      let ledgers: IRemediationLedger[] = [];
      try {
        ledgers = await RemediationLedger.find({ studentId }).exec();
      } catch (err) {
        console.warn('Mongoose query failed, searching dbStore:', err);
        const all = await dbStore.getRemediationLedgers();
        ledgers = all.filter(l => l.studentId === studentId);
      }

      res.status(200).json({ success: true, data: ledgers });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const remediationController = new RemediationController();
