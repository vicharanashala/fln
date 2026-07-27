import { DBStore, Question, UserRole } from './db';
import {
  ConceptMasteryProfile,
  ConceptScore,
  STRONG_THRESHOLD,
  SATISFACTORY_THRESHOLD,
  REINFORCEMENT_MASTERY_THRESHOLD,
  MAX_REINFORCEMENT_LEVELS,
  REINF_COUNT_WEAK,
  REINF_COUNT_MODERATE,
  MAX_REINFORCEMENT_PER_WORKSHEET,
  WORKSHEET_TOTAL_QUESTIONS,
  REINF_EVERY_WORKSHEET_THRESHOLD,
  REINF_ALTERNATE_WORKSHEET_THRESHOLD
} from './conceptMastery';
import { generateQuestionsForLevel } from './levelGenerator';

/**
 * Updates a student's cumulative concept mastery profile based on the latest assessment results.
 * Score is calculated using the latest assessment score only (ignoring old historical data).
 */
export async function updateConceptMastery(
  studentId: string,
  questions: Question[],
  answers: { [questionId: string]: string },
  dbStore: DBStore
): Promise<ConceptMasteryProfile> {
  let profile = await dbStore.getConceptMasteryProfile(studentId);
  if (!profile) {
    profile = {
      id: 'cmp_' + studentId + '_' + Date.now(),
      studentId,
      concepts: [],
      updatedAt: new Date().toISOString()
    };
  }

  const topicStats: {
    [topic: string]: {
      regularAttempts: { level: number; correct: boolean }[];
      reinfTotal: number;
      reinfCorrect: number;
    }
  } = {};

  questions.forEach(q => {
    const topic = q.topic || 'Number Sense';
    if (!topicStats[topic]) {
      topicStats[topic] = { regularAttempts: [], reinfTotal: 0, reinfCorrect: 0 };
    }

    const submitted = (answers[q.question_id] || '').trim().toLowerCase();
    const correct = (q.answer || '').trim().toLowerCase();
    const isCorrect = submitted === correct;

    const isReinf = q.question_id.includes('_REINF_') || q.question_id.toLowerCase().includes('reinf_') || q.subtopic === 'Reinforcement';

    if (isReinf) {
      topicStats[topic].reinfTotal++;
      if (isCorrect) {
        topicStats[topic].reinfCorrect++;
      }
    } else {
      topicStats[topic].regularAttempts.push({ level: q.source_level, correct: isCorrect });
    }
  });

  const nowStr = new Date().toISOString();

  const studentsList = await dbStore.getStudents();
  const student = studentsList.find(s => s.id === studentId);
  const currentStudentLevel = student ? student.currentLevel : 1;

  for (const [topic, stats] of Object.entries(topicStats)) {
    let concept = profile.concepts.find(c => c.topic.toLowerCase() === topic.toLowerCase());
    
    if (!concept) {
      concept = {
        topic,
        totalAttempts: 0,
        correctCount: 0,
        masteryPct: 0,
        status: 'Needs Practice',
        lastAssessedAt: nowStr,
        consecutiveMasteryCount: 0,
        recentAnswers: [],
        consecutiveReinforcementMasteryCount: 0,
        isReinforcementActive: false
      };
      profile.concepts.push(concept);
    }

    if (!concept.recentAnswers) concept.recentAnswers = [];
    if (concept.isReinforcementActive === undefined) concept.isReinforcementActive = false;
    if (concept.consecutiveReinforcementMasteryCount === undefined) concept.consecutiveReinforcementMasteryCount = 0;
    if (concept.reinforcedQuestionIds === undefined) concept.reinforcedQuestionIds = [];
    if (concept.reinforcementCyclesCompleted === undefined) concept.reinforcementCyclesCompleted = 0;

    if (stats.regularAttempts.length > 0) {
      const correctRegular = stats.regularAttempts.filter(a => a.correct).length;
      const totalRegular = stats.regularAttempts.length;

      concept.totalAttempts += totalRegular;
      concept.correctCount += correctRegular;

      const accuracyLatest = (correctRegular / totalRegular) * 100;
      concept.masteryPct = Math.round(accuracyLatest);

      if (concept.masteryPct >= STRONG_THRESHOLD) {
        concept.status = 'Strong';
        concept.consecutiveMasteryCount = concept.status === 'Strong' ? concept.consecutiveMasteryCount + 1 : 1;
      } else {
        if (concept.masteryPct >= SATISFACTORY_THRESHOLD) {
          concept.status = 'Satisfactory';
        } else {
          concept.status = 'Needs Practice';
        }
        concept.consecutiveMasteryCount = 0;
      }

      concept.recentAnswers.push(...stats.regularAttempts);
      if (concept.recentAnswers.length > 5) {
        concept.recentAnswers = concept.recentAnswers.slice(-5);
      }

      if (concept.masteryPct < REINFORCEMENT_MASTERY_THRESHOLD) {
        if (!concept.isReinforcementActive && !concept.needsTeacherIntervention) {
          concept.isReinforcementActive = true;
          concept.reinforcementTriggeredAtLevel = currentStudentLevel;
          concept.reinforcementStartLevel = currentStudentLevel;
          concept.reinforcementLevelsCompleted = 0;
          concept.needsTeacherIntervention = false;
          concept.consecutiveReinforcementMasteryCount = 0;
          concept.reinforcedQuestionIds = [];
          concept.reinforcementCyclesCompleted = 0;
          concept.lastReinforcementSkipped = false;
          console.log(`[Reinf Log] TRIGGERED: Student ${studentId} triggered reinforcement for ${topic}. Latest Mastery: ${concept.masteryPct}% (<${REINFORCEMENT_MASTERY_THRESHOLD}%). Trigger level: ${currentStudentLevel}.`);
          await dbStore.addLog({
            id: 'LOG_' + Math.random().toString(36).substr(2, 9),
            timestamp: nowStr,
            schoolId: 'system',
            schoolName: 'System',
            userId: studentId,
            userEmail: 'system@fln.org',
            userRole: UserRole.TEACHER,
            activityType: 'verify',
            status: 'Success',
            details: `Student ${studentId} triggered reinforcement for ${topic} at level ${currentStudentLevel}.`
          });
        }
      }

      if (concept.masteryPct >= REINFORCEMENT_MASTERY_THRESHOLD) {
        if (concept.isReinforcementActive || concept.needsTeacherIntervention) {
          concept.isReinforcementActive = false;
          concept.needsTeacherIntervention = false;
          concept.recentAnswers = [];
          console.log(`[Reinf Log] MASTERY STOP: Student ${studentId} reached ${concept.masteryPct}% (>=${REINFORCEMENT_MASTERY_THRESHOLD}%) on ${topic}. Reinforcement stopped.`);
          await dbStore.addLog({
            id: 'LOG_' + Math.random().toString(36).substr(2, 9),
            timestamp: nowStr,
            schoolId: 'system',
            schoolName: 'System',
            userId: studentId,
            userEmail: 'system@fln.org',
            userRole: UserRole.TEACHER,
            activityType: 'verify',
            status: 'Success',
            details: `Student ${studentId} reached ${concept.masteryPct}% mastery on ${topic}. Reinforcement stopped.`
          });
        }
      }
    }

    if (stats.reinfTotal > 0) {
      const accuracyReinf = stats.reinfCorrect / stats.reinfTotal;
      const accuracyPct = Math.round(accuracyReinf * 100);

      if (accuracyPct >= REINFORCEMENT_MASTERY_THRESHOLD) {
        concept.isReinforcementActive = false;
        concept.needsTeacherIntervention = false;
        concept.recentAnswers = [];
        console.log(`[Reinf Log] EARLY MASTERY STOP: Student ${studentId} achieved ${accuracyPct}% (>=${REINFORCEMENT_MASTERY_THRESHOLD}%) on reinforcement for ${topic}. Reinforcement stopped immediately.`);
        await dbStore.addLog({
          id: 'LOG_' + Math.random().toString(36).substr(2, 9),
          timestamp: nowStr,
          schoolId: 'system',
          schoolName: 'System',
          userId: studentId,
          userEmail: 'system@fln.org',
          userRole: UserRole.TEACHER,
          activityType: 'verify',
          status: 'Success',
          details: `Student ${studentId} achieved ${accuracyPct}% score on ${topic}. Reinforcement completed early!`
        });
      } else {
        console.log(`[Reinf Log] REINFORCEMENT CONTINUES: Student ${studentId} scored ${accuracyPct}% (<${REINFORCEMENT_MASTERY_THRESHOLD}%) on reinforcement for ${topic}.`);
      }
    }

    concept.lastAssessedAt = nowStr;
  }

  profile.updatedAt = nowStr;
  
  await dbStore.upsertConceptMasteryProfile(profile);
  return profile;
}

function shouldReinforceConcept(concept: ConceptScore): boolean {
  if (!concept.isReinforcementActive) return false;

  const mastery = concept.masteryPct;

  if (mastery >= REINFORCEMENT_MASTERY_THRESHOLD) return false;

  if (mastery < REINF_EVERY_WORKSHEET_THRESHOLD) return true;

  if (mastery < REINF_ALTERNATE_WORKSHEET_THRESHOLD) {
    if (concept.lastReinforcementSkipped === true) {
      return true;
    } else {
      return false;
    }
  }

  return false;
}

export function getWorksheetComposition(eligibleWeakConceptCount: number): { normalCount: number; reinfCount: number } {
  const clamped = Math.min(eligibleWeakConceptCount, MAX_REINFORCEMENT_PER_WORKSHEET);
  const reinfCount = clamped;
  const normalCount = WORKSHEET_TOTAL_QUESTIONS - reinfCount;
  return { normalCount, reinfCount };
}

export interface ReinforcementDebugInfo {
  studentId: string;
  currentLevel: number;
  weakConcepts: Array<{
    topic: string;
    masteryPct: number;
    status: string;
    isReinforcementActive: boolean;
    reinforcementTriggeredAtLevel: number | null;
    nextReinforcementLevel: number | null;
    reinforcementEligible: boolean;
    frequencyBand: string;
    eligibilityReason: string;
    questionsToInject: number;
    reinforcementLevelsCompleted: number;
    maxReinforcementLevels: number;
    needsTeacherIntervention: boolean;
  }>;
  totalReinforcementQuestions: number;
  normalQuestionCount: number;
  hasActiveReinforcement: boolean;
  hasTeacherInterventionAlert: boolean;
}

function getDeterministicIndex(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

export async function getReinforcementQuestionsWithDebug(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore,
  excludeTexts?: Set<string>,
  worksheetQuestionTexts?: Set<string>,
  readOnly: boolean = false
): Promise<{ questions: Question[]; debugInfo: ReinforcementDebugInfo }> {
  const profile = await dbStore.getConceptMasteryProfile(studentId);
  
  const debugInfo: ReinforcementDebugInfo = {
    studentId,
    currentLevel,
    weakConcepts: [],
    totalReinforcementQuestions: 0,
    normalQuestionCount: WORKSHEET_TOTAL_QUESTIONS,
    hasActiveReinforcement: false,
    hasTeacherInterventionAlert: false,
  };

  if (!profile) {
    console.log(`[Reinf Log] Student ${studentId} has no concept mastery profile. No reinforcement.`);
    return { questions: [], debugInfo };
  }

  let profileChanged = false;
  const eligibleConcepts: ConceptScore[] = [];
  const alternateSkippedConcepts: ConceptScore[] = [];

  for (const c of profile.concepts) {
    if (c.masteryPct >= REINFORCEMENT_MASTERY_THRESHOLD) {
      if (c.isReinforcementActive || c.needsTeacherIntervention) {
        c.isReinforcementActive = false;
        c.needsTeacherIntervention = false;
        profileChanged = true;
      }
      debugInfo.weakConcepts.push({
        topic: c.topic,
        masteryPct: Math.round(c.masteryPct * 10) / 10,
        status: 'Strong',
        isReinforcementActive: false,
        reinforcementTriggeredAtLevel: c.reinforcementTriggeredAtLevel || null,
        nextReinforcementLevel: null,
        reinforcementEligible: false,
        frequencyBand: 'mastered (≥80%)',
        eligibilityReason: `Mastered (Score ${c.masteryPct}% ≥ ${REINFORCEMENT_MASTERY_THRESHOLD}%)`,
        questionsToInject: 0,
        reinforcementLevelsCompleted: c.reinforcementLevelsCompleted || 0,
        maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
        needsTeacherIntervention: false,
      });
      continue;
    }

    if (!c.isReinforcementActive) {
      if (c.needsTeacherIntervention) {
        debugInfo.hasTeacherInterventionAlert = true;
        debugInfo.weakConcepts.push({
          topic: c.topic,
          masteryPct: Math.round(c.masteryPct * 10) / 10,
          status: c.status,
          isReinforcementActive: false,
          reinforcementTriggeredAtLevel: c.reinforcementTriggeredAtLevel || null,
          nextReinforcementLevel: null,
          reinforcementEligible: false,
          frequencyBand: 'teacher-intervention',
          eligibilityReason: `${MAX_REINFORCEMENT_LEVELS} cycles completed without ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery — Teacher Alert Raised`,
          questionsToInject: 0,
          reinforcementLevelsCompleted: c.reinforcementLevelsCompleted || 0,
          maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
          needsTeacherIntervention: true,
        });
      }
      continue;
    }

    if (c.lastReinforcementSkipped === undefined) c.lastReinforcementSkipped = false;
    const levelsCompleted = c.reinforcementLevelsCompleted || 0;

    if (levelsCompleted >= MAX_REINFORCEMENT_LEVELS) {
      c.isReinforcementActive = false;
      c.needsTeacherIntervention = true;
      debugInfo.hasTeacherInterventionAlert = true;
      profileChanged = true;
      console.log(`[Reinf Log] TEACHER ALERT: Student ${studentId} completed ${MAX_REINFORCEMENT_LEVELS} reinforcement cycles for ${c.topic} without reaching ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery. Teacher Alert raised.`);
      await dbStore.addLog({
        id: 'LOG_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        schoolId: 'system',
        schoolName: 'System',
        userId: studentId,
        userEmail: 'system@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'verify',
        status: 'Failed',
        details: `Student ${studentId} requires remedial teacher intervention for ${c.topic} (Completed ${MAX_REINFORCEMENT_LEVELS} cycles without reaching ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery).`
      });
      debugInfo.weakConcepts.push({
        topic: c.topic,
        masteryPct: Math.round(c.masteryPct * 10) / 10,
        status: c.status,
        isReinforcementActive: false,
        reinforcementTriggeredAtLevel: c.reinforcementTriggeredAtLevel || null,
        nextReinforcementLevel: null,
        reinforcementEligible: false,
        frequencyBand: 'teacher-intervention',
        eligibilityReason: `${MAX_REINFORCEMENT_LEVELS} cycles completed without ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery — Teacher Alert Raised`,
        questionsToInject: 0,
        reinforcementLevelsCompleted: levelsCompleted,
        maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
        needsTeacherIntervention: true,
      });
    } else if (shouldReinforceConcept(c)) {
      eligibleConcepts.push(c);
    } else {
      alternateSkippedConcepts.push(c);
      c.lastReinforcementSkipped = true;
      profileChanged = true;
      const freqBand = 'alternate-worksheet (40–79%) — SKIPPED';
      debugInfo.weakConcepts.push({
        topic: c.topic,
        masteryPct: Math.round(c.masteryPct * 10) / 10,
        status: c.status,
        isReinforcementActive: true,
        reinforcementTriggeredAtLevel: c.reinforcementTriggeredAtLevel || null,
        nextReinforcementLevel: currentLevel,
        reinforcementEligible: false,
        frequencyBand: freqBand,
        eligibilityReason: `Skipped this worksheet (alternate worksheet schedule for 40–79% score)`,
        questionsToInject: 0,
        reinforcementLevelsCompleted: levelsCompleted,
        maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
        needsTeacherIntervention: false,
      });
    }
  }

  eligibleConcepts.sort((a, b) => a.masteryPct - b.masteryPct);
  
  const targetConcepts = eligibleConcepts.slice(0, MAX_REINFORCEMENT_PER_WORKSHEET);
  const deferredConcepts = eligibleConcepts.slice(MAX_REINFORCEMENT_PER_WORKSHEET);

  for (const c of deferredConcepts) {
    debugInfo.weakConcepts.push({
      topic: c.topic,
      masteryPct: Math.round(c.masteryPct * 10) / 10,
      status: c.status,
      isReinforcementActive: true,
      reinforcementTriggeredAtLevel: c.reinforcementTriggeredAtLevel || null,
      nextReinforcementLevel: currentLevel,
      reinforcementEligible: false,
      frequencyBand: c.masteryPct < REINF_EVERY_WORKSHEET_THRESHOLD ? 'every-worksheet (<40%)' : 'alternate-worksheet (40–79%)',
      eligibilityReason: `Deferred (only top ${MAX_REINFORCEMENT_PER_WORKSHEET} weakest concepts reinforced per worksheet)`,
      questionsToInject: 0,
      reinforcementLevelsCompleted: c.reinforcementLevelsCompleted || 0,
      maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
      needsTeacherIntervention: false,
    });
  }

  const allFoundQs: Question[] = [];
  const selectedReinfTexts = new Set<string>();

  for (let idx = 0; idx < targetConcepts.length; idx++) {
    const targetConcept = targetConcepts[idx];
    if (!targetConcept.reinforcedQuestionIds) targetConcept.reinforcedQuestionIds = [];
    const triggerLvl = targetConcept.reinforcementTriggeredAtLevel || currentLevel;
    const levelsCompleted = targetConcept.reinforcementLevelsCompleted || 0;

    const isUniqueCandidate = (mq: Question): boolean => {
      const cleanText = mq.question.trim().toLowerCase();
      if (excludeTexts && excludeTexts.has(cleanText)) return false;
      if (worksheetQuestionTexts && worksheetQuestionTexts.has(cleanText)) return false;
      if (selectedReinfTexts.has(cleanText)) return false;
      if (targetConcept.reinforcedQuestionIds!.includes(mq.question_id)) return false;
      if (targetConcept.reinforcedQuestionIds!.includes(cleanText)) return false;
      return true;
    };

    let foundQ: Question | null = null;
    const studentSeed = `${studentId}_${targetConcept.topic}_L${triggerLvl}_C${levelsCompleted}`;

    for (let lvl = triggerLvl; lvl >= 1 && !foundQ; lvl--) {
      const levelQs = generateQuestionsForLevel(lvl, 0, `${studentSeed}_L${lvl}`);
      const matching = levelQs.filter(q => q.topic.toLowerCase() === targetConcept.topic.toLowerCase());

      if (matching.length > 0) {
        const startIdx = getDeterministicIndex(`${studentSeed}_L${lvl}`, matching.length);
        for (let i = 0; i < matching.length; i++) {
          const candidate = matching[(startIdx + i) % matching.length];
          if (isUniqueCandidate(candidate)) {
            foundQ = candidate;
            break;
          }
        }
      }
    }

    if (!foundQ) {
      for (let lvl = currentLevel; lvl >= 1 && !foundQ; lvl--) {
        const levelQs = generateQuestionsForLevel(lvl, 0, `${studentSeed}_FB_L${lvl}`);
        const matching = levelQs.filter(q => q.topic.toLowerCase() === targetConcept.topic.toLowerCase());

        if (matching.length > 0) {
          const startIdx = getDeterministicIndex(`${studentSeed}_FB_L${lvl}`, matching.length);
          for (let i = 0; i < matching.length; i++) {
            const candidate = matching[(startIdx + i) % matching.length];
            if (isUniqueCandidate(candidate)) {
              foundQ = candidate;
              break;
            }
          }
        }
      }
    }

    const freqBand = targetConcept.masteryPct < REINF_EVERY_WORKSHEET_THRESHOLD 
      ? 'every-worksheet (<40%)' 
      : 'alternate-worksheet (40–79%)';

    if (!foundQ) {
      console.log(`[Reinf Log] Could not find unique reinforcement question for ${targetConcept.topic}. All candidates duplicated existing questions.`);
      debugInfo.weakConcepts.push({
        topic: targetConcept.topic,
        masteryPct: Math.round(targetConcept.masteryPct * 10) / 10,
        status: targetConcept.status,
        isReinforcementActive: true,
        reinforcementTriggeredAtLevel: triggerLvl,
        nextReinforcementLevel: currentLevel,
        reinforcementEligible: false,
        frequencyBand: freqBand,
        eligibilityReason: 'Skipped (no unique question candidate available)',
        questionsToInject: 0,
        reinforcementLevelsCompleted: levelsCompleted,
        maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
        needsTeacherIntervention: false,
      });
      continue;
    }

    const cleanQText = foundQ.question.trim().toLowerCase();
    
    selectedReinfTexts.add(cleanQText);
    targetConcept.reinforcedQuestionIds.push(foundQ.question_id, cleanQText);
    targetConcept.reinforcementLevelsCompleted = levelsCompleted + 1;
    targetConcept.lastReinforcementSkipped = false;
    profileChanged = true;

    const formattedQId = `reinf_${studentId}_${targetConcept.topic.replace(/\s+/g, '_')}_C${targetConcept.reinforcementLevelsCompleted}`;

    console.log(`[Reinf Log] SELECTED: Reinforcement question on ${targetConcept.topic} for student ${studentId} (Cycle ${targetConcept.reinforcementLevelsCompleted} of ${MAX_REINFORCEMENT_LEVELS}, Mastery: ${targetConcept.masteryPct}%, Frequency: ${freqBand}).`);

    const formattedQ: Question = {
      ...foundQ,
      question_id: formattedQId,
      subtopic: 'Reinforcement',
      difficulty: 'medium',
      question: foundQ.question
    };

    allFoundQs.push(formattedQ);

    debugInfo.weakConcepts.push({
      topic: targetConcept.topic,
      masteryPct: Math.round(targetConcept.masteryPct * 10) / 10,
      status: targetConcept.status,
      isReinforcementActive: true,
      reinforcementTriggeredAtLevel: triggerLvl,
      nextReinforcementLevel: currentLevel,
      reinforcementEligible: true,
      frequencyBand: freqBand,
      eligibilityReason: `Reinforcement question injected into worksheet (Cycle ${targetConcept.reinforcementLevelsCompleted} of ${MAX_REINFORCEMENT_LEVELS})`,
      questionsToInject: 1,
      reinforcementLevelsCompleted: targetConcept.reinforcementLevelsCompleted,
      maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
      needsTeacherIntervention: false,
    });
  }

  if (profileChanged && !readOnly) {
    profile.updatedAt = new Date().toISOString();
    await dbStore.upsertConceptMasteryProfile(profile);
  }

  debugInfo.totalReinforcementQuestions = allFoundQs.length;
  debugInfo.normalQuestionCount = WORKSHEET_TOTAL_QUESTIONS - allFoundQs.length;
  debugInfo.hasActiveReinforcement = debugInfo.weakConcepts.some(wc => wc.isReinforcementActive && wc.questionsToInject > 0);

  return { questions: allFoundQs, debugInfo };
}

export async function getReinforcementQuestions(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore,
  excludeTexts?: Set<string>,
  worksheetQuestionTexts?: Set<string>
): Promise<Question[]> {
  const { questions } = await getReinforcementQuestionsWithDebug(studentId, currentLevel, dbStore, excludeTexts, worksheetQuestionTexts, false);
  return questions;
}

export async function getReinforcementDebugInfo(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore
): Promise<ReinforcementDebugInfo> {
  const { debugInfo } = await getReinforcementQuestionsWithDebug(studentId, currentLevel, dbStore, undefined, undefined, true);
  return debugInfo;
}

export function getReinforcementQuestionCount(masteryPct: number): number {
  if (masteryPct <= 75) return REINF_COUNT_WEAK;
  return 0;
}

export function mixWorksheetQuestions(currentQuestions: Question[], reinforcementQuestions: Question[]): Question[] {
  if (reinforcementQuestions.length === 0) return currentQuestions;

  const normalTexts = new Set<string>(
    currentQuestions.map(q => q.question.trim().toLowerCase())
  );
  const uniqueReinforcement = reinforcementQuestions.filter(rq => {
    const cleanText = rq.question.trim().toLowerCase();
    if (normalTexts.has(cleanText)) {
      console.log(`[Reinf Log] DEDUP SAFETY: Filtered out reinforcement question "${rq.question}" because it duplicates a normal worksheet question.`);
      return false;
    }
    return true;
  });

  return [...currentQuestions, ...uniqueReinforcement];
}
