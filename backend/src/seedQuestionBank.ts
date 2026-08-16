import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_BANK_PATH = path.join(__dirname, '../../data/questionBank.json');

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(QUESTION_BANK_PATH, 'utf-8'));
  console.log(`Loaded ${questions.length} questions from questionBank.json`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const collection = db.collection('questionBank');

  await collection.deleteMany({});
  console.log('Cleared existing questionBank collection');

  if (questions.length > 0) {
    await collection.insertMany(questions);
    console.log(`Inserted ${questions.length} questions`);
  }

  await collection.createIndex({ level: 1 });
  await collection.createIndex({ level: 1, sectionType: 1 });
  console.log('Created indexes on level, sectionType');

  const byLevel: Record<number, number> = {};
  for (const q of questions) {
    byLevel[q.level] = (byLevel[q.level] || 0) + 1;
  }
  console.log('\nQuestions per level:');
  for (const [lvl, count] of Object.entries(byLevel).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  Level ${lvl}: ${count}`);
  }

  await client.close();
  console.log('\nDone!');
}

seed().catch(console.error);
