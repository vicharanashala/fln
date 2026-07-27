import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

const DATABASE_DIR = 'c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database';
const OUTPUT_FILE = 'c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/backend/data/db.json';

async function run() {
  console.log('Starting seed data import...');

  // 1. Users
  console.log('Loading users...');
  const rawUsers = JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, 'test.users.json'), 'utf-8'));
  console.log(`Loaded ${rawUsers.length} users. Generating bcrypt hashes...`);
  const passwordHash = bcrypt.hashSync('Fln@2026', 10);
  const users = rawUsers.map(u => {
    const { _id, password, ...rest } = u;
    return {
      ...rest,
      passwordHash
    };
  });
  console.log('Users mapped successfully.');

  // 2. Schools
  console.log('Loading schools...');
  const rawSchools = JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, 'test.schools.json'), 'utf-8'));
  const schools = rawSchools.map(s => {
    const { _id, ...rest } = s;
    return rest;
  });
  console.log(`Loaded ${schools.length} schools.`);

  // 3. Classes
  console.log('Loading classes...');
  const rawClasses = JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, 'test.classes.json'), 'utf-8'));
  const classes = rawClasses.map(c => {
    const { _id, ...rest } = c;
    return rest;
  });
  console.log(`Loaded ${classes.length} classes.`);

  // 4. Questions
  console.log('Loading questions...');
  const rawQuestions = JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, 'test.questions.json'), 'utf-8'));
  const questions = rawQuestions.map(q => {
    const { _id, ...rest } = q;
    return rest;
  });
  console.log(`Loaded ${questions.length} questions.`);

  // 5. Students (Filtered by active demo states to keep JSON size lightweight)
  console.log('Loading students...');
  const rawStudents = JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, 'test.students.json'), 'utf-8'));
  console.log(`Loaded ${rawStudents.length} raw students.`);
  
  const activeStates = new Set(['HR', 'PB', 'RJ', 'UP']);
  const activeSchools = new Set(schools.filter(s => activeStates.has(s.stateCode)).map(s => s.id));
  
  console.log(`Filtering students for states: ${Array.from(activeStates).join(', ')}...`);
  const students = [];
  for (const s of rawStudents) {
    if (activeSchools.has(s.schoolId)) {
      const { _id, ...rest } = s;
      students.push(rest);
    }
  }
  console.log(`Filtered down to ${students.length} students.`);

  // 6. Create Database Structure
  const dbData = {
    users,
    schools,
    classes,
    students,
    questions,
    worksheets: [],
    levelWorksheets: [],
    answerSubmissions: [],
    evaluationReports: [],
    tickets: [],
    logbook: [],
    announcements: [],
    interventions: [],
    bestPractices: [],
    conceptMasteryProfiles: []
  };

  console.log(`Writing imported database to ${OUTPUT_FILE}...`);
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  console.log('Seed data successfully imported and written to offline db.json!');
}

run().catch(err => {
  console.error('Import failed:', err);
});
