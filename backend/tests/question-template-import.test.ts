import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-template-import-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'import-test-secret-key';

const { dbStore, UserRole } = await import('../src/db.js');
const { JWT_SECRET } = await import('../src/auth.js');
const { registerQuestionTemplateRoutes } = await import('../src/routes/questionTemplates.js');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();
await dbStore.addUser({
  id: 'test-superadmin-import',
  name: 'Superadmin Import',
  email: 'superadmin.import@test.local',
  role: UserRole.SUPERADMIN,
});

const app = express();
app.use(express.json());
registerQuestionTemplateRoutes(app);

const server: http.Server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const token = jwt.sign({ email: 'superadmin.import@test.local' }, JWT_SECRET, { expiresIn: '1h' });

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  (server as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch {}
});

test('Bulk import skips identical templates (matching existing DB templates or duplicates within CSV)', async () => {
  const intent = 'The child counts the apples shown and writes one numeral.';
  const csvContent = [
    'conceptId,skills,subskills,generationIntent,questionFamily,svgThemeIds,answerSpec,tags,name,numeralRange,digitCount,operations,maxOperandCount,carryBehavior,borrowBehavior,maxSumOrDifference,answerType,blankCount,questionCount,subjectCategory',
    `S1.1,SK01,SK01.01,${intent},counting,fruits,,tag1,Count Apples,0-9,1-digit,add,2,,,,single-number,,1,fruits`,
    `S1.1,SK01,SK01.01,${intent},counting,fruits,,tag1,Count Apples,0-9,1-digit,add,2,,,,single-number,,1,fruits`,
  ].join('\n');

  // 1. Dry run test with 2 identical rows in CSV
  const dryRunRes = await fetch(`${baseUrl}/api/question-templates/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ csv: csvContent, dryRun: true }),
  });
  const dryRunJson = await dryRunRes.json() as any;
  assert.equal(dryRunRes.status, 200, JSON.stringify(dryRunJson));
  assert.equal(dryRunJson.dryRun, true);
  assert.equal(dryRunJson.wouldImport, 1);
  assert.equal(dryRunJson.skippedIdentical, 1);

  // 2. Perform actual import
  const importRes = await fetch(`${baseUrl}/api/question-templates/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ csv: csvContent, dryRun: false }),
  });
  const importJson = await importRes.json() as any;
  assert.equal(importRes.status, 201, JSON.stringify(importJson));
  assert.equal(importJson.imported, 1);
  assert.equal(importJson.skippedIdentical, 1);

  // 3. Re-importing the same file should skip all rows as identical to DB
  const reImportRes = await fetch(`${baseUrl}/api/question-templates/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ csv: csvContent, dryRun: false }),
  });
  const reImportJson = await reImportRes.json() as any;
  assert.equal(reImportRes.status, 201, JSON.stringify(reImportJson));
  assert.equal(reImportJson.imported, 0);
  assert.equal(reImportJson.skippedIdentical, 2);
});
