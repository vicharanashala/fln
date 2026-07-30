import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { DBStore } from '../src/db.js';
import { updateConceptMastery, getReinforcementQuestions, mixWorksheetQuestions, getReinforcementDebugInfo } from '../src/reinforcementEngine.js';
import { generateQuestionsForLevel } from '../src/levelGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runE2EVerification() {
  console.log('====================================================');
  console.log('Starting End-to-End Reinforcement Workflow Test');
  console.log('====================================================\n');

  const dbStore = new DBStore();
  await dbStore.init();
  const studentId = 'student_l15_test';
  const studentName = 'Aarav Sharma';
  
  // Create student at Assessed Level 15
  const student = {
    id: studentId,
    name: studentName,
    schoolId: 'school_1',
    classId: 'class_1',
    currentLevel: 15,
    currentSubLevel: 0,
    targetLevel: 16,
    levelHistory: [{ level: 15, subLevel: 0, date: '2026-07-24', reason: 'Assessed at Level 15' }],
    streak: 1
  };
  await dbStore.addStudent(student as any);

  // 1. Simulate Student completing Assessment at Level 15
  console.log('Step 1: Student completes Assessment at Level 15.');
  const assessmentQuestions = generateQuestionsForLevel(15, 0);
  console.log(`  Assessment Questions (Level 15): ${assessmentQuestions.map(q => q.topic).join(', ')}`);

  // Student gets 3 questions WRONG -> weak concept with 40% mastery
  const answers: Record<string, string> = {};
  assessmentQuestions.forEach((q, idx) => {
    const qId = `${studentId}_${q.question_id}`;
    q.question_id = qId;
    if (idx >= 1) {
      answers[qId] = 'WRONG_ANSWER'; // Incorrect answer -> 40% mastery
    } else {
      answers[qId] = q.answer; // Correct answer
    }
  });

  // 2. Evaluate Assessment at Level 15
  console.log('\nStep 2: Evaluating Level 15 Assessment.');
  await updateConceptMastery(studentId, assessmentQuestions, answers, dbStore);

  // Check Concept Mastery Profile
  const profile = await dbStore.getConceptMasteryProfile(studentId);
  console.log('  Updated Concept Mastery Profile:');
  profile?.concepts.forEach(c => {
    console.log(`    - Topic: ${c.topic} | Mastery: ${c.masteryPct}% | Active: ${c.isReinforcementActive} | Trigger Level: ${c.reinforcementTriggeredAtLevel}`);
  });

  // Advance student to Level 16 (immediate next level after assessment)
  const nextLevel = 16;
  await dbStore.updateStudent(studentId, { currentLevel: nextLevel });
  console.log(`\nStep 3: Student advances to Target Level ${nextLevel} (Level+1).`);

  // 3. Generate Worksheets across 3 consecutive levels (Level 16, 17, 18)
  const usedTexts = new Set<string>();
  assessmentQuestions.forEach(q => usedTexts.add(q.question.trim().toLowerCase()));

  for (let lvl = 16; lvl <= 18; lvl++) {
    console.log(`\nGenerating Worksheet for Level ${lvl} (Cycle Level ${lvl - 15} of 3)...`);
    await dbStore.updateStudent(studentId, { currentLevel: lvl });
    const reinfQs = await getReinforcementQuestions(studentId, lvl, dbStore, usedTexts);
    console.log(`  Reinforcement Questions Retrieved (${reinfQs.length}): ${reinfQs.map(q => q.question).join('; ')}`);
    reinfQs.forEach(q => usedTexts.add(q.question.trim().toLowerCase()));

    const newLvlQs = generateQuestionsForLevel(lvl, 0).slice(0, 4).map(q => ({
      ...q,
      question_id: `${studentId}_${q.question_id}`,
      question: `[For ${studentName} - L${lvl}.0] ${q.question}`
    }));
    const mappedReinf = reinfQs.map(q => ({
      ...q,
      question_id: `${studentId}_REINF_${q.question_id}`,
      question: `[For ${studentName}] [Reinforcement - ${q.topic}] ${q.question}`
    }));
    const finalQs = mixWorksheetQuestions(newLvlQs, mappedReinf);
    console.log(`  Level ${lvl} Total Questions: ${finalQs.length} (4 normal + ${reinfQs.length} reinf)`);
  }

  // 4. Check Level 19 (After 3 reinforcement levels completed without 70% score)
  console.log(`\nStep 6: Student advances to Level 19 (Completed 3 Reinforcement Levels).`);
  await dbStore.updateStudent(studentId, { currentLevel: 19 });
  const reinfQsL19 = await getReinforcementQuestions(studentId, 19, dbStore, usedTexts);
  const debugL19 = await getReinforcementDebugInfo(studentId, 19, dbStore);

  console.log(`  Level 19 Reinforcement Questions Retrieved: ${reinfQsL19.length} (Expected: 0 - Stopped)`);
  console.log(`  Teacher Intervention Alert Raised: ${debugL19.hasTeacherInterventionAlert ? 'YES ⚠️' : 'NO'}`);

  console.log('\n====================================================');
  console.log('VERIFICATION RESULTS:');
  console.log(`  3-Level Cycle Enforced: ${reinfQsL19.length === 0 ? 'YES' : 'NO'}`);
  console.log(`  Teacher Intervention Alert: ${debugL19.hasTeacherInterventionAlert ? 'YES (ALERT RAISED ⚠️)' : 'NO'}`);

  if (reinfQsL19.length === 0 && debugL19.hasTeacherInterventionAlert) {
    console.log('SUCCESS: Reinforcement Lifecycle (3-level cap & teacher alert) satisfied perfectly!');
  } else {
    console.error('FAILURE: Verification checks failed.');
  }
  console.log('====================================================\n');
}

runE2EVerification().catch(console.error);
