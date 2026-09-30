import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// Isolate DB from the real repository data.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-student-create-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);

delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerStudentRoutes } = await import('../src/routes/students');
const { __setTokenizeAadhaarImpl } = await import('../src/aadhaarVault');

__setTokenizeAadhaarImpl(async (rawAadhar, ctx) => {
  const digits = String(rawAadhar).replace(/[^0-9]/g, '');

  return {
    token: crypto.randomUUID(),
    last4: digits.slice(-4),
    tokenType: 'AADHAAR',
    identityId: `test-${digits.slice(-4)}`,
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
if (!address || typeof address === 'string') {
  throw new Error('Failed to start test server');
}

const BASE = `http://127.0.0.1:${address.port}`;

const TEACHER = 'gps-mt-001.t01@fln.org';

function authHeader(email: string = TEACHER): string {
  return `Bearer ${jwtLib.sign({ email }, JWT_SECRET, { expiresIn: '1h' })}`;
}

async function api(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response.
  }

  return { status: res.status, json };
}

test('test setup works', async () => {
  const res = await api({
    name: 'Setup Test Student',
    classGroup: 'Class 2',
    section: 'A',
    age: 7,
    aadharNumber: '111122223333',
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.name, 'Setup Test Student');
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});
test('rejects missing required fields', async () => {
  const base = {
    name: 'Required Fields Test',
    classGroup: 'Class 2',
    section: 'A',
    age: 7,
    aadharNumber: '222233334444',
  };

  for (const field of ['name', 'classGroup', 'section', 'aadharNumber']) {
    const body = { ...base };
    delete body[field as keyof typeof body];

    const res = await api(body);

    assert.equal(res.status, 400, `Expected 400 when ${field} is missing`);
      assert.match(res.json.error, /Missing required fields/);
  }
});

test('rejects missing schoolId for superadmin', async () => {
  const res = await fetch(`${BASE}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader('superadmin@fln.org'),
    },
    body: JSON.stringify({
      name: 'Missing School',
      classGroup: 'Class 2',
      section: 'A',
      dob: '2019-05-05',
      aadharNumber: '5555 6666 7777',
    }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(String(body.error ?? ''), /schoolId/i);
});
test('rejects invalid classGroup', async () => {
  const res = await api({
    name: 'Invalid Class Test',
    classGroup: 'Class 99',
    section: 'A',
    age: 7,
    aadharNumber: '333344445555',
  });

  assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid classGroup/);
});
test('derives age from a valid dob', async () => {
  const dob = '2019-01-01';
  const dobDate = new Date(dob);
  const today = new Date();

  const expectedAge =
    today.getFullYear() -
    dobDate.getFullYear() -
    (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate()) ? 1 : 0);

  const res = await api({
    name: 'DOB Age Test',
    classGroup: 'Class 3',
    section: 'A',
    dob,
    aadharNumber: '444455556666',
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.age, expectedAge);
});

test('rejects invalid dob format', async () => {
  const res = await api({
    name: 'Invalid DOB Test',
    classGroup: 'Class 3',
    section: 'A',
    dob: '01-01-2019',
    aadharNumber: '555566667777',
  });

  assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid dob/);
});

test('accepts explicit age when dob is not provided', async () => {
  const res = await api({
    name: 'Explicit Age Test',
    classGroup: 'Class 4',
    section: 'A',
    age: 10,
    aadharNumber: '666677778888',
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.age, 10);
});

test('rejects explicit age outside 1-20 when dob is absent', async () => {
  const res = await api({
    name: 'Invalid Age Test',
    classGroup: 'Class 4',
    section: 'B',
    age: 21,
    aadharNumber: '777788889999',
  });

  assert.equal(res.status, 400);
    assert.match(res.json.error, /age must be a number.*when dob is not provided/);
});


test('rejects invalid Aadhaar length', async () => {
  const res = await api({
    name: 'Invalid Aadhaar Test',
    classGroup: 'Class 2',
    section: 'B',
    age: 8,
    aadharNumber: '12345678901',
  });

  assert.equal(res.status, 400);
  assert.match(res.json.error, /Invalid Aadhaar number/);
});

test('normalizes Aadhaar before registration', async () => {
  const res = await api({
    name: 'Aadhaar Normalization Test',
    classGroup: 'Class 2',
    section: 'C',
    age: 8,
    aadharNumber: '1234-5678-9012',
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.aadharMasked, 'XXXX-XXXX-9012');
});

test('rejects duplicate Aadhaar registration', async () => {
  const aadhaar = '888899990000';

  const first = await api({
    name: 'Duplicate Aadhaar First',
    classGroup: 'Class 3',
    section: 'B',
    age: 9,
    aadharNumber: aadhaar,
  });

  assert.equal(first.status, 200);

  const second = await api({
    name: 'Duplicate Aadhaar Second',
    classGroup: 'Class 3',
    section: 'B',
    age: 9,
    aadharNumber: aadhaar,
  });

  assert.equal(second.status, 400);
  assert.match(second.json.error, /already registered/);
});
test('rejects duplicate Aadhaar within the same bulk import', async () => {
  const aadhaar = '999900001111';

  const res = await fetch(`${BASE}/api/students/bulk-import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({ rows: [
        {
          name: 'Batch Duplicate One',
          classGroup: 'Class 2',
          section: 'D',
          age: 8,
          aadharNumber: aadhaar,
        },
        {
          name: 'Batch Duplicate Two',
          classGroup: 'Class 2',
          section: 'D',
          age: 8,
          aadharNumber: aadhaar,
        },
      ],
    }),
  });

  const json = await res.json();

  assert.equal(res.status, 200, `got ${res.status}: ${JSON.stringify(json)}`); assert.equal(json.created, 1); assert.equal(json.failed, 1); const failedRow = (json.results || []).find((r: any) => r.status === 'failed'); assert.ok(failedRow); assert.match(String(failedRow.reason || ''), /already registered/i);
});
