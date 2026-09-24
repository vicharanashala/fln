import { dbStore } from '../../db';
import { routerService } from './router.service';
import { RemediationLedger } from '../../utils/remediationFormatter';
import { randomUUID } from 'crypto';
import { generativeEngine } from './generativeEngine';
import { blueprintService } from './blueprintService';
import { blueprintEngine, detectConcept, isUnderlinedPlaceValueQuestion, isUnderlinedPlaceValuePractice } from './blueprintEngine';
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

  async startGeneration(studentId: string, examId: string, failedQuestionIds: string[], originalQuestions?: any[], studentNameHint: string = ''): Promise<{ ledgerId: string; status: string }> {
    const existingLedger = await dbStore.getRemediationLedgerByStudentAndExam(studentId, examId);

    const isNew = !existingLedger;
    const ledgerId = existingLedger ? existingLedger.id : 'rem_' + randomUUID().substring(0, 8);
    const studentRecord = await dbStore.getStudentById(studentId);
    const student = studentRecord ? studentRecord.name : (studentNameHint || 'Unknown Student');

    const qByIdMap = new Map<string, any>();
    if (originalQuestions && Array.isArray(originalQuestions)) {
      originalQuestions.forEach((q: any) => {
        const key = String(q.id || q.questionId || q.question_id || '');
        if (key) qByIdMap.set(key, q);
      });
    }

    // Instantly map responses without any DB lookups (Phase B does the real DAK lookups)
    const responses = failedQuestionIds.map((qId, listIdx) => {
      let originalInfo: any = {};
      const q = qByIdMap.get(qId) || originalQuestions?.[listIdx];

      if (q) {
        const questionText = q.question || q.questionText || q.originalQuestion || '';
        const answerValue = typeof q.answer === 'object'
          ? JSON.stringify(q.answer)
          : String(q.answer ?? q.correctAnswer ?? '');
        const isNumber = answerValue.trim() !== '' && !isNaN(Number(answerValue));
        originalInfo = {
          questionText,
          answer: answerValue,
          studentAnswer: q.studentAnswer || '',
          conceptName: q.topic || q.sectionName || q.conceptName || q.concept || '',
          questionType: q.questionType || q.type || q.question_type_hint || 'standard',
          type: q.answer_type === 'number' || isNumber ? 'numeric' : q.answer_type === 'choice' ? 'matrix' : 'generative'
        };
      }

      return {
        questionNumber: typeof qId === 'number' ? qId : String(qId),
        conceptName: originalInfo.conceptName || `Concept for Q#${qId}`,
        type: originalInfo.type || 'numeric',
        questionType: originalInfo.questionType || 'standard',
        originalQuestion: originalInfo.questionText || `Question text for Q#${qId}`,
        originalAnswer: originalInfo.answer || '',
        studentAnswer: originalInfo.studentAnswer || '',
        isCorrect: false,
        practiceQuestions: [] // LEAVE EMPTY, to be filled in Phase B
      };
    });

    const ledgerData: any = {
      id: ledgerId,
      studentId,
      studentName: student || 'Unknown Student',
      examId,
      worksheetId: examId,
      score: 0,
      totalQuestions: failedQuestionIds.length,
      remediationStatus: 'generating',
      responses
    };

    if (isNew) {
      await dbStore.addRemediationLedger(this.cleanForMongo(ledgerData));
    } else {
      await dbStore.updateRemediationLedger(ledgerData.id, this.cleanForMongo(ledgerData));
    }

    // Trigger Phase B asynchronously in the background
    this.runBackgroundGeneration(ledgerId, studentId, examId, failedQuestionIds).catch((err) => {
      console.error(`Unhandled background generation crash for ledger ${ledgerId}:`, err);
    });

    return { ledgerId, status: 'generating' };
  }

  /**
   * Retry a failed/aborted ledger: re-flip it to 'pending' and re-run the
   * background generation loop using the ledger's stored failed questions.
   */
  public async retryGeneration(ledgerId: string): Promise<{ ledgerId: string; status: string }> {
    const ledger = await dbStore.getRemediationLedgerById(ledgerId);
    if (!ledger) {
      throw new Error(`Remediation ledger ${ledgerId} not found.`);
    }

    const failedQuestionNums = (ledger.responses || []).map((r: any) => r.questionNumber);
    await dbStore.updateRemediationLedger(ledgerId, { remediationStatus: 'pending' });

    this.runBackgroundGeneration(ledgerId, ledger.studentId, ledger.examId, failedQuestionNums).catch((err) => {
      console.error(`💥 Unhandled background generation crash for ledger ${ledgerId}:`, err);
    });

    return { ledgerId, status: 'pending' };
  }

  /**
   * Phase B: Runs in background, flips status to 'generating', executes engines with uniqueness checks, then completes.
   */
  private async runBackgroundGeneration(ledgerId: string, studentId: string, examId: string, failedQuestionNums: (number | string)[]): Promise<void> {
    console.log(`[RemediationService] Starting background generation for ledger ${ledgerId}...`);

    try {
      await dbStore.updateRemediationLedger(ledgerId, { remediationStatus: 'generating' });
    } catch (err) {
      console.error('Failed to update status to generating:', err);
    }

    try {
      const ledger: any = await dbStore.getRemediationLedgerById(ledgerId);
      if (!ledger) {
        throw new Error(`Ledger ${ledgerId} not found in background loop`);
      }

      const responses = [...ledger.responses];

      const examHash = (examId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const setSeed = (examHash % 17) * 7;

      // Resolve student class level ONCE outside the per-question loop
      let classLevel = 5;
      if (studentId) {
        try {
          const students = await dbStore.getStudentsByIds([studentId]);
          const s = students[0];
          if (s && s.classGroup) {
            const match = String(s.classGroup).match(/\d+/);
            if (match) classLevel = parseInt(match[0], 10);
          }
        } catch (err) {
          console.warn('[Remediation] Failed to resolve student classGroup:', err);
        }
      }

      // Generate all questions in PARALLEL
      await Promise.all(
        responses.map(async (response, qIdx) => {
          try {
            let origQ = response.originalQuestion || '';
            let concept = response.conceptName || 'Mathematics';
            const qType = response.questionType || 'standard';
            const baseOffset = (qIdx * 5) + setSeed;

            const isMissingOrPlaceholder = !origQ ||
              /^Question text for Q#/i.test(origQ) ||
              /^Question #/i.test(origQ) ||
              /^Diagnostic Question #/i.test(origQ) ||
              /^Concept for Q#/i.test(origQ) ||
              /^Question text for/i.test(origQ) ||
              /^\d+$/.test(origQ.trim()) ||
              /^\d+\s*\(position\s*\d+\)/.test(origQ.trim());

            if (isMissingOrPlaceholder) {
              const qIdStr = String(response.questionNumber);
              const looked = await this.findOriginalQuestionById(studentId, ledger.examId || ledger.worksheetId, qIdStr);
              if (looked.questionText) { origQ = looked.questionText; response.originalQuestion = origQ; }
              if (looked.conceptName) { concept = looked.conceptName; response.conceptName = concept; }
              if (!origQ) {
                const numId = parseInt(qIdStr, 10);
                if (!isNaN(numId) && numId > 0 && numId < 1000) {
                  const legacyLooked = await this.findOriginalQuestion(ledger.examId || ledger.worksheetId, numId);
                  if (legacyLooked.questionText) { origQ = legacyLooked.questionText; response.originalQuestion = origQ; }
                  if (legacyLooked.conceptName) { concept = legacyLooked.conceptName; response.conceptName = concept; }
                }
              }
            }

            const stillPlaceholder = (!origQ || /^Question text for Q#/i.test(origQ) || /^Question #/i.test(origQ)) && /^Concept for Q#/i.test(concept);

            if (stillPlaceholder) {
              console.warn(`[Remediation] No real question text or concept for Q#${response.questionNumber}, flagging for review.`);
              response.practiceQuestions = Array.from({ length: 5 }, () => ({
                question: `Practice question for "${concept}" isn't available yet.`,
                answer: '',
                generatedAt: new Date(),
                aiGenerated: false,
                needsReview: true
              }));
              response.type = 'generative';
              return;
            }

            let batch: Array<{ question: string; answer?: string; subQuestions?: any[]; options?: string[]; aiGenerated?: boolean; needsReview?: boolean }> = [];

            try {
              batch = await generativeEngine.generateBatch(origQ, concept, qType, baseOffset, classLevel);
            } catch (genErr: any) {
              console.warn(`[Remediation] generateBatch threw for Q#${response.questionNumber}:`, genErr.message);
            }

            if (!batch || batch.length === 0) {
              batch = await this.getInlineFallback(origQ, concept, qType, baseOffset, studentId, response.originalAnswer || '');
            }

            response.practiceQuestions = batch.map(b => ({
              question: b.question,
              options: (b as any).options,
              answer: b.answer || '',
              subQuestions: (b as any).subQuestions,
              remediation: (b as any).remediation,
              generatedAt: new Date(),
              aiGenerated: b.aiGenerated ?? false,
              needsReview: b.needsReview ?? false
            }));
            response.type = 'generative';
          } catch (qErr: any) {
            console.error('[Remediation] Failed to generate question:', response.questionNumber, qErr);
            throw qErr;
          }
        })
      );

      await dbStore.updateRemediationLedger(
        ledgerId,
        {
          remediationStatus: 'completed',
          responses: this.cleanForMongo(responses)
        }
      );
      console.log(`[RemediationService] Completed background generation for ledger ${ledgerId}`);

    } catch (bgError: any) {
      console.error(`[Remediation] Generation failed for ledger ${ledgerId}:`, bgError);
      try {
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

  /**
   * Section titles for each class level — derived from the HTML worksheet files.
   * These map section index (1-based) → human-readable section name.
   * Used to synthesize meaningful question text from Q_L{level}_{sec}_{item}[_b{blank}] IDs.
   */
  private static readonly SECTION_TITLES: Record<number, Record<number, string>> = {
    10: { // Class 1
      1: 'Number Recognition',
      2: 'Count and Write',
      3: 'Fill in Missing Numbers',
      4: 'Before and After',
      5: 'Addition',
      6: 'Subtraction',
      7: 'Greater or Smaller',
      8: 'Shapes',
      9: 'Patterns',
      10: 'Measurement'
    },
    20: { // Class 2
      1: 'Fill in Missing Numbers',
      2: 'Count the Objects',
      3: 'Before, After, Between',
      4: 'Compare Numbers',
      5: 'Size Ordering',
      6: 'Addition',
      7: 'Subtraction',
      8: 'Tens and Ones',
      9: 'Match Shapes',
      10: 'Complete the Pattern',
      11: 'Compare Objects'
    },
    30: { // Class 3
      1: 'Missing Numbers',
      2: 'Comparison',
      3: 'Shapes',
      4: 'Patterns',
      5: 'Addition',
      6: 'Subtraction',
      7: 'Heavier Object',
      8: 'Length Measurement',
      9: 'Write the Time',
      10: 'Money',
      11: 'Ascending Order',
      12: 'Descending Order',
      13: 'Calendar',
      14: 'Tens and Ones',
      15: 'Data Collection',
      16: 'Multiplication',
      17: 'Division'
    },
    40: { // Class 4
      1: 'Number Sequences',
      2: 'Place Value',
      3: 'Addition',
      4: 'Subtraction',
      5: 'Multiplication',
      6: 'Division',
      7: 'Fractions',
      8: 'Geometry',
      9: 'Measurement',
      10: 'Word Problems'
    }
  };

  /**
   * Parse a Q_L{level}_{sec}_{item}[_b{blank}] ID into its components.
   * Returns null if the ID doesn't match the expected format.
   */
  private parseQuestionId(questionId: string): { level: number; sec: number; item: number; blank?: number } | null {
    const m = questionId.match(/^Q_L(\d+)_(\d+)_(\d+)(?:_b(\d+))?$/);
    if (!m) return null;
    return {
      level: parseInt(m[1], 10),
      sec: parseInt(m[2], 10),
      item: parseInt(m[3], 10),
      blank: m[4] ? parseInt(m[4], 10) : undefined
    };
  }

  /**
   * Synthesize a human-readable question description from a parsed Q_L ID + answer.
   * Used when the question is a visual/rendered exercise with no text string.
   */
  private synthesizeQuestionText(
    questionId: string,
    topic: string,
    answer: string
  ): string {
    const parsed = this.parseQuestionId(questionId);
    if (!parsed) return topic ? `${topic} — Question ${questionId}` : `Question ${questionId}`;

    const sectionName = topic ||
      RemediationService.SECTION_TITLES[parsed.level]?.[parsed.sec] ||
      `Section ${parsed.sec}`;

    if (parsed.blank !== undefined) {
      return `${sectionName} — blank position ${parsed.blank}`;
    }
    return `${sectionName} — Item ${parsed.item}`;
  }

  /**
   * Look up a question by its string ID from the student's DiagnosticAnswerKey.
   */
  private async findOriginalQuestionById(studentId: string, examId: string, questionId: string): Promise<{
    questionText?: string;
    answer?: string;
    conceptName?: string;
    type?: 'numeric' | 'matrix' | 'generative';
    questionType?: string;
  }> {
    const buildResult = (q: any, answerValue: string) => {
      const isNumber = answerValue.trim() !== '' && !isNaN(Number(answerValue));
      const rawQuestion = String(q.question ?? '');
      const isRawNumber = /^\d+$/.test(rawQuestion.trim()) ||
        /^\d+\s*\(position\s*\d+\)/.test(rawQuestion.trim()) ||
        rawQuestion.trim() === '';
      const topic = q.topic || q.subtopic ||
        RemediationService.SECTION_TITLES[this.parseQuestionId(questionId)?.level ?? 0]?.[this.parseQuestionId(questionId)?.sec ?? 0] ||
        'Mathematics';

      const questionText = isRawNumber
        ? this.synthesizeQuestionText(questionId, topic, answerValue)
        : rawQuestion;

      return {
        questionText,
        answer: answerValue,
        conceptName: topic,
        questionType: q.answer_type || 'standard',
        type: (q.answer_type === 'number' || isNumber ? 'numeric' : q.answer_type === 'choice' ? 'matrix' : 'generative') as 'numeric' | 'matrix' | 'generative'
      };
    };

    try {
      // 1. Try the student's own DAK
      const dak = await dbStore.getStudentDiagnosticAnswerKey(studentId);
      if (dak && dak.questions) {
        const q = dak.questions.find((item: any) => item.question_id === questionId);
        if (q) {
          const answerValue = typeof q.answer === 'object' ? JSON.stringify(q.answer) : String(q.answer ?? '');
          return buildResult(q, answerValue);
        }
      }

      // 2. Try by examId as jobId
      if (examId && !examId.startsWith('rem_')) {
        const daksByJob = await dbStore.getDiagnosticAnswerKeys(examId);
        for (const d of daksByJob) {
          const q = (d.questions || []).find((item: any) => item.question_id === questionId);
          if (q) {
            const answerValue = typeof q.answer === 'object' ? JSON.stringify(q.answer) : String(q.answer ?? '');
            return buildResult(q, answerValue);
          }
        }
      }

      // 3. FALLBACK: Try finding the question in ANY Diagnostic Answer Key
      const anyQ = await dbStore.findQuestionInAnyDiagnosticAnswerKey(questionId);
      if (anyQ) {
        const answerValue = typeof anyQ.answer === 'object' ? JSON.stringify(anyQ.answer) : String(anyQ.answer ?? '');
        return buildResult(anyQ, answerValue);
      }

      // 4. No DAK entry found — synthesize purely from the ID if it's a Q_L format
      const parsed = this.parseQuestionId(questionId);
      if (parsed) {
        const sectionName =
          RemediationService.SECTION_TITLES[parsed.level]?.[parsed.sec] ||
          `Section ${parsed.sec}`;
        return {
          questionText: this.synthesizeQuestionText(questionId, sectionName, '?'),
          answer: '',
          conceptName: sectionName,
          questionType: 'standard',
          type: 'numeric'
        };
      }
    } catch (err) {
      console.warn(`[Remediation] DAK lookup failed for ${questionId}:`, err);
    }
    return {};
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
        const ledger = await dbStore.getRemediationLedgerById(examId);
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

      let lookupStudentId = '';
      if (resolvedExamId.startsWith('rem_')) {
        const ledger = await dbStore.getRemediationLedgerById(resolvedExamId);
        if (ledger) lookupStudentId = ledger.studentId;
      }
      if (!lookupStudentId && resolvedExamId !== 'diagnostic') {
        lookupStudentId = resolvedExamId;
      }
      if (lookupStudentId) {
        const dak = await dbStore.getStudentDiagnosticAnswerKey(lookupStudentId);
        if (dak && dak.questions) {
          const q = dak.questions.find(item => item.question_id === String(questionNumber) || (item as any).questionNumber === questionNumber) || dak.questions[questionNumber - 1];
          if (q) {
            return {
              questionText: q.question,
              answer: typeof q.answer === 'object' ? JSON.stringify(q.answer) : String(q.answer ?? ''),
              conceptName: q.topic || 'General',
              questionType: q.answer_type || 'standard'
            };
          }
        }
      }

      // Look up saved paper blueprint
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

      // Look up levelWorksheets in dbStore
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

      // Look up standard worksheets in dbStore
      const worksheets = (await dbStore.getWorksheets()) || [];
      const ws = worksheets.find(w => w.id === examId || examId.includes(w.id));
      if (ws && ws.questions && ws.questions[questionNumber - 1]) {
        const q = ws.questions[questionNumber - 1];
        return {
          questionText: q.question,
          answer: q.answer,
          conceptName: q.topic,
          questionType: q.answer_type || 'standard',
          type: q.answer_type === 'number' ? 'numeric' : q.answer_type === 'choice' ? 'matrix' : 'generative'
        };
      }

      // Derive level from examId string (e.g. level_30_30.2_set1_...)
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
            questionType: dq.answer_type || 'standard'
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
   */
  public async getInlineFallback(
    originalQuestion: string,
    conceptName: string,
    questionType: string,
    baseOffset: number = 0,
    studentId?: string,
    originalAnswer: string = ''
  ): Promise<Array<{ question: string; options?: string[]; answer?: string; subQuestions?: any[]; remediation?: string; aiGenerated?: boolean; needsReview?: boolean }>> {
    let classLevel = 5;
    if (studentId) {
      try {
        const students = await dbStore.getStudents();
        const s = students.find(x => x.id === studentId);
        if (s && s.classGroup) {
          const match = String(s.classGroup).match(/\d+/);
          if (match) classLevel = parseInt(match[0], 10);
        }
      } catch (err) {
        console.warn('[Remediation] Failed to lookup student classGroup for fallback:', err);
      }
    }

    const firstBp = blueprintEngine.generate(originalQuestion, conceptName, questionType, originalAnswer, baseOffset, classLevel);
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
      const bp = blueprintEngine.generate(originalQuestion, conceptName, questionType, originalAnswer, baseOffset + i, classLevel);
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
   * Automatic Full Database Migration: Refreshes ALL previous remediation ledgers
   * ensuring 100% of previous practice questions are converted to topic-specific, human-readable questions.
   */
  public async migrateAllStaleLedgers(): Promise<void> {
    console.log('[RemediationService] Starting full database migration to refresh all previous remediation ledgers...');
    try {
      const allLedgers = (await dbStore.getRemediationLedgers()) || [];
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

          const isUnderlinedMismatch =
            isUnderlinedPlaceValueQuestion(origQ) &&
            !isUnderlinedPlaceValuePractice(pqs);

          const isStale = !r.practiceQuestions || r.practiceQuestions.length === 0 || concept !== r.conceptName || isMissingSubQuestions || hasDuplicateTitles || isUnderlinedMismatch ||
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
            const practiceQsRaw = await this.getInlineFallback(origQ, concept, qType, baseOffset, ledger.studentId, r.originalAnswer || r.answer || '');
            return {
              ...r,
              originalQuestion: origQ,
              conceptName: concept,
              practiceQuestions: practiceQsRaw.map((b: any) => ({
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
          await dbStore.updateRemediationLedger(
            ledger.id,
            { responses: this.cleanForMongo(responses) }
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
