import { dbStore, Ticket, UserRole, Question, AnswerSubmission, Worksheet, AutoFlagDetails } from '../db';

export interface AutoFlagScanOptions {
  minAttempts?: number;
  failureThreshold?: number; // 0.50 for 50% on easy
  mediumFailureThreshold?: number; // 0.70 for 70% on medium
  worksheetId?: string;
  reopenResolved?: boolean;
}

export interface AutoFlagSummary {
  totalFlagged: number;
  openFlags: number;
  reviewedFlags: number;
  resolvedFlags: number;
  criticalFlagsCount: number; // >= 70% fail rate
  easyFlagsCount: number;
  mediumFlagsCount: number;
  averageFailureRate: number;
  flags: Ticket[];
  lastScanAt: string;
}

/**
 * Normalizes answer comparison for string/number tolerance
 */
function isAnswerCorrect(submitted: any, expected: any): boolean {
  if (submitted === undefined || submitted === null) return false;
  const sStr = String(submitted).trim().toLowerCase();
  const eStr = String(expected).trim().toLowerCase();
  if (!sStr) return false;
  if (sStr === eStr) return true;

  // Strict numeric equivalence (e.g. "05" == "5", "5.0" == "5"), rejecting partial string prefixes like "5abc"
  const isStrictNum = (s: string) => /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s);
  if (isStrictNum(sStr) && isStrictNum(eStr)) {
    const sNum = Number(sStr);
    const eNum = Number(eStr);
    if (!isNaN(sNum) && !isNaN(eNum) && sNum === eNum) {
      return true;
    }
  }

  return false;
}

function getCanonicalQuestionKey(qId: string): string {
  if (!qId) return qId;
  const match = qId.match(/^(?:st_[a-zA-Z0-9_-]+|s\d+)_(q\d+|[A-Z0-9_-]+)$/i);
  return match ? match[1] : qId;
}

export class AutoFlagService {
  /**
   * Scans submissions and worksheets to detect easy (>=50%) and medium (>=70%) questions failing pedagogical thresholds (SRS Rule R-15 & §6.7)
   */
  async checkAndFlagQuestions(options: AutoFlagScanOptions = {}): Promise<{ created: Ticket[]; updated: Ticket[]; allFlags: Ticket[] }> {
    const minAttempts = options.minAttempts !== undefined ? options.minAttempts : 3;
    const easyThreshold = options.failureThreshold !== undefined ? options.failureThreshold : 0.50; // 50% failure for easy
    const mediumThreshold = options.mediumFailureThreshold !== undefined ? options.mediumFailureThreshold : 0.70; // 70% failure for medium

    const submissions = await dbStore.getAnswerSubmissions();
    const worksheets = await dbStore.getWorksheets();
    const existingTickets = await dbStore.getTickets();

    // Map questions by identifier
    interface QuestionStats {
      question: Question;
      attempts: number;
      failures: number;
      schools: Set<string>;
      worksheetIds: Set<string>;
      studentOutcomes: Map<string, boolean>; // studentId/name -> isCorrect
    }

    const statsMap = new Map<string, QuestionStats>();

    // 1. Index all questions available in worksheets
    for (const ws of worksheets) {
      if (options.worksheetId && ws.id !== options.worksheetId) continue;
      if (!ws.questions || !Array.isArray(ws.questions)) continue;

      for (const q of ws.questions) {
        if (!q.question_id) continue;
        const qKey = getCanonicalQuestionKey(q.question_id);
        if (!statsMap.has(qKey)) {
          statsMap.set(qKey, {
            question: q,
            attempts: 0,
            failures: 0,
            schools: new Set<string>(),
            worksheetIds: new Set<string>(),
            studentOutcomes: new Map<string, boolean>()
          });
        }
      }
    }

    // 2. Aggregate all student submissions against question expectations
    for (const sub of submissions) {
      if (options.worksheetId && sub.worksheetId !== options.worksheetId) continue;
      if (!sub.answers || typeof sub.answers !== 'object') continue;

      // Find matching worksheet if available
      const matchingWs = worksheets.find(w => w.id === sub.worksheetId);
      const wsQuestions = matchingWs?.questions || [];

      for (const [qId, submittedAnswer] of Object.entries(sub.answers)) {
        const canonicalKey = getCanonicalQuestionKey(qId);
        let entry = statsMap.get(canonicalKey) || statsMap.get(qId);

        // If question wasn't indexed from worksheet, check if question object exists in matchingWs or sub.questions
        if (!entry) {
          const qObj = wsQuestions.find(q => q.question_id === qId || getCanonicalQuestionKey(q.question_id) === canonicalKey) ||
            (sub.questions && sub.questions.find((q: Question) => q.question_id === qId || getCanonicalQuestionKey(q.question_id) === canonicalKey));
          if (qObj) {
            entry = {
              question: qObj,
              attempts: 0,
              failures: 0,
              schools: new Set<string>(),
              worksheetIds: new Set<string>(),
              studentOutcomes: new Map<string, boolean>()
            };
            statsMap.set(canonicalKey, entry);
          }
        }

        if (entry) {
          if (sub.schoolId) entry.schools.add(sub.schoolId);
          if (sub.worksheetId) entry.worksheetIds.add(sub.worksheetId);

          // Find specific variant answer if question is personalized
          const variantQ = wsQuestions.find(q => q.question_id === qId);
          const expectedAnswer = variantQ ? variantQ.answer : entry.question.answer;

          const isCorrect = isAnswerCorrect(submittedAnswer, expectedAnswer);
          const studentIdentifier = sub.studentId || sub.studentName || `${sub.schoolId || 'sch'}_${sub.id}`;
          
          // Deduplicate per distinct student (if student previously passed, preserve pass)
          const previousOutcome = entry.studentOutcomes.get(studentIdentifier);
          if (previousOutcome !== true) {
            entry.studentOutcomes.set(studentIdentifier, isCorrect);
          }
        }
      }
    }

    // Compute distinct student counts for cohort failure metrics
    for (const entry of statsMap.values()) {
      if (entry.studentOutcomes.size > 0) {
        entry.attempts = entry.studentOutcomes.size;
        let failCount = 0;
        for (const isCorrect of entry.studentOutcomes.values()) {
          if (!isCorrect) failCount++;
        }
        entry.failures = failCount;
      }
    }

    const created: Ticket[] = [];
    const updated: Ticket[] = [];
    const allFlags: Ticket[] = [];

    const overrides = await dbStore.getQuestionDifficultyOverrides();

    // 3. Evaluate criteria:
    // - Respect Superadmin difficulty reclassifications (saved in dbStore or resolved tickets)
    // - Only flag when attempts >= minAttempts (at least 3 attempts in cohort)
    // - Easy question with >= 50% failure rate (SRS Rule R-15)
    // - Medium question with >= 70% failure rate
    // - Hard question is not subject to easy/medium failure flags
    for (const [qId, stats] of statsMap.entries()) {
      const q = stats.question;
      const ticketId = `flag_${q.question_id.replace(/[^a-zA-Z0-9_-]/g, '_')}_L${q.source_level || 1}`;
      const existingTicket = existingTickets.find(
        t => t.id === ticketId || t.flagDetails?.questionId === q.question_id
      );

      // Determine effective difficulty based on persisted overrides / resolved tickets
      const resolvedReclassified = (existingTicket?.status === 'Resolved' && existingTicket?.reclassifiedBand && ['easy', 'medium', 'hard'].includes(existingTicket.reclassifiedBand))
        ? existingTicket.reclassifiedBand as 'easy' | 'medium' | 'hard'
        : undefined;

      const diff = (
        overrides[q.question_id] ||
        resolvedReclassified ||
        q.difficulty ||
        ((q.source_level && q.source_level <= 20) ? 'easy' : 'medium')
      ).toLowerCase() as 'easy' | 'medium' | 'hard';
      
      // Must have at least minAttempts in cohort to be statistically valid
      if (stats.attempts < minAttempts) continue;

      let isAnomalous = false;
      let recommendedBand: 'medium' | 'hard' | 'same_cohort' | undefined = undefined;
      let flagSubjectPrefix = '';

      const failRatio = stats.failures / stats.attempts;
      const failureRate = Math.round(failRatio * 1000) / 10; // e.g. 75.0%

      if (diff === 'easy' && failRatio >= easyThreshold) {
        isAnomalous = true;
        recommendedBand = failureRate >= 85 ? 'medium' : 'same_cohort';
        flagSubjectPrefix = '[AUTO-FLAG R-15: Easy]';
      } else if (diff === 'medium' && failRatio >= mediumThreshold) {
        isAnomalous = true;
        recommendedBand = failureRate >= 85 ? 'hard' : 'same_cohort';
        flagSubjectPrefix = '[AUTO-FLAG: Medium Anomaly]';
      }

      if (!isAnomalous) continue;

      const schoolList = Array.from(stats.schools);

      const flagDetails: AutoFlagDetails = {
        questionId: q.question_id,
        questionText: q.question,
        difficulty: diff,
        level: q.source_level || 1,
        conceptId: q.conceptId,
        topic: q.topic,
        attempts: stats.attempts,
        failures: stats.failures,
        failureRate,
        expectedAnswer: q.answer,
        affectedSchools: schoolList,
        recommendedBand,
        lastDetectedAt: new Date().toISOString()
      };

      if (existingTicket) {
        // If the ticket is already Resolved or Reviewed by Admin, PRESERVE that status and action taken!
        // Do NOT reopen or spam Superadmin again with new requests for the same resolved question.
        const currentStatus = existingTicket.status;

        const updatedTicket = await dbStore.updateTicket(existingTicket.id, {
          flagDetails,
          status: currentStatus, // Keep existing status (Resolved stays Resolved, Open stays Open)
          description: this.buildTicketDescription(q, stats.attempts, stats.failures, failureRate, schoolList, recommendedBand)
        });
        if (updatedTicket) {
          updated.push(updatedTicket);
          allFlags.push(updatedTicket);
        }
      } else {
        // Create new auto-flag ticket in Open status
        const newTicket: Ticket = {
          id: ticketId,
          userId: 'system_autoflag',
          userEmail: 'autoflag-engine@fln.org',
          userName: 'Automated Pedagogical QA Engine (R-15)',
          userRole: UserRole.SUPERADMIN,
          type: 'curriculum',
          subject: `${flagSubjectPrefix} ${failureRate}% Failure Rate on ${diff.toUpperCase()} Question: ${q.question_id}`,
          description: this.buildTicketDescription(q, stats.attempts, stats.failures, failureRate, schoolList, recommendedBand),
          status: 'Open',
          createdAt: new Date().toISOString(),
          isAutoFlag: true,
          flagDetails
        };

        await dbStore.addTicket(newTicket);
        created.push(newTicket);
        allFlags.push(newTicket);

        // Log in logbook for auditability (SRS FR-11)
        await dbStore.addLog({
          id: 'log_autoflag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          timestamp: new Date().toISOString(),
          schoolId: schoolList[0] || 'NATIONAL',
          schoolName: schoolList.length > 0 ? `Cohort (${schoolList.length} schools)` : 'National Framework',
          userId: 'system_autoflag',
          userEmail: 'autoflag-engine@fln.org',
          userRole: UserRole.SUPERADMIN,
          activityType: 'ticket',
          status: 'Success',
          details: `Auto-Flagged ${diff.toUpperCase()} Question ${q.question_id} (Level ${q.source_level || 1}) with ${failureRate}% failure rate (${stats.failures}/${stats.attempts} failed)`
        });
      }
    }

    return { created, updated, allFlags };
  }

  /**
   * Generates clean description for pedagogical auto-flag ticket
   */
  private buildTicketDescription(
    q: Question,
    attempts: number,
    failures: number,
    failureRate: number,
    schools: string[],
    recommendedBand?: 'medium' | 'hard' | 'same_cohort'
  ): string {
    const diff = (q.difficulty || 'medium').toUpperCase();
    const thresholdLabel = diff === 'EASY' ? '≥ 50% (SRS Rule R-15)' : '≥ 70% (Medium Anomaly)';
    const recommendationText = recommendedBand === 'same_cohort'
      ? 'Keep in Current Cohort (Moderate Anomaly < 85%)'
      : `Reclassify to ${recommendedBand ? recommendedBand.toUpperCase() : 'NEW BAND'} (Severe Anomaly ≥ 85%)`;

    return [
      `Automated Pedagogical Level Flag (SRS Rule R-15 & §6.7)`,
      `An anomaly was detected in curriculum assessment performance. A question categorized as ${diff} has exceeded the failure threshold (${thresholdLabel}) across student submissions.`,
      ``,
      `Question ID: ${q.question_id}`,
      `Curriculum Level: Level ${q.source_level || 'N/A'}${q.conceptId ? ` (${q.conceptId})` : ''}`,
      `Topic / Domain: ${q.topic || 'Foundational Mathematics'} ${q.subtopic ? `— ${q.subtopic}` : ''}`,
      `Current Difficulty Band: ${diff}`,
      `Recommendation: ${recommendationText}`,
      `Question Prompt: "${q.question}"`,
      `Expected Answer: ${q.answer}`,
      `Student Cohort Attempts: ${attempts}`,
      `Failed Submissions: ${failures}`,
      `Cohort Failure Rate: ${failureRate}% (Threshold: ${thresholdLabel})`,
      `Affected Schools: ${schools.length > 0 ? schools.join(', ') : 'All reporting schools'}`
    ].join('\n');
  }

  /**
   * Fetches summary stats for Superadmin Review Queue & Dashboard
   */
  async getAutoFlagSummary(): Promise<AutoFlagSummary> {
    const allTickets = await dbStore.getTickets();
    const autoFlags = allTickets.filter(t => t.isAutoFlag || t.subject.startsWith('[AUTO-FLAG'));

    const openFlags = autoFlags.filter(t => t.status === 'Open').length;
    const reviewedFlags = autoFlags.filter(t => t.status === 'Reviewed').length;
    const resolvedFlags = autoFlags.filter(t => t.status === 'Resolved').length;

    let criticalCount = 0;
    let easyCount = 0;
    let mediumCount = 0;
    let totalRateSum = 0;

    for (const f of autoFlags) {
      const rate = f.flagDetails?.failureRate || 50;
      const diff = (f.flagDetails?.difficulty || 'easy').toLowerCase();
      totalRateSum += rate;
      if (rate >= 70) criticalCount += 1;
      if (diff === 'easy') easyCount += 1;
      if (diff === 'medium') mediumCount += 1;
    }

    const averageFailureRate = autoFlags.length > 0
      ? Math.round((totalRateSum / autoFlags.length) * 10) / 10
      : 0;

    return {
      totalFlagged: autoFlags.length,
      openFlags,
      reviewedFlags,
      resolvedFlags,
      criticalFlagsCount: criticalCount,
      easyFlagsCount: easyCount,
      mediumFlagsCount: mediumCount,
      averageFailureRate,
      flags: autoFlags,
      lastScanAt: new Date().toISOString()
    };
  }
}

export const autoFlagService = new AutoFlagService();
