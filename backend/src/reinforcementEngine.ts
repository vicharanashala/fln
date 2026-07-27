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
      if (concept.masteryPct >= REINFORCEMENT_MASTERY_THRESHOLD && concept.isReinforcementActive) {
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
 * Determines how many weak concepts are eligible for reinforcement on this worksheet,
 * respecting frequency rules:
 * - Score <40%  → reinforce EVERY worksheet
 * - Score 40–69% → reinforce every ALTERNATE worksheet
 * - Score ≥80%  → stop reinforcement (already handled by trigger/stop rules)
 */
function shouldReinforceConcept(concept: ConceptScore): boolean {
  if (!concept.isReinforcementActive) return false;

  const mastery = concept.masteryPct;

  // Score ≥80%: reinforcement should already be inactive, but guard here too
  if (mastery >= REINFORCEMENT_MASTERY_THRESHOLD) return false;

  // Score <40%: reinforce every worksheet
  if (mastery < REINF_EVERY_WORKSHEET_THRESHOLD) return true;

  // Score 40–69%: reinforce every alternate worksheet
  if (mastery < REINF_ALTERNATE_WORKSHEET_THRESHOLD) {
    // If last worksheet was skipped → reinforce this time
    // If last worksheet was reinforced → skip this time
    if (concept.lastReinforcementSkipped === true) {
      return true;  // Was skipped last time, so reinforce now
    } else {
      return false; // Was reinforced last time (or first time), so skip now
    }
  }

  // Score 70–79%: still below 80%, reinforce every worksheet
  return true;
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
 * Returns reinforcement questions for active weak concepts.
 * 
 * Rules:
 * - One reinforcement question per eligible weak concept (up to 3).
 * - Concepts are sorted by lowest masteryPct (weakest first).
 * - Frequency depends on mastery:
 *     <40%  → every worksheet
 *     40–69% → every alternate worksheet
 *     ≥80%  → stop reinforcement
 * - Questions must be unique within the same worksheet (no duplicates with normal questions).
 * - Non-repeating fresh question variants across worksheets.
 * - Maximum of 3 reinforcement cycles per concept.
 * - If still weak (<80%) after 3 cycles, stop reinforcement & raise Teacher Alert.
 */
export async function getReinforcementQuestions(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore,
  excludeTexts?: Set<string>,
  worksheetQuestionTexts?: Set<string>
): Promise<Question[]> {
  const profile = await dbStore.getConceptMasteryProfile(studentId);
  if (!profile) {
    console.log(`[Reinf Log] Student ${studentId} has no concept mastery profile. No reinforcement.`);
    return [];
  }

  let profileChanged = false;
  const eligibleConcepts: ConceptScore[] = [];
  const skippedConcepts: ConceptScore[] = [];

  for (const c of profile.concepts) {
    if (!c.isReinforcementActive) continue;

    // Initialize tracking field
    if (c.lastReinforcementSkipped === undefined) c.lastReinforcementSkipped = false;

    const levelsCompleted = c.reinforcementLevelsCompleted || 0;

    // Rule: Maximum 3 reinforcement cycles
    if (levelsCompleted >= MAX_REINFORCEMENT_LEVELS) {
      c.isReinforcementActive = false;
      if (c.masteryPct < REINFORCEMENT_MASTERY_THRESHOLD) {
        c.needsTeacherIntervention = true;
        console.log(`[Reinf Log] TEACHER ALERT: Student ${studentId} completed ${MAX_REINFORCEMENT_LEVELS} reinforcement cycles for ${c.topic} without reaching ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery. Teacher Alert raised.`);
        await dbStore.addLog({
          id: 'LOG_' + Math.random().toString(36).substr(2, 9),
          title: 'Teacher Intervention Alert',
          message: `Student ${studentId} requires remedial teacher intervention for ${c.topic} (Completed ${MAX_REINFORCEMENT_LEVELS} cycles without reaching ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery).`,
          level: 'warn',
          timestamp: new Date().toISOString(),
          source: 'system'
        });
      } else {
        c.needsTeacherIntervention = false;
        console.log(`[Reinf Log] REINFORCEMENT CYCLE COMPLETE: Student ${studentId} completed ${MAX_REINFORCEMENT_LEVELS} reinforcement cycles for ${c.topic} with satisfactory progress.`);
      }
      profileChanged = true;
    } else if (shouldReinforceConcept(c)) {
      eligibleConcepts.push(c);
    } else {
      // This concept is in the "alternate" band and being skipped this worksheet
      skippedConcepts.push(c);
    }
  }

  // Update the "skipped" flag for alternate-frequency tracking
  for (const c of skippedConcepts) {
    c.lastReinforcementSkipped = true;
    profileChanged = true;
  }

  if (profileChanged) {
    profile.updatedAt = new Date().toISOString();
    await dbStore.upsertConceptMasteryProfile(profile);
  }

  if (eligibleConcepts.length === 0) {
    console.log(`[Reinf Log] Student ${studentId} has no eligible reinforcement concepts for this worksheet.`);
    return [];
  }

  // Sort eligible concepts by lowest masteryPct to target the weakest first
  eligibleConcepts.sort((a, b) => a.masteryPct - b.masteryPct);
  
  // Take top 3 weakest concepts at most
  const targetConcepts = eligibleConcepts.slice(0, MAX_REINFORCEMENT_PER_WORKSHEET);
  
  const allFoundQs: Question[] = [];

  // Track all question texts we've already selected to avoid inter-reinforcement duplicates
  const selectedReinfTexts = new Set<string>();

  for (const targetConcept of targetConcepts) {
    if (!targetConcept.reinforcedQuestionIds) targetConcept.reinforcedQuestionIds = [];
    const triggerLvl = targetConcept.reinforcementTriggeredAtLevel || currentLevel;

    /**
     * Helper: checks whether a candidate question is unique against all exclusion lists:
     *   1. Historically excluded texts (excludeTexts — cross-worksheet)
     *   2. Normal questions in the SAME worksheet (worksheetQuestionTexts — intra-worksheet)
     *   3. Other reinforcement questions already selected in this call
     *   4. Previously used reinforcement question IDs/texts for this concept
     */
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

    if (!foundQ) {
      console.log(`[Reinf Log] Could not find unique reinforcement question for ${targetConcept.topic}. All candidates duplicated existing questions.`);
      continue;
    }

    const cleanQText = foundQ.question.trim().toLowerCase();
    
    // Track this selection
    selectedReinfTexts.add(cleanQText);
    targetConcept.reinforcedQuestionIds.push(foundQ.question_id, cleanQText);
    targetConcept.reinforcementLevelsCompleted = (targetConcept.reinforcementLevelsCompleted || 0) + 1;
    // Mark that this concept was reinforced (not skipped) for alternate tracking
    targetConcept.lastReinforcementSkipped = false;

    const frequencyBand = targetConcept.masteryPct < REINF_EVERY_WORKSHEET_THRESHOLD 
      ? 'every-worksheet (<40%)' 
      : targetConcept.masteryPct < REINF_ALTERNATE_WORKSHEET_THRESHOLD 
        ? 'alternate-worksheet (40-69%)' 
        : 'every-worksheet (70-79%)';

    console.log(`[Reinf Log] SELECTED: Reinforcement question on ${targetConcept.topic} for student ${studentId} (Cycle ${targetConcept.reinforcementLevelsCompleted} of ${MAX_REINFORCEMENT_LEVELS}, Mastery: ${targetConcept.masteryPct}%, Frequency: ${frequencyBand}). Verified unique against ${worksheetQuestionTexts?.size ?? 0} normal + ${selectedReinfTexts.size - 1} other reinforcement questions.`);

    const formattedQ: Question = {
      ...foundQ,
      question_id: `reinf_${targetConcept.topic.replace(/\s+/g, '_')}_${Date.now()}_${allFoundQs.length}`,
      subtopic: 'Reinforcement',
      difficulty: 'medium',
      question: foundQ.question
    };

    allFoundQs.push(formattedQ);
  }

  // Persist updated profile with tracking data
  profile.updatedAt = new Date().toISOString();
  await dbStore.upsertConceptMasteryProfile(profile);

  console.log(`[Reinf Log] Total reinforcement questions for student ${studentId}: ${allFoundQs.length} (from ${targetConcepts.length} weak concepts).`);
  return allFoundQs;
}

/** @deprecated Use getWorksheetComposition() instead for the new dynamic composition rules */
export function getReinforcementQuestionCount(masteryPct: number): number {
  if (masteryPct <= 75) return REINF_COUNT_WEAK; // Legacy: 1 extra reinforcement question for mastery <= 75%
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
    normalQuestionCount: WORKSHEET_TOTAL_QUESTIONS,
    hasActiveReinforcement: false,
    hasTeacherInterventionAlert: false,
  };

  if (!profile) return debug;

  let eligibleCount = 0;

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
    let frequencyBand = 'none';

    if (!isActive) {
      if (needsAlert) {
        reason = `${MAX_REINFORCEMENT_LEVELS} reinforcement cycles completed without ${REINFORCEMENT_MASTERY_THRESHOLD}% mastery — Teacher Alert Raised`;
      } else {
        reason = 'Reinforcement not active for this concept';
      }
    } else if (levelsCompleted >= MAX_REINFORCEMENT_LEVELS) {
      reason = `Max ${MAX_REINFORCEMENT_LEVELS} cycles reached — will stop on next evaluation`;
    } else {
      const wouldReinforce = shouldReinforceConcept(concept);
      if (wouldReinforce) {
        eligible = true;
        if (concept.masteryPct < REINF_EVERY_WORKSHEET_THRESHOLD) {
          frequencyBand = 'every-worksheet (<40%)';
        } else if (concept.masteryPct < REINF_ALTERNATE_WORKSHEET_THRESHOLD) {
          frequencyBand = 'alternate-worksheet (40-69%)';
        } else {
          frequencyBand = 'every-worksheet (70-79%)';
        }
        reason = `Reinforcement active: Cycle ${levelsCompleted + 1} of ${MAX_REINFORCEMENT_LEVELS}, Frequency: ${frequencyBand}`;
      } else {
        frequencyBand = 'alternate-worksheet (40-69%) — SKIPPED this worksheet';
        reason = `Reinforcement active but skipped this worksheet (alternate frequency, mastery ${concept.masteryPct}%)`;
      }
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
        frequencyBand,
        eligibilityReason: reason,
        questionsToInject: qCount,
        reinforcementLevelsCompleted: levelsCompleted,
        maxReinforcementLevels: MAX_REINFORCEMENT_LEVELS,
        needsTeacherIntervention: needsAlert,
      });

      if (eligible && qCount > 0) {
        eligibleCount++;
        debug.hasActiveReinforcement = true;
      }
    }
  }

  const { normalCount, reinfCount } = getWorksheetComposition(eligibleCount);
  debug.totalReinforcementQuestions = reinfCount;
  debug.normalQuestionCount = normalCount;

  return debug;
}
