import dotenv from 'dotenv';
dotenv.config({ path: 'c:/FLN2/backend/.env' });

import { MongoClient } from 'mongodb';

async function seedLight() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fln';
  console.log("Connecting to MongoDB at:", uri);
  
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  
  // Clean collections
  console.log("Cleaning collections...");
  await db.collection('students').deleteMany({});
  await db.collection('worksheets').deleteMany({});
  await db.collection('examblueprints').deleteMany({});
  await db.collection('remediation_ledgers').deleteMany({});
  
  // Insert 1 student
  console.log("Seeding student...");
  await db.collection('students').insertOne({
    id: 'student_test_01',
    name: 'Amanpreet Singh',
    age: 8,
    classGroup: 'Class 2',
    section: 'A',
    schoolId: 'gps-mt-001',
    currentLevel: 1,
    targetLevel: 2,
    aadharMasked: 'XXXX-XXXX-1234',
    levelHistory: [],
    streak: 0
  });
  
  // Insert 1 worksheet containing Level 1 and Level 2 questions
  console.log("Seeding worksheet...");
  await db.collection('worksheets').insertOne({
    id: 'WS_1001',
    classId: 'c1',
    className: 'Class 2',
    section: 'A',
    schoolId: 'gps-mt-001',
    cycle: 'Baseline',
    date: '2026-06-15',
    questions: [
      {
        question_id: 'q1',
        question: 'Compare the quantities.',
        answer: 'Yes',
        answer_type: 'choice',
        topic: 'Quantity Comparison',
        subtopic: 'Equal, More, Less',
        difficulty: 'easy',
        source_level: 1
      },
      {
        question_id: 'q2',
        question: 'Identify the odd one out.',
        answer: 'chair',
        answer_type: 'choice',
        topic: 'Odd One Out',
        subtopic: 'Classification',
        difficulty: 'easy',
        source_level: 2
      }
    ]
  });
  
  console.log("Light seeding complete!");
  await client.close();
}

seedLight().catch(console.error);
