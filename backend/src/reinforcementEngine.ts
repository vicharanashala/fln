import { DBStore, Question } from './db';
import {
  ConceptMasteryProfile,
  STRONG_THRESHOLD,
  SATISFACTORY_THRESHOLD,
  ROLLING_WEIGHT_LATEST,
  REINF_COUNT_NEEDS_PRACTICE,
  REINF_COUNT_SATISFACTORY,
  REINF_COUNT_VERIFICATION
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

      // Check Trigger Rule: >3 questions wrong in a concept (more than 3 wrong)
      const wrongCount = concept.recentAnswers.filter(a => !a.correct).length;
      if (wrongCount > 3) {
        if (!concept.isReinforcementActive) {
          concept.isReinforcementActive = true;
          concept.reinforcementTriggeredAtLevel = currentStudentLevel;
          concept.consecutiveReinforcementMasteryCount = 0;
          concept.reinforcedQuestionIds = [];
          concept.reinforcementCyclesCompleted = 0;
          console.log(`[Reinf Log] TRIGGERED: Student ${studentId} triggered reinforcement for ${topic}. Got ${wrongCount}/${concept.recentAnswers.length} wrong. Trigger level: ${currentStudentLevel}.`);
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
      if (accuracyReinf >= 0.8) {
        concept.consecutiveReinforcementMasteryCount++;
        console.log(`[Reinf Log] REINFORCEMENT MASTERY ACHIEVED: Student ${studentId} achieved ${Math.round(accuracyReinf*100)}% on reinforcement worksheet for ${topic}.`);
      } else {
        concept.consecutiveReinforcementMasteryCount = 0;
        console.log(`[Reinf Log] REINFORCEMENT MASTERY FAILED: Student ${studentId} got ${stats.reinfCorrect}/${stats.reinfTotal} correct (${Math.round(accuracyReinf*100)}%) on reinforcement for ${topic}.`);
      }

      // Check Stop Rule: Stop after 80% mastery in ONE reinforcement worksheet or 3 cycles
      if (accuracyReinf >= 0.8 || (concept.reinforcementCyclesCompleted && concept.reinforcementCyclesCompleted >= 3)) {
        concept.isReinforcementActive = false;
        concept.consecutiveReinforcementMasteryCount = 0;
        // Also clear recent answers so they don't immediately re-trigger reinforcement
        concept.recentAnswers = [];
        const stopReason = accuracyReinf >= 0.8 ? '80% mastery achieved' : 'completed 3 cycles';
        console.log(`[Reinf Log] STOPPED: Reinforcement stopped for student ${studentId} on concept ${topic} because: ${stopReason}.`);
        await dbStore.addLog({
          id: 'LOG_' + Math.random().toString(36).substr(2, 9),
          title: 'Reinforcement Stopped',
          message: `Reinforcement stopped for student ${studentId} on concept ${topic} (${stopReason}).`,
          level: 'info',
          timestamp: nowStr,
          source: 'system'
        });
      }
    }

    concept.lastAssessedAt = nowStr;
  }

  profile.updatedAt = nowStr;
  
  // 4. Persist updated profile
  await dbStore.upsertConceptMasteryProfile(profile);
  return profile;
}

/**
 * Returns reinforcement questions for concepts the student has active reinforcement for.
 * Reinforcement questions start after skipping one level (not immediately).
 */
export async function getReinforcementQuestions(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore
): Promise<Question[]> {
  const profile = await dbStore.getConceptMasteryProfile(studentId);
  if (!profile) {
    console.log(`[Reinf Log] Student ${studentId} has no concept mastery profile. No reinforcement.`);
    return [];
  }

  // Filter active reinforcement concepts
  const activeConcepts = profile.concepts.filter(c => c.isReinforcementActive);
  
  if (activeConcepts.length === 0) {
    console.log(`[Reinf Log] Student ${studentId} has no active reinforcement concepts.`);
    return [];
  }

  const reinforcementQuestions: Question[] = [];

  for (const concept of activeConcepts) {
    const triggerLvl = concept.reinforcementTriggeredAtLevel || currentLevel;
    
    if (currentLevel < triggerLvl + 2 || currentLevel > triggerLvl + 4) {
      console.log(`[Reinf Log] OUTSIDE WINDOW: Reinforcement for ${studentId} on ${concept.topic} is inactive at level ${currentLevel}; eligible levels are ${triggerLvl + 2}-${triggerLvl + 4}.`);
      continue;
    }

    const targetCount = getReinforcementQuestionCount(concept.masteryPct);
    if (targetCount === 0) continue;
    const foundQs: Question[] = [];
    
    if (!concept.reinforcedQuestionIds) concept.reinforcedQuestionIds = [];
    if (concept.reinforcementCyclesCompleted === undefined) concept.reinforcementCyclesCompleted = 0;

    // Search levels starting from triggerLvl downwards
    for (let lvl = triggerLvl; lvl >= 1 && foundQs.length < targetCount; lvl--) {
      const levelQs = generateQuestionsForLevel(lvl, 0); // Always retrieve subLevel 0 (Mastery) for reinforcement
      const matching = levelQs.filter(q => q.topic.toLowerCase() === concept.topic.toLowerCase());
      
      for (const mq of matching) {
        if (foundQs.length < targetCount && 
            !foundQs.some(fq => fq.question === mq.question) && 
            !concept.reinforcedQuestionIds.includes(mq.question_id)) {
          foundQs.push(mq);
        }
      }
    }

    if (foundQs.length < targetCount) {
      // Fallback: search up to currentLevel downwards
      for (let lvl = currentLevel; lvl >= 1 && foundQs.length < targetCount; lvl--) {
        const levelQs = generateQuestionsForLevel(lvl, 0);
        const matching = levelQs.filter(q => q.topic.toLowerCase() === concept.topic.toLowerCase());
        
        for (const mq of matching) {
          if (foundQs.length < targetCount && 
              !foundQs.some(fq => fq.question === mq.question) && 
              !concept.reinforcedQuestionIds.includes(mq.question_id)) {
            foundQs.push(mq);
          }
        }
      }
    }

    if (foundQs.length > 0) {
      console.log(`[Reinf Log] SELECTED: Selected ${foundQs.length} reinforcement questions on ${concept.topic} for student ${studentId} at current level ${currentLevel} (triggered at level ${triggerLvl}).`);
      
      foundQs.forEach((q, idx) => {
        reinforcementQuestions.push({
          ...q,
          question_id: `reinf_${concept.topic.replace(/\s+/g, '_')}_${idx}_${Date.now()}`,
          subtopic: 'Reinforcement',
          difficulty: 'medium',
          question: `[REINFORCEMENT] (Weak Concept: ${concept.topic} | Score: ${concept.masteryPct}% - ${concept.status} | Cycle: ${concept.reinforcementCyclesCompleted! + 1}/3 | Target Level: L${triggerLvl + 2}) ${q.question}`
        });
      });

      concept.reinforcedQuestionIds.push(...foundQs.map(q => q.question_id));
      concept.reinforcementCyclesCompleted++;
      
      await dbStore.addLog({
        id: 'LOG_' + Math.random().toString(36).substr(2, 9),
        title: 'Reinforcement Cycle Started',
        message: `Student ${studentId} started cycle ${concept.reinforcementCyclesCompleted} for ${concept.topic} (Level ${currentLevel}).`,
        level: 'info',
        timestamp: new Date().toISOString(),
        source: 'system'
      });
    }
  }

  if (reinforcementQuestions.length > 0) {
    // Persist changes to profile
    profile.updatedAt = new Date().toISOString();
    await dbStore.upsertConceptMasteryProfile(profile);
  }

  return reinforcementQuestions;
}

export function getReinforcementQuestionCount(masteryPct: number): number {
  if (masteryPct < 30) return REINF_COUNT_NEEDS_PRACTICE;
  if (masteryPct <= 50) return REINF_COUNT_SATISFACTORY;
  if (masteryPct <= 70) return REINF_COUNT_VERIFICATION;
  return 0;
}

export function mixWorksheetQuestions(currentQuestions: Question[], reinforcementQuestions: Question[]): Question[] {
  if (reinforcementQuestions.length === 0) return currentQuestions;
  const mixed: Question[] = [];
  const reinforcementEvery = Math.max(1, Math.ceil(currentQuestions.length / (reinforcementQuestions.length + 1)));
  let reinforcementIndex = 0;

  currentQuestions.forEach((question, index) => {
    mixed.push(question);
    if ((index + 1) % reinforcementEvery === 0 && reinforcementIndex < reinforcementQuestions.length) {
      mixed.push(reinforcementQuestions[reinforcementIndex++]);
    }
  });

  while (reinforcementIndex < reinforcementQuestions.length) {
    mixed.push(reinforcementQuestions[reinforcementIndex++]);
  }
  return mixed;
}
