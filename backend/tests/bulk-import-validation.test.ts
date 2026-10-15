import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// Isolate DB from repository data
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-bulk-import-val-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);

delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerStudentRoutes } = await import('../src/routes/students');
const { __setTokenizeAadhaarImpl } = await import('../src/aadhaarVault');

__setTokenizeAadhaarImpl(async (rawAadhar, ctx) => {
  const digits = String(rawAadhar).replace(/[^0-9]/g, '');
  return {
    token: crypto.randomUUID(),
    last4: digits.slice(-4),
    tokenType: 'AADHAAR',
    identityId: `test-${digits.slice(-4)}-${crypto.randomUUID().slice(0, 8)}`,
    auditId: ctx.requestId ?? 'test-audit',
    keyVersion: 'test-key',
  };
});

await dbStore.init();

const express = (await import('express')).default;
const jwtLib = (await import('jsonwebtoken')).default;

const app = express();
app.use(express.json());
registerStudentRoutes(app);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', () => resolve()));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Failed to start test server');
const BASE = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise<void>(r => server.close(() => r()));
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch {}
});

const users = await dbStore.getUsers();
const schools = await dbStore.getSchools();

const teacher = users.find(u => u.role === UserRole.TEACHER)!;
const superadmin = users.find(u => u.role === UserRole.SUPERADMIN)!;
const stateAdmin = users.find(u => u.role === UserRole.ADMIN && u.stateCode)!;
assert.ok(teacher && superadmin && stateAdmin, 'required users exist in test seed');

const token = (email: string) => `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;

const schoolInState = schools.find(s => s.stateCode === stateAdmin.stateCode)!;
const schoolOutOfState = schools.find(s => s.stateCode && s.stateCode !== stateAdmin.stateCode)!;
assert.ok(schoolInState && schoolOutOfState, 'schools inside and outside state exist');

test('bulk-import rejects null, string, or array rows with per-row failure and still imports valid rows', async () => {
  const payload = {
    rows: [
      null,
      'not-an-object',
      ['an', 'array'],
      {
        name: 'Valid Student 1',
        classGroup: 'Class 3',
        section: 'A',
        dob: '2017-05-15',
        aadharNumber: '888800001111',
      },
    ],
  };

  const res = await fetch(`${BASE}/api/students/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token(teacher.email) },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as any;
  assert.equal(data.total, 4);
  assert.equal(data.created, 1);
  assert.equal(data.failed, 3);
  assert.equal(data.results[0].status, 'failed');
  assert.match(data.results[0].reason, /Row must be an object with student fields/i);
  assert.equal(data.results[1].status, 'failed');
  assert.match(data.results[1].reason, /Row must be an object with student fields/i);
  assert.equal(data.results[2].status, 'failed');
  assert.match(data.results[2].reason, /Row must be an object with student fields/i);
  assert.equal(data.results[3].status, 'created');
  assert.equal(data.results[3].name, 'Valid Student 1');
});

test('superadmin supplying non-existent schoolId gets Unknown school error on bulk import', async () => {
  const payload = {
    rows: [
      {
        name: 'Orphan Student',
        schoolId: 'non-existent-school-12345',
        classGroup: 'Class 3',
        section: 'A',
        dob: '2017-05-15',
        aadharNumber: '888800002222',
      },
    ],
  };

  const res = await fetch(`${BASE}/api/students/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token(superadmin.email) },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as any;
  assert.equal(data.created, 0);
  assert.equal(data.failed, 1);
  assert.equal(data.results[0].status, 'failed');
  assert.match(data.results[0].reason, /Unknown school/i);
});

test('superadmin supplying non-existent schoolId gets Unknown school error on single POST', async () => {
  const res = await fetch(`${BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token(superadmin.email) },
    body: JSON.stringify({
      name: 'Single Orphan Student',
      schoolId: 'non-existent-school-99999',
      classGroup: 'Class 3',
      section: 'A',
      dob: '2017-05-15',
      aadharNumber: '888800003333',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json() as any;
  assert.match(data.error, /Unknown school/i);
});

test('state admin can import into schools within their own state', async () => {
  const payload = {
    rows: [
      {
        name: 'In-State Student',
        schoolId: schoolInState.id,
        classGroup: 'Class 3',
        section: 'A',
        dob: '2017-05-15',
        aadharNumber: '888800004444',
      },
    ],
  };

  const res = await fetch(`${BASE}/api/students/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token(stateAdmin.email) },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as any;
  assert.equal(data.created, 1);
  assert.equal(data.failed, 0);
  assert.equal(data.results[0].status, 'created');
});

test('state admin attempting to import into a school outside their state gets rejection', async () => {
  const payload = {
    rows: [
      {
        name: 'Out-Of-State Student',
        schoolId: schoolOutOfState.id,
        classGroup: 'Class 3',
        section: 'A',
        dob: '2017-05-15',
        aadharNumber: '888800005555',
      },
    ],
  };

  const res = await fetch(`${BASE}/api/students/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token(stateAdmin.email) },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as any;
  assert.equal(data.created, 0);
  assert.equal(data.failed, 1);
  assert.equal(data.results[0].status, 'failed');
  assert.match(data.results[0].reason, /School is outside your state/i);
});

test('state admin attempting single student POST outside their state gets 403', async () => {
  const res = await fetch(`${BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token(stateAdmin.email) },
    body: JSON.stringify({
      name: 'Out-Of-State Single Student',
      schoolId: schoolOutOfState.id,
      classGroup: 'Class 3',
      section: 'A',
      dob: '2017-05-15',
      aadharNumber: '888800006666',
    }),
  });

  assert.equal(res.status, 403);
  const data = await res.json() as any;
  assert.match(data.error, /School is outside your state/i);
});
