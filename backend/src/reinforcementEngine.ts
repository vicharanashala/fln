import { DBStore, Question } from './db';
import {
  ConceptMasteryProfile,
  ConceptScore,
  STRONG_THRESHOLD,
  SATISFACTORY_THRESHOLD,
  REINFORCEMENT_MASTERY_THRESHOLD,
  MAX_REINFORCEMENT_LEVELS,
  ROLLING_WEIGHT_LATEST,
  REINF_COUNT_WEAK,
  REINF_COUNT_MODERATE,
  MAX_REINFORCEMENT_PER_WORKSHEET,
  WORKSHEET_TOTAL_QUESTIONS,
  REINF_EVERY_WORKSHEET_THRESHOLD,
  REINF_ALTERNATE_WORKSHEET_THRESHOLD
} from './conceptMastery';
import { generateQuestionsForLevel } from './levelGenerator';

/**
 * Updates a student's cumulative concept mastery profile based on the results of an assessment.
 * Categorizes questions into regular and reinforcement to apply adaptive trigger and stop rules.
 */
export async function updateConceptMastery(
  studentId: string,
  questions: Question[],
  answers: { [questionId: string]: string },
  dbStore: DBStore
): Promise<ConceptMasteryProfile> {
  // 1. Load or initialize profile
  let profile = await dbStore.getConceptMasteryProfile(studentId);
  if (!profile) {
    profile = {
      id: 'cmp_' + studentId + '_' + Date.now(),
      studentId,
      concepts: [],
      updatedAt: new Date().toISOString()
    };
  }

  // 2. Separate questions by topic, and categorize them into regular and reinforcement
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

    // Check if this is a reinforcement question
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

  // Load student to get their current level
  const studentsList = await dbStore.getStudents();
  const student = studentsList.find(s => s.id === studentId);
  const currentStudentLevel = student ? student.currentLevel : 1;

  // 3. Update the rolling mastery metrics and reinforcement status
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

    // Initialize optional fields if they don't exist
    if (!concept.recentAnswers) concept.recentAnswers = [];
    if (concept.isReinforcementActive === undefined) concept.isReinforcementActive = false;
    if (concept.consecutiveReinforcementMasteryCount === undefined) concept.consecutiveReinforcementMasteryCount = 0;
    if (concept.reinforcedQuestionIds === undefined) concept.reinforcedQuestionIds = [];
    if (concept.reinforcementCyclesCompleted === undefined) concept.reinforcementCyclesCompleted = 0;

    // Process Regular Attempts
    if (stats.regularAttempts.length > 0) {
      // Update rolling legacy averages
      const correctRegular = stats.regularAttempts.filter(a => a.correct).length;
      const totalRegular = stats.regularAttempts.length;

      concept.totalAttempts += totalRegular;
      concept.correctCount += correctRegular;

      const accuracyLatest = (correctRegular / totalRegular) * 100;
      const oldMasteryPct = concept.masteryPct;
      if (concept.totalAttempts === totalRegular) {
        concept.masteryPct = Math.round(accuracyLatest);
      } else {
        concept.masteryPct = Math.round(
          (accuracyLatest * ROLLING_WEIGHT_LATEST) + 
          (oldMasteryPct * (1 - ROLLING_WEIGHT_LATEST))
        );
      }

      // Legacy status updating
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

      // Add to recentAnswers
      concept.recentAnswers.push(...stats.regularAttempts);
      if (concept.recentAnswers.length > 5) {
        concept.recentAnswers = concept.recentAnswers.slice(-5);
      }

      // Trigger Rule: mastery < 80% activates reinforcement
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
          console.log(`[Reinf Log] TRIGGERED: Student ${studentId} triggered reinforcement for ${topic}. Mastery: ${concept.masteryPct}% (<${REINFORCEMENT_MASTERY_THRESHOLD}%). Trigger level: ${currentStudentLevel}.`);
          await dbStore.addLog({
            id: 'LOG_' + Math.random().toString(36).substr(2, 9),
            title: 'Reinforcement Triggered',
            message: `Student ${studentId} triggered reinforcement for ${topic} at level ${currentStudentLevel}.`,
            level: 'info',
            timestamp: nowStr,
            source: 'system'
          });
        }
      }

      // Stop Rule: mastery ≥ 80% stops reinforcement
      if (concept.masteryPct >= REINFORCEMENT_MASTERY_THRESHOLD) {
        if (concept.isReinforcementActive || concept.needsTeacherIntervention) {
          concept.isReinforcementActive = false;
          concept.needsTeacherIntervention = false;
          concept.recentAnswers = [];
          console.log(`[Reinf Log] MASTERY STOP: Student ${studentId} reached ${concept.masteryPct}% (>=${REINFORCEMENT_MASTERY_THRESHOLD}%) on ${topic}. Reinforcement stopped.`);
          await dbStore.addLog({
            id: 'LOG_' + Math.random().toString(36).substr(2, 9),
            title: 'Reinforcement Mastery Stop',
            message: `Student ${studentId} reached ${concept.masteryPct}% mastery on ${topic}. Reinforcement stopped.`,
            level: 'info',
            timestamp: nowStr,
            source: 'system'
          });
        }
      }
    }

    // Process Reinforcement Attempts
    if (stats.reinfTotal > 0) {
      const accuracyReinf = stats.reinfCorrect / stats.reinfTotal;
      const accuracyPct = Math.round(accuracyReinf * 100);

      // Rule: Stop if reinforcement score ≥ 80%
      if (accuracyPct >= REINFORCEMENT_MASTERY_THRESHOLD) {
        concept.isReinforcementActive = false;
        concept.needsTeacherIntervention = false;
        concept.recentAnswers = [];
        console.log(`[Reinf Log] EARLY MASTERY STOP: Student ${studentId} achieved ${accuracyPct}% (>=${REINFORCEMENT_MASTERY_THRESHOLD}%) on reinforcement for ${topic}. Reinforcement stopped immediately.`);
        await dbStore.addLog({
          id: 'LOG_' + Math.random().toString(36).substr(2, 9),
          title: 'Reinforcement Early Mastery Stop',
          message: `Student ${studentId} achieved ${accuracyPct}% score on ${topic}. Reinforcement completed early!`,
          level: 'info',
          timestamp: nowStr,
          source: 'system'
        });
      } else {
        console.log(`[Reinf Log] REINFORCEMENT CONTINUES: Student ${studentId} scored ${accuracyPct}% (<${REINFORCEMENT_MASTERY_THRESHOLD}%) on reinforcement for ${topic}.`);
      }
    }

    concept.lastAssessedAt = nowStr;
  }

  profile.updatedAt = nowStr;
  
  // Persist updated profile
  await dbStore.upsertConceptMasteryProfile(profile);
  return profile;
}

/**
 * Determines whether a concept should be reinforced on this specific worksheet,
 * respecting score rules:
 * - Score < 40%  → reinforce EVERY worksheet
 * - Score 40–79% → reinforce every ALTERNATE worksheet
 * - Score ≥ 80%  → DO NOT REINFORCE (Mastered)
 */
function shouldReinforceConcept(concept: ConceptScore): boolean {
  if (!concept.isReinforcementActive) return false;

  const mastery = concept.masteryPct;

  // Score ≥ 80%: Mastered → Do not reinforce
  if (mastery >= REINFORCEMENT_MASTERY_THRESHOLD) return false;

  // Score < 40%: Reinforce every worksheet
  if (mastery < REINF_EVERY_WORKSHEET_THRESHOLD) return true;

  // Score 40–79%: Reinforce every alternate worksheet
  if (mastery < REINF_ALTERNATE_WORKSHEET_THRESHOLD) {
    if (concept.lastReinforcementSkipped === true) {
      return true;  // Was skipped last time, so reinforce now
    } else {
      return false; // Was reinforced last time (or first time), so skip now
    }
  }

  return false;
}

/**
 * Returns the worksheet composition: how many normal and reinforcement questions.
 *
 * Rules:
 * - 0 weak concepts → 5 normal, 0 reinforcement
 * - 1 weak concept  → 4 normal, 1 reinforcement
 * - 2 weak concepts → 3 normal, 2 reinforcement
 * - 3+ weak concepts → 2 normal, 3 reinforcement (top 3 weakest only)
 */
export function getWorksheetComposition(eligibleWeakConceptCount: number): { normalCount: number; reinfCount: number } {
  const clamped = Math.min(eligibleWeakConceptCount, MAX_REINFORCEMENT_PER_WORKSHEET);
  const reinfCount = clamped;
  const normalCount = WORKSHEET_TOTAL_QUESTIONS - reinfCount;
  return { normalCount, reinfCount };
}

/**
 * Structured debug snapshot of a student's reinforcement state.
 */
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

/**
 * Returns reinforcement questions AND synchronized debug info for a student.
 */
export async function getReinforcementQuestionsWithDebug(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore,
  excludeTexts?: Set<string>,
  worksheetQuestionTexts?: Set<string>
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

  // Evaluate concepts for eligibility & deactivation
  for (const c of profile.concepts) {
    // 1. Score ≥ 80% → Mastered! Immediately deactivate reinforcement.
    if (c.masteryPct >= REINFORCEMENT_MASTERY_THRESHOLD) {
      if (c.isReinforcementActive || c.needsTeacherIntervention) {
        c.isReinforcementActive = false;
        c.needsTeacherIntervention = false;
        profileChanged = true;
      }
      debugInfo.weakConcepts.push({
        topic: c.topic,
        masteryPct: Math.round(c.masteryPct * 10) / 10,
        status: c.status,
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

    // Rule: Maximum 3 reinforcement cycles
    if (levelsCompleted >= MAX_REINFORCEMENT_LEVELS) {
      c.isReinforcementActive = false;
      c.needsTeacherIntervention = true;
      debugInfo.hasTeacherInterventionAlert = true;
      profileChanged = true;
      console.log(`[Reinf Log] TEACHER ALERT: Student ${studentId} completed ${MAX_REINFORCEMENT_LEVELS} reinforcement cycles for ${c.topic} without reaching ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery. Teacher Alert raised.`);
      await dbStore.addLog({
        id: 'LOG_' + Math.random().toString(36).substr(2, 9),
        title: 'Teacher Intervention Alert',
        message: `Student ${studentId} requires remedial teacher intervention for ${c.topic} (Completed ${MAX_REINFORCEMENT_LEVELS} cycles without reaching ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery).`,
        level: 'warn',
        timestamp: new Date().toISOString(),
        source: 'system'
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

  // Sort eligible concepts by lowest masteryPct (weakest first)
  eligibleConcepts.sort((a, b) => a.masteryPct - b.masteryPct);
  
  // Take top 3 weakest concepts at most
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
      reinforcementEligible: true,
      frequencyBand: c.masteryPct < REINF_EVERY_WORKSHEET_THRESHOLD ? 'every-worksheet (<40%)' : 'alternate-worksheet (40–79%)',
      eligibilityReason: `Eligible, but deferred (only top ${MAX_REINFORCEMENT_PER_WORKSHEET} weakest concepts reinforced per worksheet)`,
      questionsToInject: 0,
      reinforcementLevelsCompleted: c.reinforcementLevelsCompleted || 0,
      maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
      needsTeacherIntervention: false,
    });
  }

  const allFoundQs: Question[] = [];
  const selectedReinfTexts = new Set<string>();

  for (const targetConcept of targetConcepts) {
    if (!targetConcept.reinforcedQuestionIds) targetConcept.reinforcedQuestionIds = [];
    const triggerLvl = targetConcept.reinforcementTriggeredAtLevel || currentLevel;

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

    // Search levels from triggerLvl down to 1 for a fresh matching question
    for (let lvl = triggerLvl; lvl >= 1 && !foundQ; lvl--) {
      const levelQs = generateQuestionsForLevel(lvl, 0);
      const matching = levelQs.filter(q => q.topic.toLowerCase() === targetConcept.topic.toLowerCase());

      for (const mq of matching) {
        if (isUniqueCandidate(mq)) {
          foundQ = mq;
          break;
        }
      }
    }

    // Fallback: search currentLevel downwards if no fresh question found from triggerLvl
    if (!foundQ) {
      for (let lvl = currentLevel; lvl >= 1 && !foundQ; lvl--) {
        const levelQs = generateQuestionsForLevel(lvl, 0);
        const matching = levelQs.filter(q => q.topic.toLowerCase() === targetConcept.topic.toLowerCase());

        for (const mq of matching) {
          if (isUniqueCandidate(mq)) {
            foundQ = mq;
            break;
          }
        }
      }
    }

    const levelsCompleted = targetConcept.reinforcementLevelsCompleted || 0;
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

    console.log(`[Reinf Log] SELECTED: Reinforcement question on ${targetConcept.topic} for student ${studentId} (Cycle ${targetConcept.reinforcementLevelsCompleted} of ${MAX_REINFORCEMENT_LEVELS}, Mastery: ${targetConcept.masteryPct}%, Frequency: ${freqBand}).`);

    const formattedQ: Question = {
      ...foundQ,
      question_id: `reinf_${targetConcept.topic.replace(/\s+/g, '_')}_${Date.now()}_${allFoundQs.length}`,
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

  if (profileChanged) {
    profile.updatedAt = new Date().toISOString();
    await dbStore.upsertConceptMasteryProfile(profile);
  }

  debugInfo.totalReinforcementQuestions = allFoundQs.length;
  debugInfo.normalQuestionCount = WORKSHEET_TOTAL_QUESTIONS - allFoundQs.length;
  debugInfo.hasActiveReinforcement = debugInfo.weakConcepts.some(wc => wc.isReinforcementActive && wc.questionsToInject > 0);

  return { questions: allFoundQs, debugInfo };
}

/**
 * Returns reinforcement questions for active weak concepts. Wrapper around getReinforcementQuestionsWithDebug.
 */
export async function getReinforcementQuestions(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore,
  excludeTexts?: Set<string>,
  worksheetQuestionTexts?: Set<string>
): Promise<Question[]> {
  const { questions } = await getReinforcementQuestionsWithDebug(studentId, currentLevel, dbStore, excludeTexts, worksheetQuestionTexts);
  return questions;
}

/**
 * Structured debug snapshot of a student's reinforcement state.
 */
export async function getReinforcementDebugInfo(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore
): Promise<ReinforcementDebugInfo> {
  const { debugInfo } = await getReinforcementQuestionsWithDebug(studentId, currentLevel, dbStore);
  return debugInfo;
}

/** @deprecated Use getWorksheetComposition() instead for the new dynamic composition rules */
export function getReinforcementQuestionCount(masteryPct: number): number {
  if (masteryPct <= 75) return REINF_COUNT_WEAK;
  return 0;
}

export function mixWorksheetQuestions(currentQuestions: Question[], reinforcementQuestions: Question[]): Question[] {
  if (reinforcementQuestions.length === 0) return currentQuestions;

  // Safety dedup: filter out any reinforcement question whose text matches a normal question
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
