import { DBStore, Question } from './db';
import {
  ConceptMasteryProfile,
  ConceptScore,
  STRONG_THRESHOLD,
  SATISFACTORY_THRESHOLD,
  MASTERY_CONSECUTIVE_THRESHOLD,
  ROLLING_WEIGHT_LATEST,
  REINF_COUNT_NEEDS_PRACTICE,
  REINF_COUNT_SATISFACTORY,
  REINF_COUNT_VERIFICATION
} from './conceptMastery';
import { generateQuestionsForLevel } from './levelGenerator';

/**
 * Updates a student's cumulative concept mastery profile based on the results of an assessment.
 * Calculates rolling average accuracy for each topic and updates consecutive mastery counters.
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

  // 2. Count attempts and correct answers per topic in the latest assessment
  const topicStats: { [topic: string]: { total: number; correct: number } } = {};
  
  questions.forEach(q => {
    const topic = q.topic || 'Number Sense';
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    
    topicStats[topic].total++;
    
    const submitted = (answers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    if (submitted === correct) {
      topicStats[topic].correct++;
    }
  });

  const nowStr = new Date().toISOString();

  // 3. Update the rolling mastery metrics
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
        consecutiveMasteryCount: 0
      };
      profile.concepts.push(concept);
    }

    const accuracyLatest = (stats.correct / stats.total) * 100;
    const oldMasteryPct = concept.masteryPct;
    
    // Update cumulative stats
    concept.totalAttempts += stats.total;
    concept.correctCount += stats.correct;
    
    // Rolling mastery formula: weighted average biased towards recent performance
    if (concept.totalAttempts === stats.total) {
      concept.masteryPct = Math.round(accuracyLatest);
    } else {
      concept.masteryPct = Math.round(
        (accuracyLatest * ROLLING_WEIGHT_LATEST) + 
        (oldMasteryPct * (1 - ROLLING_WEIGHT_LATEST))
      );
    }

    // Determine status and consecutive mastery counts
    const prevStatus = concept.status;
    if (concept.masteryPct >= STRONG_THRESHOLD) {
      concept.status = 'Strong';
      // Only increment if they were strong or this is a new mastery achievement
      concept.consecutiveMasteryCount = (prevStatus === 'Strong') 
        ? concept.consecutiveMasteryCount + 1 
        : 1;
    } else {
      if (concept.masteryPct >= SATISFACTORY_THRESHOLD) {
        concept.status = 'Satisfactory';
      } else {
        concept.status = 'Needs Practice';
      }
      concept.consecutiveMasteryCount = 0;
    }

    concept.lastAssessedAt = nowStr;
  }

  profile.updatedAt = nowStr;
  
  // 4. Persist updated profile
  await dbStore.upsertConceptMasteryProfile(profile);
  return profile;
}

/**
 * Returns reinforcement questions for concepts the student has not yet mastered.
 * More questions are generated for weaker concepts, tapering off to zero once mastered.
 */
export async function getReinforcementQuestions(
  studentId: string,
  currentLevel: number,
  dbStore: DBStore
): Promise<Question[]> {
  const profile = await dbStore.getConceptMasteryProfile(studentId);
  console.log(`[Reinf] Profile for ${studentId}:`, profile ? 'Found' : 'NULL');
  if (!profile) {
    return [];
  }

  // Filter for concepts that require practice/verification
  const weakConcepts = profile.concepts.filter(c => 
    c.status !== 'Strong' || c.consecutiveMasteryCount < MASTERY_CONSECUTIVE_THRESHOLD
  );
  console.log(`[Reinf] Weak concepts for ${studentId}:`, weakConcepts.length);

  if (weakConcepts.length === 0) {
    return [];
  }

  const reinforcementQuestions: Question[] = [];

  for (const concept of weakConcepts) {
    let targetCount = 0;
    if (concept.status === 'Needs Practice') {
      targetCount = REINF_COUNT_NEEDS_PRACTICE;
    } else if (concept.status === 'Satisfactory') {
      targetCount = REINF_COUNT_SATISFACTORY;
    } else if (concept.status === 'Strong') {
      targetCount = REINF_COUNT_VERIFICATION;
    }

    if (targetCount <= 0) continue;

    const foundQs: Question[] = [];
    
    // Traverse downwards from student's current level to find appropriate questions.
    // Try to match the sublevel (0 = Mastery, 1 = Easier, 2 = Remedial) with their mastery tier.
    const subLvl = concept.status === 'Needs Practice' ? 2 : concept.status === 'Satisfactory' ? 1 : 0;

    for (let lvl = currentLevel; lvl >= 1 && foundQs.length < targetCount; lvl--) {
      const levelQs = generateQuestionsForLevel(lvl, subLvl);
      const matching = levelQs.filter(q => q.topic.toLowerCase() === concept.topic.toLowerCase());
      
      console.log(`[Reinf] Level ${lvl} subLvl ${subLvl}, topic '${concept.topic}', levelQs=${levelQs.length}, matching=${matching.length}`);
      
      for (const mq of matching) {
        if (foundQs.length < targetCount && !foundQs.some(fq => fq.question === mq.question)) {
          foundQs.push(mq);
        }
      }
    }

    // Fallback: search subLevel 0 (mastery) if still short of targetCount
    if (foundQs.length < targetCount) {
      for (let lvl = currentLevel; lvl >= 1 && foundQs.length < targetCount; lvl--) {
        const levelQs = generateQuestionsForLevel(lvl, 0);
        const matching = levelQs.filter(q => q.topic.toLowerCase() === concept.topic.toLowerCase());
        
        for (const mq of matching) {
          if (foundQs.length < targetCount && !foundQs.some(fq => fq.question === mq.question)) {
            foundQs.push(mq);
          }
        }
      }
    }

    // Tag and suffix the found questions for clear reinforcement identification
    foundQs.forEach((q, idx) => {
      reinforcementQuestions.push({
        ...q,
        question_id: `reinf_${concept.topic.replace(/\s+/g, '_')}_${idx}_${Date.now()}`,
        subtopic: 'Reinforcement',
        difficulty: concept.status === 'Needs Practice' ? 'easy' : 'medium'
      });
    });
  }

  return reinforcementQuestions;
}
