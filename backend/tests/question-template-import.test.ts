import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { registerQuestionTemplateRoutes } = await import('../src/routes/questionTemplates');
const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');

await dbStore.init();

const app = express();
app.use(express.json());
registerQuestionTemplateRoutes(app);

const server = app.listen(0, '127.0.0.1');
let base: string;

before(async () => {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/question-templates`;
});

after(() => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))));

beforeEach(() => {
  if ((dbStore as any).data?.questionTemplates) {
    (dbStore as any).data.questionTemplates = [];
  }
});

function authorize(t: TestContext, role = UserRole.SUPERADMIN) {
  const user = { id: 'test-superadmin-import', email: 'superadmin.import@example.test', name: 'Superadmin Import', role };
  t.mock.method(dbStore, 'getUserSync', () => user);
  return {
    Authorization: `Bearer ${jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1m' })}`,
    'Content-Type': 'application/json',
  };
}

const CSV_HEADER = 'conceptId,skills,subskills,generationIntent,questionFamily,svgThemeIds,answerSpec,tags,name,numeralRange,digitCount,operations,maxOperandCount,carryBehavior,borrowBehavior,maxSumOrDifference,answerType,blankCount,questionCount,subjectCategory';

test('Case 1: Import a 3-row file, then the same file again: second has imported: 0 and skippedIdentical: 3', async t => {
  const headers = authorize(t);
  const row1 = 'S1.1,SK01,SK01.01,Child counts apples and writes numeral.,counting,fruits,,tag1,Count Apples,0-9,1-digit,add,2,,,,single-number,,1,fruits';
  const row2 = 'S1.1,SK01,SK01.02,Child counts bananas and writes numeral.,counting,fruits,,tag1,Count Bananas,0-9,1-digit,add,2,,,,single-number,,1,fruits';
  const row3 = 'S1.1,SK01,SK01.03,Child counts oranges and writes numeral.,counting,fruits,,tag1,Count Oranges,0-9,1-digit,add,2,,,,single-number,,1,fruits';

  const csv = [CSV_HEADER, row1, row2, row3].join('\n');

  // First import
  const res1 = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv, dryRun: false }),
  });
  const json1 = await res1.json() as any;
  assert.equal(res1.status, 201, JSON.stringify(json1));
  assert.equal(json1.imported, 3, JSON.stringify(json1));
  assert.equal(json1.skippedIdentical, 0);
  assert.equal((dbStore as any).data?.questionTemplates.length, 3);

  // Second import (same file)
  const res2 = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv, dryRun: false }),
  });
  const json2 = await res2.json() as any;
  assert.equal(res2.status, 201, JSON.stringify(json2));
  assert.equal(json2.imported, 0);
  assert.equal(json2.skippedIdentical, 3);
  assert.equal((dbStore as any).data?.questionTemplates.length, 3);
});

test('Case 2: Same settings but a different intent: both rows stored and alreadyExists lists the key', async t => {
  const headers = authorize(t);
  const row1 = 'S1.2,SK02,SK02.01,First intent for same settings.,operation,fruits,,tag,Operation A,0-9,1-digit,add,2,,,,single-number,,1,fruits';
  const row2 = 'S1.2,SK02,SK02.01,Second distinct intent for same settings.,operation,fruits,,tag,Operation B,0-9,1-digit,add,2,,,,single-number,,1,fruits';

  // Import first row
  const res1 = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv: [CSV_HEADER, row1].join('\n'), dryRun: false }),
  });
  const json1 = await res1.json() as any;
  assert.equal(res1.status, 201, JSON.stringify(json1));
  assert.equal(json1.imported, 1);

  // Import second row (different intent)
  const res2 = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv: [CSV_HEADER, row2].join('\n'), dryRun: false }),
  });
  const json2 = await res2.json() as any;
  assert.equal(res2.status, 201, JSON.stringify(json2));
  assert.equal(json2.imported, 1);
  assert.equal(json2.skippedIdentical, 0);
  assert.ok(json2.alreadyExists.length > 0, 'alreadyExists should list the existing variant key');
  assert.equal((dbStore as any).data?.questionTemplates.length, 2);
});

test('Case 3: A file with the same row twice: one stored, one counted as skipped', async t => {
  const headers = authorize(t);
  const row = 'S1.2,SK02,SK02.01,Duplicate row inside same CSV.,counting,fruits,,tag,Dupe Row,0-9,1-digit,add,2,,,,single-number,,1,fruits';
  const csv = [CSV_HEADER, row, row].join('\n');

  const res = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv, dryRun: false }),
  });
  const json = await res.json() as any;
  assert.equal(res.status, 201, JSON.stringify(json));
  assert.equal(json.imported, 1);
  assert.equal(json.skippedIdentical, 1);
  assert.equal((dbStore as any).data?.questionTemplates.length, 1);
});

test('Case 4: Dry run: wouldImport and wouldSkip add up to rowsRead, and nothing is written', async t => {
  const headers = authorize(t);
  // rowOld is seeded into DB, rowNew is new
  const rowOld = 'S1.2,SK02,SK02.01,Seeded template in DB.,counting,fruits,,tag,Seeded,0-9,1-digit,add,2,,,,single-number,,1,fruits';
  const rowNew = 'S1.3,SK04,SK04.01,New dry run template.,counting,fruits,,tag,New Dry Run,0-9,1-digit,add,2,,,,single-number,,1,fruits';

  // Seed rowOld
  const seedRes = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv: [CSV_HEADER, rowOld].join('\n'), dryRun: false }),
  });
  assert.equal(seedRes.status, 201);
  assert.equal((dbStore as any).data?.questionTemplates.length, 1);

  const csv = [CSV_HEADER, rowOld, rowNew].join('\n');
  const res = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv, dryRun: true }),
  });
  const json = await res.json() as any;
  assert.equal(res.status, 200, JSON.stringify(json));
  assert.equal(json.dryRun, true);
  assert.equal(json.rowsRead, 2);
  assert.equal(json.wouldImport, 1);
  assert.equal(json.wouldSkip, 1);
  assert.equal(json.wouldImport + json.wouldSkip, json.rowsRead);

  // Verify nothing was written by dry run
  assert.equal((dbStore as any).data?.questionTemplates.length, 1);
});

test('Case 5: Rows with the same intent but different skills or subskills are NOT treated as identical', async t => {
  const headers = authorize(t);
  const row1 = 'S1.2,SK02,SK02.01,Shared intent across skills.,counting,fruits,,tag,Skill 02,0-9,1-digit,add,2,,,,single-number,,1,fruits';
  const row2 = 'S1.2,SK04,SK04.01,Shared intent across skills.,counting,fruits,,tag,Skill 04,0-9,1-digit,add,2,,,,single-number,,1,fruits';

  const res1 = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv: [CSV_HEADER, row1].join('\n'), dryRun: false }),
  });
  const json1 = await res1.json() as any;
  assert.equal(res1.status, 201, JSON.stringify(json1));
  assert.equal(json1.imported, 1);

  const res2 = await fetch(`${base}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv: [CSV_HEADER, row2].join('\n'), dryRun: false }),
  });
  const json2 = await res2.json() as any;
  assert.equal(res2.status, 201, JSON.stringify(json2));
  assert.equal(json2.imported, 1);
  assert.equal(json2.skippedIdentical, 0);
  assert.equal((dbStore as any).data?.questionTemplates.length, 2);
});
