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
  MAX_REINFORCEMENT_PER_WORKSHEET
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

      // Legacy status updating (keeps compatibility with status queries)
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
      // Keep only last 5
      if (concept.recentAnswers.length > 5) {
        concept.recentAnswers = concept.recentAnswers.slice(-5);
      }

      // Check Trigger Rule: any wrong answers in regular attempts or mastery <= 75%
      const wrongCount = concept.recentAnswers.filter(a => !a.correct).length;
      if (wrongCount > 0 || concept.masteryPct <= 75) {
        if (!concept.isReinforcementActive && !concept.needsTeacherIntervention) {
          concept.isReinforcementActive = true;
          concept.reinforcementTriggeredAtLevel = currentStudentLevel;
          concept.reinforcementStartLevel = currentStudentLevel;
          concept.reinforcementLevelsCompleted = 0;
          concept.needsTeacherIntervention = false;
          concept.consecutiveReinforcementMasteryCount = 0;
          concept.reinforcedQuestionIds = [];
          concept.reinforcementCyclesCompleted = 0;
          console.log(`[Reinf Log] TRIGGERED: Student ${studentId} triggered reinforcement for ${topic}. Got ${wrongCount}/${concept.recentAnswers.length} wrong (Mastery: ${concept.masteryPct}%). Trigger level: ${currentStudentLevel}.`);
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
    }

    // Process Reinforcement Attempts
    if (stats.reinfTotal > 0) {
      const accuracyReinf = stats.reinfCorrect / stats.reinfTotal;
      const accuracyPct = Math.round(accuracyReinf * 100);

      // Rule: Early Mastery Stop (Score >= 70%)
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
 * Returns reinforcement questions for active weak concepts.
 * Rules:
 * - Exactly 1 reinforcement question per worksheet from the student's weakest concept.
 * - Non-repeating fresh question variants.
 * - Maximum of 3 consecutive levels per reinforcement cycle.
 * - If still weak (<70%) after 3 levels, stop reinforcement & raise Teacher Alert.
 */
export async function getReinforcementQuestions(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore,
  excludeTexts?: Set<string>
): Promise<Question[]> {
  const profile = await dbStore.getConceptMasteryProfile(studentId);
  if (!profile) {
    console.log(`[Reinf Log] Student ${studentId} has no concept mastery profile. No reinforcement.`);
    return [];
  }

  let profileChanged = false;
  const eligibleConcepts: ConceptScore[] = [];

  for (const c of profile.concepts) {
    if (!c.isReinforcementActive) continue;

    const startLvl = c.reinforcementStartLevel || c.reinforcementTriggeredAtLevel || currentLevel;
    const levelsCompleted = c.reinforcementLevelsCompleted || 0;

    // Rule: Maximum 3 consecutive reinforcement levels
    if (levelsCompleted >= MAX_REINFORCEMENT_LEVELS) {
      c.isReinforcementActive = false;
      if (c.masteryPct < REINFORCEMENT_MASTERY_THRESHOLD) {
        c.needsTeacherIntervention = true;
        console.log(`[Reinf Log] TEACHER ALERT: Student ${studentId} completed 3 reinforcement levels for ${c.topic} without reaching 70% mastery. Teacher Alert raised.`);
        await dbStore.addLog({
          id: 'LOG_' + Math.random().toString(36).substr(2, 9),
          title: 'Teacher Intervention Alert',
          message: `Student ${studentId} requires remedial teacher intervention for ${c.topic} (Completed 3 levels without reaching 70% mastery).`,
          level: 'warn',
          timestamp: new Date().toISOString(),
          source: 'system'
        });
      } else {
        c.needsTeacherIntervention = false;
        console.log(`[Reinf Log] REINFORCEMENT CYCLE COMPLETE: Student ${studentId} completed 3 reinforcement levels for ${c.topic} with satisfactory progress.`);
      }
      profileChanged = true;
    } else {
      eligibleConcepts.push(c);
    }
  }

  if (profileChanged) {
    profile.updatedAt = new Date().toISOString();
    await dbStore.upsertConceptMasteryProfile(profile);
  }

  if (eligibleConcepts.length === 0) {
    console.log(`[Reinf Log] Student ${studentId} has no eligible reinforcement concepts.`);
    return [];
  }

  // Sort eligible active concepts by lowest masteryPct to target the weakest concept first
  eligibleConcepts.sort((a, b) => a.masteryPct - b.masteryPct);
  const targetConcept = eligibleConcepts[0];

  if (!targetConcept.reinforcedQuestionIds) targetConcept.reinforcedQuestionIds = [];
  const triggerLvl = targetConcept.reinforcementTriggeredAtLevel || currentLevel;

  const foundQs: Question[] = [];

  // Search levels from triggerLvl down to 1 for a fresh matching question
  for (let lvl = triggerLvl; lvl >= 1 && foundQs.length < 1; lvl--) {
    const levelQs = generateQuestionsForLevel(lvl, 0);
    const matching = levelQs.filter(q => q.topic.toLowerCase() === targetConcept.topic.toLowerCase());

    for (const mq of matching) {
      const cleanText = mq.question.trim().toLowerCase();
      if (!foundQs.some(fq => fq.question === mq.question) && 
          (!excludeTexts || !excludeTexts.has(cleanText)) &&
          !targetConcept.reinforcedQuestionIds.includes(mq.question_id) &&
          !targetConcept.reinforcedQuestionIds.includes(cleanText)) {
        foundQs.push(mq);
        break;
      }
    }
  }

  // Fallback: search currentLevel downwards if no fresh question found in triggerLvl
  if (foundQs.length < 1) {
    for (let lvl = currentLevel; lvl >= 1 && foundQs.length < 1; lvl--) {
      const levelQs = generateQuestionsForLevel(lvl, 0);
      const matching = levelQs.filter(q => q.topic.toLowerCase() === targetConcept.topic.toLowerCase());

      for (const mq of matching) {
        const cleanText = mq.question.trim().toLowerCase();
        if (!foundQs.some(fq => fq.question === mq.question) && 
            (!excludeTexts || !excludeTexts.has(cleanText)) &&
            !targetConcept.reinforcedQuestionIds.includes(mq.question_id) &&
            !targetConcept.reinforcedQuestionIds.includes(cleanText)) {
          foundQs.push(mq);
          break;
        }
      }
    }
  }

  if (foundQs.length === 0) {
    console.log(`[Reinf Log] Could not find un-used reinforcement question for ${targetConcept.topic}.`);
    return [];
  }

  const selectedQ = foundQs[0];
  const cleanQText = selectedQ.question.trim().toLowerCase();
  
  targetConcept.reinforcedQuestionIds.push(selectedQ.question_id, cleanQText);
  targetConcept.reinforcementLevelsCompleted = (targetConcept.reinforcementLevelsCompleted || 0) + 1;

  console.log(`[Reinf Log] SELECTED: Selected 1 reinforcement question on ${targetConcept.topic} for student ${studentId} (Level ${targetConcept.reinforcementLevelsCompleted} of ${MAX_REINFORCEMENT_LEVELS}).`);

  profile.updatedAt = new Date().toISOString();
  await dbStore.upsertConceptMasteryProfile(profile);

  const formattedQ: Question = {
    ...selectedQ,
    question_id: `reinf_${targetConcept.topic.replace(/\s+/g, '_')}_${Date.now()}`,
    subtopic: 'Reinforcement',
    difficulty: 'medium',
    question: selectedQ.question
  };

  return [formattedQ];
}

export function getReinforcementQuestionCount(masteryPct: number): number {
  if (masteryPct <= 75) return REINF_COUNT_WEAK; // 1 extra reinforcement question for mastery <= 75%
  return 0;
}

export function mixWorksheetQuestions(currentQuestions: Question[], reinforcementQuestions: Question[]): Question[] {
  if (reinforcementQuestions.length === 0) return currentQuestions;
  return [...currentQuestions, ...reinforcementQuestions];
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
    eligibilityReason: string;
    questionsToInject: number;
    reinforcementLevelsCompleted: number;
    maxReinforcementLevels: number;
    needsTeacherIntervention: boolean;
  }>;
  totalReinforcementQuestions: number;
  hasActiveReinforcement: boolean;
  hasTeacherInterventionAlert: boolean;
}

export async function getReinforcementDebugInfo(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore
): Promise<ReinforcementDebugInfo> {
  const profile = await dbStore.getConceptMasteryProfile(studentId);

  const debug: ReinforcementDebugInfo = {
    studentId,
    currentLevel,
    weakConcepts: [],
    totalReinforcementQuestions: 0,
    hasActiveReinforcement: false,
    hasTeacherInterventionAlert: false,
  };

  if (!profile) return debug;

  for (const concept of profile.concepts) {
    const triggerLvl = concept.reinforcementTriggeredAtLevel || currentLevel;
    const isActive = concept.isReinforcementActive || false;
    const levelsCompleted = concept.reinforcementLevelsCompleted || 0;
    const needsAlert = concept.needsTeacherIntervention || false;

    if (needsAlert) {
      debug.hasTeacherInterventionAlert = true;
    }

    let eligible = false;
    let reason = '';

    if (!isActive) {
      if (needsAlert) {
        reason = `3 reinforcement levels completed without 70% mastery — Teacher Alert Raised`;
      } else {
        reason = 'Reinforcement not active for this concept';
      }
    } else {
      eligible = true;
      reason = `Reinforcement active: Level ${levelsCompleted + 1} of ${MAX_REINFORCEMENT_LEVELS}`;
    }

    if (concept.masteryPct < STRONG_THRESHOLD || isActive || needsAlert) {
      const qCount = eligible ? 1 : 0;
      debug.weakConcepts.push({
        topic: concept.topic,
        masteryPct: Math.round(concept.masteryPct * 10) / 10,
        status: concept.status,
        isReinforcementActive: isActive,
        reinforcementTriggeredAtLevel: triggerLvl,
        nextReinforcementLevel: isActive ? currentLevel : null,
        reinforcementEligible: eligible,
        eligibilityReason: reason,
        questionsToInject: qCount,
        reinforcementLevelsCompleted: levelsCompleted,
        maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
        needsTeacherIntervention: needsAlert,
      });

      if (eligible && qCount > 0) {
        debug.totalReinforcementQuestions += qCount;
        debug.hasActiveReinforcement = true;
      }
    }
  }

  if (debug.totalReinforcementQuestions > MAX_REINFORCEMENT_PER_WORKSHEET) {
    debug.totalReinforcementQuestions = MAX_REINFORCEMENT_PER_WORKSHEET;
  }

  return debug;
}
