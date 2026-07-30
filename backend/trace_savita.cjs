const { MongoClient } = require('mongodb');
require('dotenv').config();

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  const SAVITA_ID = 's_HR_AMB_AMB_01_01_C2_01';

  console.log('='.repeat(80));
  console.log('STEP 1: STUDENT DOCUMENT');
  console.log('='.repeat(80));
  const student = await db.collection('students').findOne({ id: SAVITA_ID });
  if (student) {
    console.log('Found:', JSON.stringify({
      id: student.id,
      name: student.name,
      schoolId: student.schoolId,
      classGroup: student.classGroup,
      section: student.section,
      currentLevel: student.currentLevel,
      currentSubLevel: student.currentSubLevel,
      targetLevel: student.targetLevel,
      streak: student.streak,
      levelHistoryLength: student.levelHistory?.length
    }, null, 2));
  } else {
    console.log('NOT FOUND!');
  }

  console.log('\n' + '='.repeat(80));
  console.log('STEP 2: ASSESSMENT RESULTS');
  console.log('='.repeat(80));
  const assessments = await db.collection('assessment_results').find({ studentId: SAVITA_ID }).toArray();
  console.log('Total assessment_results:', assessments.length);
  if (assessments.length > 0) {
    assessments.forEach((a, i) => {
      console.log(`  [${i}] type=${a.type}, score=${a.score}/${a.totalQuestions}, date=${a.submittedAt || a.createdAt}`);
      if (a.evaluationResult) {
        console.log(`      evaluationResult: correct=${a.evaluationResult.correctCount}/${a.evaluationResult.totalQuestions}, pct=${a.evaluationResult.percentageScore}%`);
      }
    });
  }

  // Also check worksheets collection
  const worksheets = await db.collection('worksheets').find({ studentId: SAVITA_ID }).toArray();
  console.log('Total worksheets:', worksheets.length);
  if (worksheets.length > 0) {
    worksheets.forEach((w, i) => {
      console.log(`  [${i}] type=${w.type}, status=${w.status}, questionsCount=${w.questions?.length}, generatedAt=${w.generatedAt || w.createdAt}`);
      // Check for reinforcement tags
      const reinforcementQs = w.questions?.filter(q => q.text?.includes('[Reinforcement') || q.concept?.includes('Reinforcement'));
      if (reinforcementQs && reinforcementQs.length > 0) {
        console.log(`      >>> REINFORCEMENT QUESTIONS FOUND: ${reinforcementQs.length}`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('STEP 3: CONCEPT MASTERY PROFILE');
  console.log('='.repeat(80));
  const mastery = await db.collection('concept_mastery_profiles').findOne({ studentId: SAVITA_ID });
  if (mastery) {
    console.log('Found concept mastery profile:');
    console.log(JSON.stringify(mastery, null, 2));
  } else {
    console.log('NO CONCEPT MASTERY PROFILE FOUND');
  }

  console.log('\n' + '='.repeat(80));
  console.log('STEP 4: ALL COLLECTIONS WITH SAVITA DATA');
  console.log('='.repeat(80));
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments({
      $or: [
        { studentId: SAVITA_ID },
        { id: SAVITA_ID },
        { 'student.id': SAVITA_ID },
        { rollNumber: SAVITA_ID }
      ]
    });
    if (count > 0) {
      console.log(`  ${col.name}: ${count} document(s)`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('STEP 5: REINFORCEMENT ENGINE VERIFICATION');
  console.log('='.repeat(80));
  // Check if there are ANY concept_mastery_profiles at all
  const totalProfiles = await db.collection('concept_mastery_profiles').countDocuments();
  console.log('Total concept_mastery_profiles in DB:', totalProfiles);
  if (totalProfiles > 0) {
    const sample = await db.collection('concept_mastery_profiles').findOne();
    console.log('Sample profile:', JSON.stringify(sample, null, 2));
  }

  await client.close();
})();
