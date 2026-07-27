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

  // Student gets 'Number Operations' question WRONG, and 'Number Sense' correct
  const answers: Record<string, string> = {};
  assessmentQuestions.forEach((q, idx) => {
    const qId = `${studentId}_${q.question_id}`;
    q.question_id = qId;
    if (q.topic.toLowerCase().includes('operations') || idx === 1) {
      answers[qId] = 'WRONG_ANSWER'; // Incorrect answer -> weak concept
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

  // 3. Generate Next Worksheet for Level 16
  console.log(`\nStep 4: Generating next worksheet for Level ${nextLevel}.`);
  const usedTexts = new Set<string>();
  assessmentQuestions.forEach(q => usedTexts.add(q.question.trim().toLowerCase()));

  const debugInfo = await getReinforcementDebugInfo(studentId, nextLevel, dbStore);
  console.log('  Debug Info for Verification Panel:');
  console.log(`    Current Level: L${debugInfo.currentLevel}`);
  console.log(`    Total Reinf Qs: ${debugInfo.totalReinforcementQuestions}`);
  debugInfo.weakConcepts.forEach(wc => {
    console.log(`    Weak Concept: ${wc.topic} | Eligible: ${wc.reinforcementEligible} | Inject: ${wc.questionsToInject} Qs | Next Reinf Lvl: L${wc.nextReinforcementLevel}`);
  });

  const reinfQs = await getReinforcementQuestions(studentId, nextLevel, dbStore, usedTexts);
  console.log(`\n  Reinforcement Questions Retrieved (${reinfQs.length}):`);
  reinfQs.forEach(q => console.log(`    - [${q.topic}] ${q.question}`));

  const normalCount = 4; // Always 4 normal level questions

  // Generate 4 new Level 16 questions
  const newL16Qs = generateQuestionsForLevel(nextLevel, 0).slice(0, normalCount).map(q => ({
    ...q,
    question_id: `${studentId}_${q.question_id}`,
    question: `[For ${studentName} - L${nextLevel}.0] ${q.question}`
  }));

  const mappedReinf = reinfQs.map(q => ({
    ...q,
    question_id: `${studentId}_REINF_${q.question_id}`,
    question: `[For ${studentName}] [Reinforcement - ${q.topic}] ${q.question}`
  }));

  const finalQs = mixWorksheetQuestions(newL16Qs, mappedReinf);

  console.log(`\nStep 5: Final Worksheet Questions (${finalQs.length} total):`);
  finalQs.forEach((q, idx) => {
    const isReinf = q.question_id.includes('_REINF_') || q.subtopic === 'Reinforcement';
    console.log(`  Q${idx + 1}: [${isReinf ? 'REINFORCEMENT - ' + q.topic : 'NORMAL - L' + nextLevel}] ${q.question}`);
  });

  // Verify rules
  const reinfInjected = finalQs.filter(q => q.question_id.includes('_REINF_') || q.subtopic === 'Reinforcement').length;
  const normalInjected = finalQs.length - reinfInjected;

  console.log('\n====================================================');
  console.log('VERIFICATION RESULTS:');
  console.log(`  Total Worksheet Questions: ${finalQs.length} (Expected: 5 = 4 normal + 1 reinf)`);
  console.log(`  Normal Level ${nextLevel} Questions: ${normalInjected} (Expected: 4)`);
  console.log(`  Reinforcement Questions: ${reinfInjected} (Expected: 1 extra)`);
  
  // Check no duplication
  let duplicated = false;
  finalQs.forEach(q => {
    const clean = q.question.replace(/^\[For [^\]]+\]\s*/, '').replace(/^\[Reinforcement - [^\]]+\]\s*/, '').trim().toLowerCase();
    if (usedTexts.has(clean)) {
      duplicated = true;
      console.error(`  ERROR: Duplicated question found: ${clean}`);
    }
  });

  if (finalQs.length === 5 && reinfInjected === 1 && normalInjected === 4 && !duplicated) {
    console.log('SUCCESS: All reinforcement requirements satisfied perfectly!');
  } else {
    console.error('FAILURE: Verification checks failed.');
  }
  console.log('====================================================\n');
}

runE2EVerification().catch(console.error);
