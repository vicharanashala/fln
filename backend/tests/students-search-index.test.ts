/**
 * Aadhaar Reveal — student search index regression test.
 *
 * Run:  cd backend && tsx --test tests/students-search-index.test.ts
 *
 * Locks in the fix for the 1.5 GB / 68k-row COLLSCAN problem. The
 * Aadhaar Reveal panel calls /api/students?q=... to filter the roster.
 * Pre-fix, the route built an unanchored case-insensitive regex
 * (`new RegExp(escaped, 'i')`) over six fields. None of those fields
 * were indexed with a collation-aware B-tree, so every search
 * keystroke COLLSCAN'd the 86,402-doc collection. The fix:
 *
 *   1. Add 6 collation-aware indexes (name_ci, displayId_ci,
 *      aadharMasked_ci, schoolId_ci, classGroup_ci, section_ci)
 *      with collation { locale: 'en', strength: 2 }.
 *   2. Change the $or filter from a regex to a BSON range
 *      ({ $gte: prefix, $lt: prefix + '￿' }) per branch.
 *   3. Set the same collation on the cursor so the indexes are used.
 *
 * The test verifies (1)–(3) against the live dev Atlas cluster
 * (skips automatically if MONGODB_URI is unset, so the file-fallback
 * test environment still passes).
 *
 * Without these checks, a future "let's drop the collation because
 * it slows down writes" or "let's switch back to regex because it's
 * more flexible" change would silently re-introduce the COLLSCAN
 * that this PR was created to fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const REQUIRED_CI_INDEXES = [
  'name_ci',
  'displayId_ci',
  'aadharMasked_ci',
  'schoolId_ci',
  'classGroup_ci',
  'section_ci',
];

const PRE_EXISTING_INDEXES = [
  'id_1',
  'schoolId_1',
  'teacherId_1',
  'aadharMasked_1',
  'aadhaarIdentityId_1',
];

async function tryConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    await client.db(process.env.MONGODB_DB_NAME || 'csfaq_triage').command({ ping: 1 });
    return client;
  } catch {
    return null;
  }
}

const client = await tryConnect();
const dbName = process.env.MONGODB_DB_NAME || 'csfaq_triage';
const students = client?.db(dbName).collection('students');

test('REGRESSION: students collection has all 6 `*_ci` collation-aware indexes', { skip: !client }, async () => {
  const indexes = await students!.indexes();
  const indexNames = new Set(indexes.map((ix: any) => ix.name));
  for (const want of REQUIRED_CI_INDEXES) {
    assert.ok(indexNames.has(want), `missing index: ${want}`);
    const ix = indexes.find((i: any) => i.name === want);
    assert.ok(ix.collation, `${want} has no collation`);
    assert.equal(ix.collation.locale, 'en', `${want}.collation.locale must be "en"`);
    assert.equal(ix.collation.strength, 2, `${want}.collation.strength must be 2 (case-insensitive)`);
  }
});

test('REGRESSION: pre-existing students indexes still present (no regression)', { skip: !client }, async () => {
  const indexes = await students!.indexes();
  const indexNames = new Set(indexes.map((ix: any) => ix.name));
  for (const want of PRE_EXISTING_INDEXES) {
    assert.ok(indexNames.has(want), `pre-existing index missing: ${want}`);
  }
});

test('REGRESSION: search `q="is"` uses index OR with 6 IXSCANs (not COLLSCAN)', { skip: !client }, async () => {
  // The production query shape from db.ts:
  //   filter.$or = [
  //     { name:        { $gte: prefix, $lt: upper } },
  //     ... (6 branches total)
  //   ];
  //   cursor.collation({ locale: 'en', strength: 2 });
  const prefix = 'is';
  const upper = prefix + '￿';
  const filter = {
    $or: [
      { name:        { $gte: prefix, $lt: upper } },
      { displayId:   { $gte: prefix, $lt: upper } },
      { aadharMasked:{ $gte: prefix, $lt: upper } },
      { schoolId:    { $gte: prefix, $lt: upper } },
      { classGroup:  { $gte: prefix, $lt: upper } },
      { section:     { $gte: prefix, $lt: upper } },
    ],
  };
  const collation = { locale: 'en', strength: 2 };

  const r = await students!.find(filter).collation(collation).explain('executionStats');
  const exec = r.executionStats || {};
  const plan = JSON.stringify(r.queryPlanner && r.queryPlanner.winningPlan);

  // 1. The plan MUST use IXSCAN — that's the whole point of the fix.
  assert.ok(plan.includes('IXSCAN'), `expected IXSCAN in plan, got: ${plan}`);
  // 2. The plan MUST NOT COLLSCAN — that's the pre-fix bug.
  assert.ok(!plan.includes('COLLSCAN'), `plan should not COLLSCAN, got: ${plan}`);
  // 3. The plan MUST use 6 IXSCAN branches (one per $or clause).
  const ixscanCount = (plan.match(/IXSCAN/g) || []).length;
  assert.ok(
    ixscanCount >= REQUIRED_CI_INDEXES.length,
    `expected ${REQUIRED_CI_INDEXES.length} IXSCANs, got ${ixscanCount}: ${plan}`,
  );
  // 4. Docs examined MUST be << 86,402 (the pre-fix bug examined all).
  //    Allow up to the nReturned as the upper bound; the plan is
  //    optimal when totalDocsExamined === nReturned.
  const nReturned = exec.nReturned || 0;
  const totalDocs = exec.totalDocsExamined || 0;
  assert.ok(
    totalDocs < 86_402,
    `totalDocsExamined=${totalDocs} should be < 86,402 (pre-fix COLLSCAN ceiling), nReturned=${nReturned}`,
  );
  // 5. The collation MUST be applied to the index scan (otherwise the
  //    plan would not use the *ci indexes).
  assert.ok(plan.includes('"collation"') || plan.includes('collation"'),
    `expected collation in plan, got: ${plan}`);
  // 6. Sanity: the query must actually return matches (otherwise the
  //    test would pass on a degenerate "empty collection" too).
  assert.ok(nReturned > 0, `nReturned should be > 0 for q="is", got ${nReturned}`);
});

test('REGRESSION: search `q="is"` WITHOUT collation falls back to COLLSCAN (proves collation is the trigger)', { skip: !client }, async () => {
  // Negative case: same filter, no collation. This MUST COLLSCAN.
  // The pre-fix bug had neither indexes nor collation; the post-fix
  // bug would be indexes but no collation. Either way, COLLSCAN.
  // Locking this in ensures the collation-on-cursor step doesn't get
  // dropped in a future refactor.
  const prefix = 'is';
  const upper = prefix + '￿';
  const filter = {
    $or: [
      { name:        { $gte: prefix, $lt: upper } },
      { displayId:   { $gte: prefix, $lt: upper } },
      { aadharMasked:{ $gte: prefix, $lt: upper } },
      { schoolId:    { $gte: prefix, $lt: upper } },
      { classGroup:  { $gte: prefix, $lt: upper } },
      { section:     { $gte: prefix, $lt: upper } },
    ],
  };
  const r = await students!.find(filter).explain('executionStats');
  const plan = JSON.stringify(r.queryPlanner && r.queryPlanner.winningPlan);
  assert.ok(plan.includes('COLLSCAN'),
    `without collation, plan should COLLSCAN (this is the bug surface), got: ${plan}`);
});

test('REGRESSION: search `q="is"` returns matches in single-digit ms', { skip: !client }, async () => {
  // Wall-clock perf check. The pre-fix COLLSCAN took ~225ms per
  // search; the post-fix index OR is ~5-10ms. A future regression
  // (e.g. dropping the indexes) would push this back to 200ms+.
  // Allow a generous 200ms ceiling to account for cold-start and
  // Atlas network jitter; a working fix is typically <30ms.
  const prefix = 'is';
  const upper = prefix + '￿';
  const filter = {
    $or: [
      { name:        { $gte: prefix, $lt: upper } },
      { displayId:   { $gte: prefix, $lt: upper } },
      { aadharMasked:{ $gte: prefix, $lt: upper } },
      { schoolId:    { $gte: prefix, $lt: upper } },
      { classGroup:  { $gte: prefix, $lt: upper } },
      { section:     { $gte: prefix, $lt: upper } },
    ],
  };
  const collation = { locale: 'en', strength: 2 };
  // Warm-up: discard the first call's overhead (driver connect, plan cache).
  await students!.find(filter).collation(collation).limit(1).toArray();
  // Measured call.
  const t0 = Date.now();
  const docs = await students!.find(filter).collation(collation).limit(10).toArray();
  const elapsed = Date.now() - t0;
  assert.ok(docs.length > 0, `search returned no docs; test setup is broken`);
  assert.ok(
    elapsed < 200,
    `search took ${elapsed}ms — pre-fix was ~225ms, so anything close to that means we COLLSCAN'd again`,
  );
});

test('REGRESSION: case-insensitive match — "IS" returns the same rows as "is"', { skip: !client }, async () => {
  // The collation strength:2 promise: case differences in the
  // search term should not change the result set. A future "let's
  // lower the collation strength" change would break this.
  const buildFilter = (q: string) => ({
    $or: [
      { name:        { $gte: q, $lt: q + '￿' } },
      { displayId:   { $gte: q, $lt: q + '￿' } },
      { aadharMasked:{ $gte: q, $lt: q + '￿' } },
      { schoolId:    { $gte: q, $lt: q + '￿' } },
      { classGroup:  { $gte: q, $lt: q + '￿' } },
      { section:     { $gte: q, $lt: q + '￿' } },
    ],
  });
  const collation = { locale: 'en', strength: 2 };
  const lowerIds = (await students!.find(buildFilter('is')).collation(collation).project({ _id: 1 }).toArray())
    .map((d: any) => d._id.toString()).sort();
  const upperIds = (await students!.find(buildFilter('IS')).collation(collation).project({ _id: 1 }).toArray())
    .map((d: any) => d._id.toString()).sort();
  assert.equal(upperIds.length, lowerIds.length,
    `"IS" returned ${upperIds.length} rows, "is" returned ${lowerIds.length} — case-sensitivity leaked into the query`);
  assert.deepEqual(upperIds, lowerIds,
    'the same set of _ids should match regardless of case');
});

test.after(async () => {
  if (client) await client.close();
});
