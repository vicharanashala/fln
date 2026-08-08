import { dbStore } from '../../db';
import { RemediationLedger } from '../../models/RemediationLedger.model';
import mongoose from 'mongoose';
import { ExamBlueprint } from '../../models/ExamBlueprint.model';
import { routerService } from './router.service';
import { IRemediationLedger, IGeneratedPracticeQuestion } from '../../interfaces/remediationLedger.interface';
import { randomUUID } from 'crypto';
import { generativeEngine } from './generativeEngine';
import { blueprintService } from './blueprintService';
import { blueprintEngine, detectConcept } from './blueprintEngine';
import { generateQuestionsForLevel } from '../../levelGenerator';
import { processPaper, processAllPapers, PaperInput, PaperOutput } from './paperBatchProcessor';

export class RemediationService {
  /**
   * Phase A: Immediately creates/updates the ledger as 'pending' and returns ledgerId.
   */
  private cleanForMongo(data: any) {
    return JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (key === "_id") return undefined;
        return value;
      })
    );
  }
  async startGeneration(studentId: string, examId: string, failedQuestionNums: number[], originalQuestions?: any[]): Promise<{ ledgerId: string; status: string }> {
    // Check if a ledger already exists for this student and exam
    let ledger: any = null;
    try {
      ledger = await RemediationLedger
        .findOne({ studentId, examId })
        .lean()
        .exec();
    } catch (err) {
      console.warn('Mongoose query failed, searching dbStore:', err);
    }

    if (!ledger) {
      const all = await dbStore.getRemediationLedgers();
      ledger = all.find(l => l.studentId === studentId && l.examId === examId) || null;
    }

    const ledgerId = ledger ? ledger.id : 'rem_' + randomUUID().substring(0, 8);
    const student = await this.findStudentName(studentId);

    // Build the responses list. For each failed question, we populate original details.
    const responses = await Promise.all(
      failedQuestionNums.map(async (qNo) => {
        let originalInfo: any = {};
        if (originalQuestions && Array.isArray(originalQuestions)) {
          const q = originalQuestions.find((x: any) =>
            x.questionNo === qNo ||
            x.questionNumber === qNo ||
            x.question_no === qNo
          ) || originalQuestions[qNo - 1] || originalQuestions[failedQuestionNums.indexOf(qNo)];

          if (q) {
            originalInfo = {
              questionText: q.question || q.questionText || q.originalQuestion,
              answer: typeof q.answer === 'object' ? JSON.stringify(q.answer) : String(q.answer ?? q.correctAnswer ?? ''),
              conceptName: q.topic || q.sectionName || q.conceptName,
              questionType: q.questionType || q.type || q.question_type_hint || 'standard',
              type: q.answer_type === 'number' ? 'numeric' : q.answer_type === 'choice' ? 'matrix' : 'generative'
            };
          }
        }

        if (!originalInfo.questionText) {
          originalInfo = await this.findOriginalQuestion(examId, qNo);
        }

        console.log("Original Question:", originalInfo.questionText, "| Type:", originalInfo.questionType || 'standard');
        return {
          questionNumber: qNo,
          conceptName: originalInfo.conceptName || `Concept for Q#${qNo}`,
          type: originalInfo.type || 'numeric',
          questionType: originalInfo.questionType || 'standard', // passed to generative engine
          originalQuestion: originalInfo.questionText || `Question text for Q#${qNo}`,
          originalAnswer: originalInfo.answer || '',
          studentAnswer: '',
          isCorrect: false,
          practiceQuestions: this.getInlineFallback(
            originalInfo.questionText || `Question text for Q#${qNo}`,
            originalInfo.conceptName || `Concept for Q#${qNo}`,
            originalInfo.questionType || 'standard',
            failedQuestionNums.indexOf(qNo) * 5
          ).map((b: any) => ({
            question: b.question,
            options: b.options,
            answer: b.answer || '',
            subQuestions: b.subQuestions,
            remediation: b.remediation,
            generatedAt: new Date(),
            aiGenerated: b.aiGenerated ?? false,
            needsReview: b.needsReview ?? false
          }))
        };
      })
    );


    const ledgerData: IRemediationLedger = {
      id: ledgerId,
      studentId,
      studentName: student || 'Unknown Student',
      examId,
      worksheetId: examId,
      score: 0, // Failed details are graded, total score reflects failed practice
      totalQuestions: failedQuestionNums.length,
      remediationStatus: 'pending',
      responses
    };

    const cleanLedgerData = JSON.parse(
      JSON.stringify(ledgerData)
    );
    console.log(
      "Ledger keys:",
      Object.keys(ledgerData)
    );
    for (const [key, value] of Object.entries(ledgerData)) {
      try {
        JSON.stringify(value);
      } catch {
        console.log("BAD BSON FIELD:", key, value);
      }
    }

    try {
      await RemediationLedger.findOneAndUpdate(
        { studentId, examId },
        {
          $set: cleanLedgerData
        },
        {
          upsert: true,
          returnDocument: "after"
        }
      ).exec();

    } catch (err: any) {
      console.warn(
        'Mongoose upsert failed, updating via dbStore:',
        err.message
      );
    }

    // Update in native/cached store
    const allLedgers = await dbStore.getRemediationLedgers();
    const idx = allLedgers.findIndex(l => l.studentId === studentId && l.examId === examId);
    if (idx !== -1) {
      allLedgers[idx] = ledgerData as any;
    } else {
      await dbStore.addRemediationLedger(
        this.cleanForMongo(ledgerData)
      );
    }

    // Trigger Phase B asynchronously in the background
    this.runBackgroundGeneration(ledgerId, studentId, examId, failedQuestionNums).catch((err) => {
      console.error(`💥 Unhandled background generation crash for ledger ${ledgerId}:`, err);
    });

    return { ledgerId, status: 'pending' };
  }

  /**
   * Phase B: Runs in background, flips status to 'generating', executes engines with uniqueness checks, then completes.
   */
  private async runBackgroundGeneration(ledgerId: string, studentId: string, examId: string, failedQuestionNums: number[]): Promise<void> {
    console.log(`[RemediationService] Starting background generation for ledger ${ledgerId}...`);

    // Flip to generating status
    try {
      await RemediationLedger.updateOne({ id: ledgerId }, { $set: { remediationStatus: 'generating' } }).exec();
      await dbStore.updateRemediationLedger(ledgerId, { remediationStatus: 'generating' });
    } catch (err) {
      console.error('Failed to update status to generating:', err);
    }

    try {
      // Fetch latest ledger
      let ledger: any = null;
      try {
        ledger = await RemediationLedger
          .findOne({ id: ledgerId })
          .lean()
          .exec();
      } catch { }
      if (!ledger) {
        const all = await dbStore.getRemediationLedgers();
        ledger = all.find(l => l.id === ledgerId) || null;
      }

      if (!ledger) {
        throw new Error(`Ledger ${ledgerId} not found in background loop`);
      }

      const responses = [...ledger.responses];

      const examHash = (examId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const setSeed = (examHash % 17) * 7;

      let qIdx = 0;
      for (const response of responses) {
        try {
          let origQ = response.originalQuestion || '';
          let concept = response.conceptName || 'Mathematics';
          const qType = response.questionType || 'standard';
          const baseOffset = (qIdx * 5) + setSeed;

          // If original question is missing or is just a placeholder like "Question text for Q#N",
          // look up the real question text from the exam paper
          const isMissingOrPlaceholder = !origQ ||
            /^Question text for Q#/i.test(origQ) ||
            /^Question #/i.test(origQ) ||
            /^Concept for Q#/i.test(origQ);

          if (isMissingOrPlaceholder) {
            const looked = await this.findOriginalQuestion(ledger.examId || ledger.worksheetId, response.questionNumber);
            if (looked.questionText) {
              origQ = looked.questionText;
              response.originalQuestion = origQ;
            }
            if (looked.conceptName) {
              concept = looked.conceptName;
              response.conceptName = concept;
            }
          }

          // If we still don't have the real question text after the lookup,
          // don't generate anything from it — that's exactly what used to
          // produce fabricated "Solve calculation: X + Y" style questions.
          // Flag it instead so it shows up for review rather than silently
          // shipping wrong content.
          const stillPlaceholder = !origQ ||
            /^Question text for Q#/i.test(origQ) ||
            /^Question #/i.test(origQ) ||
            /^Concept for Q#/i.test(origQ);

          if (stillPlaceholder) {
            console.warn(`[Remediation] No real question text found for Q#${response.questionNumber}, flagging for review instead of generating.`);
            response.practiceQuestions = Array.from({ length: 5 }, () => ({
              question: `Practice question for "${concept}" isn't available yet — the original question text wasn't found on the scanned paper.`,
              answer: '',
              generatedAt: new Date(),
              aiGenerated: false,
              needsReview: true
            }));
            response.type = 'generative';
            qIdx++;
            continue;
          }

          console.log(`[Remediation] Generating Q#${response.questionNumber}: "${origQ}" | concept=${concept} | type=${qType} | offset=${baseOffset}`);



          let batch: Array<{ question: string; answer?: string; subQuestions?: any[]; options?: string[]; aiGenerated?: boolean; needsReview?: boolean }> = [];

          try {
            batch = await generativeEngine.generateBatch(origQ, concept, qType, baseOffset);
          } catch (genErr: any) {
            console.warn(`[Remediation] generateBatch threw for Q#${response.questionNumber}:`, genErr.message);
          }

          // GUARANTEED FALLBACK: if batch is empty, use direct inline presets per type
          if (!batch || batch.length === 0) {
            console.warn(`[Remediation] Batch empty for Q#${response.questionNumber}, using inline fallback`);
            batch = this.getInlineFallback(origQ, concept, qType, baseOffset);
          }

          const practiceQuestions: IGeneratedPracticeQuestion[] = batch.map(b => ({
            question: b.question,
            options: (b as any).options,
            answer: b.answer || '',
            subQuestions: (b as any).subQuestions,
            generatedAt: new Date(),
            aiGenerated: b.aiGenerated ?? false,
            needsReview: b.needsReview ?? false
          }));

          response.practiceQuestions = practiceQuestions;
          response.type = 'generative';
          console.log(`[Remediation] ✅ Q#${response.questionNumber} → ${practiceQuestions.length} practice questions (offset ${baseOffset})`);
          qIdx++;
        } catch (qErr: any) {
          console.error(`[Remediation] ❌ Q#${response.questionNumber} failed:`, qErr.message);
          const baseOffset = qIdx * 5;
          response.practiceQuestions = this.getInlineFallback(
            response.originalQuestion || `Question #${response.questionNumber}`,
            response.conceptName || 'Mathematics',
            response.questionType || 'standard',
            baseOffset
          ).map(b => ({
            question: b.question,
            answer: b.answer,
            generatedAt: new Date(),
            aiGenerated: b.aiGenerated ?? false,
            needsReview: b.needsReview ?? false
          }));
          qIdx++;
        }
      }

      // Flip status to completed
      try {
        await RemediationLedger.updateOne({ id: ledgerId }, { $set: { remediationStatus: 'completed', responses } }).exec();
        await dbStore.updateRemediationLedger(
          ledgerId,
          {
            remediationStatus: 'completed',
            responses: this.cleanForMongo(responses)
          }
        );
        console.log(`[RemediationService] Completed background generation for ledger ${ledgerId}`);
      } catch (err) {
        console.error('Failed to complete ledger update:', err);
      }

    } catch (bgError: any) {
      console.error(`[RemediationService] Catastrophic failure in ledger ${ledgerId}:`, bgError.message);
      try {
        await RemediationLedger.updateOne({ id: ledgerId }, { $set: { remediationStatus: 'failed' } }).exec();
        await dbStore.updateRemediationLedger(ledgerId, { remediationStatus: 'failed' });
      } catch { }
    }
  }

  // Helper to find student name
  private async findStudentName(studentId: string): Promise<string> {
    try {
      const students = await dbStore.getStudents();
      const s = students.find(x => x.id === studentId);
      return s ? s.name : 'Unknown Student';
    } catch {
      return 'Unknown Student';
    }
  }

  private async findOriginalQuestion(examId: string, questionNumber: number): Promise<{
    questionText?: string;
    answer?: string;
    conceptName?: string;
    type?: 'numeric' | 'matrix' | 'generative';
    questionType?: string;
  }> {
    try {
      let resolvedExamId = examId;
      if (examId.startsWith('rem_')) {
        const ledgers = await dbStore.getRemediationLedgers();
        const ledger = ledgers.find(l => l.id === examId);
        if (ledger) {
          if (ledger.worksheetId) resolvedExamId = ledger.worksheetId;
          if (ledger.responses && Array.isArray(ledger.responses)) {
            const respItem = ledger.responses.find((r: any) => r.questionNumber === questionNumber) || ledger.responses[questionNumber - 1];
            if (respItem && respItem.originalQuestion && !respItem.originalQuestion.includes('Question text for Q#')) {
              return {
                questionText: respItem.originalQuestion,
                answer: (respItem as any).originalAnswer || (respItem as any).correctAnswer || '',
                conceptName: respItem.conceptName || 'Mathematics',
                questionType: (respItem as any).questionType || 'standard'
              };
            }
          }
        }
      }

      // 1. Look up saved paper blueprint
      let bp = blueprintService.getWorksheetBlueprint(resolvedExamId);
      if (!bp) {
        const allBps = (blueprintService as any).getAllBlueprints ? (blueprintService as any).getAllBlueprints() : [];
        bp = allBps.find((b: any) => b.worksheetId === resolvedExamId || resolvedExamId.includes(b.worksheetId) || b.worksheetId.includes(resolvedExamId));
      }

      if (bp && bp.items) {
        const item = bp.items.find(i => i.questionNumber === questionNumber) || bp.items[questionNumber - 1];
        if (item) {
          return {
            questionText: item.originalQuestion,
            answer: item.correctAnswer,
            conceptName: item.topic,
            questionType: item.questionType
          };
        }
      }

      // 2. Look up levelWorksheets in dbStore
      const levelWs = (await dbStore.getLevelWorksheets()) || [];
      const lws = levelWs.find(w => w.id === examId || examId.includes(w.id) || w.id.includes(examId)) ||
        levelWs.sort((a, b) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime())[0];

      if (lws && lws.answerKey?.items) {
        const item = lws.answerKey.items.find((i: any) =>
          i.questionNo === questionNumber ||
          i.questionNumber === questionNumber ||
          i.question_no === questionNumber
        ) || lws.answerKey.items[questionNumber - 1];

        const explicitText = item?.questionText || item?.question || item?.prompt || item?.text || item?.description || item?.title;
        if (item && explicitText) {
          return {
            questionText: explicitText,
            answer: typeof item.correctAnswer === 'object' ? JSON.stringify(item.correctAnswer) : String(item.correctAnswer ?? item.answer ?? ''),
            conceptName: item.sectionName || item.topic || 'Mathematics',
            questionType: item.questionType || item.type || 'standard'
          };
        }
      }

      // 3. Look up standard worksheets in dbStore
      const worksheets = (await dbStore.getWorksheets()) || [];
      const ws = worksheets.find(w => w.id === examId || examId.includes(w.id));
      if (ws && ws.questions && ws.questions[questionNumber - 1]) {
        const q = ws.questions[questionNumber - 1];
        return {
          questionText: q.question,
          answer: q.answer,
          conceptName: q.topic,
          questionType: q.questionType || q.answer_type || 'standard',
          type: q.answer_type === 'number' ? 'numeric' : q.answer_type === 'choice' ? 'matrix' : 'generative'
        };
      }

      // 4. Derive level from examId string (e.g. level_30_30.2_set1_...)
      const match = (examId || '').match(/level_?(\d+)/i);
      if (match) {
        const lvl = parseInt(match[1], 10);
        const derived = generateQuestionsForLevel(lvl, 0);
        if (derived && derived[questionNumber - 1]) {
          const dq = derived[questionNumber - 1];
          return {
            questionText: dq.question,
            answer: dq.answer,
            conceptName: dq.topic,
            questionType: dq.questionType || 'standard'
          };
        }
      }
    } catch (err) {
      console.warn(`[RemediationService] Could not lookup original question for ${examId} Q#${questionNumber}:`, err);
    }
    return {};
  }

  /**
   * GUARANTEED FALLBACK — never fails, never returns empty, runs in-process only.
   * Covers all 176 paper types with hardcoded presets matched to question text.
   */
  public getInlineFallback(
    originalQuestion: string,
    conceptName: string,
    questionType: string,
    baseOffset: number = 0
  ): Array<{ question: string; options?: string[]; answer?: string; subQuestions?: any[]; remediation?: string; aiGenerated?: boolean; needsReview?: boolean }> {
    const firstBp = blueprintEngine.generate(originalQuestion, conceptName, questionType, '', baseOffset);
    if (firstBp.subQuestions && Array.isArray(firstBp.subQuestions) && firstBp.subQuestions.length > 0) {
      return [{
        question: firstBp.question,
        options: firstBp.options,
        answer: firstBp.answer,
        subQuestions: firstBp.subQuestions,
        remediation: firstBp.remediation,
        aiGenerated: firstBp.aiGenerated,
        needsReview: firstBp.needsReview
      }];
    }

    return Array.from({ length: 5 }, (_, i) => {
      const bp = blueprintEngine.generate(originalQuestion, conceptName, questionType, '', baseOffset + i);
      return {
        question: bp.question,
        options: bp.options,
        answer: bp.answer,
        remediation: bp.remediation,
        aiGenerated: bp.aiGenerated,
        needsReview: bp.needsReview
      };
    });
  }

  /**
   * Automatic Full Database Migration: Refreshes ALL previous remediation ledgers in MongoDB and dbStore
   * ensuring 100% of previous practice questions are converted to topic-specific, human-readable questions.
   */
  public async migrateAllStaleLedgers(): Promise<void> {
    console.log('[RemediationService] Starting full database migration to refresh all previous remediation ledgers...');
    try {
      let mongoLedgers: any[] = [];
      if (mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          mongoLedgers = await RemediationLedger
            .find({})
            .lean()
            .exec();
        } catch (err: any) {
          console.warn('MongoDB ledger query warning:', err.message);
        }
      }

      const cachedLedgers = (await dbStore.getRemediationLedgers()) || [];
      const allLedgers = [...mongoLedgers, ...cachedLedgers];

      const processedIds = new Set<string>();

      for (const ledger of allLedgers) {
        if (!ledger || !ledger.id || processedIds.has(ledger.id)) continue;
        processedIds.add(ledger.id);

        let updated = false;
        let qIdx = 0;

        const responses = await Promise.all((ledger.responses || []).map(async (r: any) => {
          let origQ = r.originalQuestion || '';
          let concept = r.conceptName || 'Mathematics';
          const qType = r.questionType || 'standard';
          const baseOffset = qIdx * 5;
          qIdx++;

          // If original question is missing or placeholder, look it up from the paper
          const isMissingOrPlaceholder = !origQ ||
            /^Question text for Q#/i.test(origQ) ||
            /^Question #/i.test(origQ) ||
            /^Concept for Q#/i.test(origQ);

          if (isMissingOrPlaceholder) {
            try {
              const examId = ledger.examId || ledger.worksheetId || '';
              const looked = await this.findOriginalQuestion(examId, r.questionNumber);
              if (looked.questionText) origQ = looked.questionText;
              if (looked.conceptName) concept = looked.conceptName;
            } catch { }
          }

          const detectedConcept = detectConcept(origQ, r.conceptName || '');
          concept = (r.conceptName === 'Number Sense' && detectedConcept !== 'Number Sense')
            ? detectedConcept
            : (detectedConcept || r.conceptName || 'Mathematics');

          const conceptLower = concept.toLowerCase();
          const isSubtractionTopic = /subtra|minus|difference|diff|take away|change|paid|spent|left|remaining|fewer/i.test(conceptLower + ' ' + origQ);
          const isDivisionTopic = /divis|divide|quotient|sharing|grouping|equal groups/i.test(conceptLower + ' ' + origQ);
          const isMultiplyTopic = /multipl|times|product/i.test(conceptLower + ' ' + origQ);

          const pqs = r.practiceQuestions || [];
          const isMissingSubQuestions = pqs.length > 0 && !pqs[0]?.subQuestions;
          const hasDuplicateTitles = pqs.length > 1 && pqs[0]?.question === pqs[1]?.question;

          const isStale = !r.practiceQuestions || r.practiceQuestions.length === 0 || concept !== r.conceptName || isMissingSubQuestions || hasDuplicateTitles ||
            r.practiceQuestions.some((pq: any) => {
              const pqQ = pq.question || '';
              if (/Numeric practice for/i.test(pqQ)) return true;
              if (/Practice for/i.test(pqQ)) return true;
              if (/Practice #/i.test(pqQ)) return true;
              if (/Sample #/i.test(pqQ)) return true;
              if (/— Question \d+/i.test(pqQ)) return true;
              if (/— Item \d+/i.test(pqQ)) return true;
              if (/Solve calculation: \d+ \+ \d+/i.test(pqQ)) return true;
              if (/Solve the .+ calculation: \d+ \+ \d+/i.test(pqQ)) return true;
              if (/^Solve (subtraction|division|multiplication): /i.test(pqQ)) return true;
              if (/Based on the concept/i.test(pqQ)) return true;
              if (pqQ.includes('comparison-boxed-3col') || pqQ.includes('ordinal-circle-write') || pqQ.includes('measurement-mixed-mcq') || pqQ.includes('ruler-measure-objects') || pqQ.includes('write-position') || pqQ.includes('write position') || pqQ.includes('identify-position') || pqQ.includes('identify position')) return true;
              if (pqQ.trim() === concept.trim()) return true;
              if (pqQ === r.originalQuestion) return true;
              if (isSubtractionTopic && /\d+ \+ \d+/.test(pqQ)) return true;
              if (isDivisionTopic && /\d+ \+ \d+/.test(pqQ)) return true;
              if (isMultiplyTopic && /\d+ \+ \d+/.test(pqQ)) return true;
              if (/Clock showing \d{2}:/i.test(pqQ) || /Clock showing 2\d:/i.test(pqQ)) return true;
              if (/Read the time shown on each clock:\s*\d*/i.test(pqQ)) return true;
              if (conceptLower.includes('clock') || conceptLower.includes('time')) return true;
              return false;
            });

          if (isStale) {
            updated = true;
            return {
              ...r,
              originalQuestion: origQ,
              conceptName: concept,
              practiceQuestions: this.getInlineFallback(origQ, concept, qType, baseOffset)
                .map((b: any) => ({
                  question: b.question,
                  options: b.options,
                  answer: b.answer || '',
                  subQuestions: b.subQuestions,
                  remediation: b.remediation,
                  generatedAt: new Date(),
                  aiGenerated: b.aiGenerated ?? false,
                  needsReview: b.needsReview ?? false
                }))
            };
          }
          return r;
        }));

        if (updated) {
          console.log(`[RemediationMigration] Updated ledger ${ledger.id} with topic-specific human-readable questions.`);
          try {
            await RemediationLedger.updateOne({ id: ledger.id }, { $set: { responses } }).exec();
          } catch { }
          await dbStore.updateRemediationLedger(
            ledger.id,
            {
              responses: this.cleanForMongo(responses)
            }
          );
        }
      }
      console.log('[RemediationService] Full database migration completed successfully.');
    } catch (err: any) {
      console.error('[RemediationService] Migration error:', err.message);
    }
  }
}

export const remediationService = new RemediationService();
