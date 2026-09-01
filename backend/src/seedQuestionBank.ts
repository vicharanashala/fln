import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { questionBankId } from './db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_BANK_PATH = path.join(__dirname, '../../data/questionBank.json');

/**
 * Seed the question bank WITHOUT destroying review work.
 *
 * This used to be `deleteMany({})` followed by `insertMany`. That was safe only
 * while nothing on a question was human-authored. Now a superadmin maps each
 * question to a 93-space level, and a wipe-and-reinsert would throw all of that
 * away — silently, and with no way to recover it, because the Mongo _ids rotate
 * too.
 *
 * So: upsert on the stable `questionId`. Content fields are `$set` (the JSON
 * file stays the source of truth for the question itself), review fields are
 * `$setOnInsert` (a human is the source of truth for those, and re-running this
 * must never overwrite them). Same division of authority as seedCurriculumLevels.
 */
async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(QUESTION_BANK_PATH, 'utf-8'));
  console.log(`Loaded ${raw.length} questions from questionBank.json`);

  // Identity must be unique or an upsert would merge two distinct questions
  // into one row. Verified unique over the shipped file; re-checked here
  // because the file can change.
  const seen = new Map<string, any>();
  const collisions: string[] = [];
  for (const q of raw) {
    const id = questionBankId(q.level, q.section, q.questionNumber);
    if (seen.has(id)) collisions.push(id);
    seen.set(id, q);
  }
  if (collisions.length > 0) {
    console.error(
      `ABORT: ${collisions.length} question(s) share an id, so upserting would merge distinct questions.\n` +
      `First few: ${collisions.slice(0, 5).join(', ')}\n` +
      `Identity is (level, section, questionNumber) — fix the duplicates in questionBank.json.`
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const collection = client.db().collection('questionBank');

  // Migrate rows seeded before questionId existed.
  //
  // The previous seeder wrote rows with no stable id, so an existing
  // deployment has 1202 of them with `questionId` unset. The unique index
  // below would then fail to build with a bare
  //   E11000 duplicate key ... dup key: { questionId: null }
  // which stops the deploy with nothing an operator can act on.
  //
  // Those rows are safe to drop: they predate review state entirely, so they
  // carry no human decision to lose, and every one of them is re-inserted from
  // the JSON immediately below with a proper id. Anything that DOES carry a
  // decision has a questionId by definition and is left alone.
  const legacyRows = await collection.countDocuments({ questionId: { $exists: false } });
  if (legacyRows > 0) {
    const withDecisions = await collection.countDocuments({
      questionId: { $exists: false },
      reviewStatus: { $in: ['mapped', 'retired'] },
    });
    if (withDecisions > 0) {
      console.error(
        `ABORT: ${withDecisions} row(s) carry a review decision but have no questionId. ` +
        `That should be impossible — review state is only ever written alongside an id. ` +
        `Refusing to delete a human decision; inspect the collection by hand.`
      );
      process.exit(1);
    }
    await collection.deleteMany({ questionId: { $exists: false } });
    console.log(
      `Migrated: removed ${legacyRows} row(s) seeded before questionId existed ` +
      `(no review decisions on them; re-inserted below with stable ids).`
    );
  }

  await collection.createIndex({ questionId: 1 }, { unique: true });
  await collection.createIndex({ level: 1 });
  await collection.createIndex({ level: 1, sectionType: 1 });
  await collection.createIndex({ reviewStatus: 1 });

  const ops = [...seen.entries()].map(([questionId, q]) => ({
    updateOne: {
      filter: { questionId },
      update: {
        $set: {
          level: Number(q.level),
          levelTitle: q.levelTitle,
          section: q.section,
          sectionType: q.sectionType,
          questionNumber: Number(q.questionNumber),
          questionText: q.questionText,
          answer: q.answer,
          svgHtml: q.svgHtml,
        },
        $setOnInsert: {
          questionId,
          mappedLevel: null,
          reviewStatus: 'untagged',
        },
      },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(ops, { ordered: false });
  const inserted = result.upsertedCount;
  const updated = result.modifiedCount;

  const total = await collection.countDocuments();
  const mapped = await collection.countDocuments({ reviewStatus: 'mapped' });
  const retired = await collection.countDocuments({ reviewStatus: 'retired' });
  const untagged = await collection.countDocuments({ reviewStatus: 'untagged' });

  console.log(`\nquestionBank: ${inserted} inserted, ${updated} updated (content refreshed)`);
  console.log(`  total in collection:  ${total}`);
  console.log(`  mapped by a human:    ${mapped}   (preserved — never touched by this script)`);
  console.log(`  retired by a human:   ${retired}   (preserved)`);
  console.log(`  awaiting review:      ${untagged}`);

  await client.close();
  console.log('\nDone.');
}

seed().catch((err) => { console.error(err); process.exit(1); });
