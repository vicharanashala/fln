import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-misconceptions-auth-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'misconceptions-auth-secret';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerMisconceptionRoutes } = await import('../src/routes/misconceptions');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

// Seed test users, schools, students into dbStore
const schoolA = {
  id: 'AP_SCH_001',
  name: 'School A',
  stateCode: 'AP',
  districtCode: 'AP_DIS_01',
  blockCode: 'AP_BLK_01'
};
const schoolB = {
  id: 'KA_SCH_002',
  name: 'School B',
  stateCode: 'KA',
  districtCode: 'KA_DIS_01',
  blockCode: 'KA_BLK_01'
};

const teacherUser = {
  id: 'teacher-1',
  email: 'teacher1@schoola.org',
  name: 'Teacher One',
  role: UserRole.TEACHER,
  schoolId: schoolA.id
};

const stateAdminUser = {
  id: 'state-admin-1',
  email: 'admin@ap.gov.in',
  name: 'AP State Admin',
  role: UserRole.ADMIN,
  stateCode: 'AP'
};

const superAdminUser = {
  id: 'superadmin-1',
  email: 'superadmin@fln.org',
  name: 'Super Admin',
  role: UserRole.SUPERADMIN
};

const studentA = {
  id: 'std-a-01',
  name: 'Student A',
  schoolId: schoolA.id,
  classGroup: '3',
  grade: '3',
  section: 'A',
  currentLevel: 10
};

const studentB = {
  id: 'std-b-01',
  name: 'Student B',
  schoolId: schoolB.id,
  classGroup: '3',
  grade: '3',
  section: 'A',
  currentLevel: 10
};

(dbStore as any).data.schools = [schoolA, schoolB];
(dbStore as any).data.users = [teacherUser, stateAdminUser, superAdminUser];
(dbStore as any).data.students = [studentA, studentB];

const app = express();
app.use(express.json());
registerMisconceptionRoutes(app);

const server: http.Server = await new Promise(resolve => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;

function tokenFor(email: string) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
}

async function request(token: string, route: string) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return { status: response.status, body: await response.json() as any };
}

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalCwd);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

test('cohort: teacher is restricted to own school', async () => {
  const teacherToken = tokenFor(teacherUser.email);

  // Passing another schoolId -> 403
  const resForbidden = await request(teacherToken, `/api/misconceptions/cohort?schoolId=${schoolB.id}`);
  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.body.error, 'Forbidden: school outside your scope.');

  // Passing own schoolId -> 200
  const resOwn = await request(teacherToken, `/api/misconceptions/cohort?schoolId=${schoolA.id}`);
  assert.equal(resOwn.status, 200);

  // Passing no schoolId -> defaults to own school -> 200
  const resDefault = await request(teacherToken, '/api/misconceptions/cohort');
  assert.equal(resDefault.status, 200);
});

test('cohort: state admin must specify a school matching their prefix', async () => {
  const adminToken = tokenFor(stateAdminUser.email);

  // No schoolId -> 400
  const resMissing = await request(adminToken, '/api/misconceptions/cohort');
  assert.equal(resMissing.status, 400);
  assert.equal(resMissing.body.error, 'schoolId is required for your role.');

  // Out of scope schoolId -> 403
  const resForeign = await request(adminToken, `/api/misconceptions/cohort?schoolId=${schoolB.id}`);
  assert.equal(resForeign.status, 403);
  assert.equal(resForeign.body.error, 'Forbidden: school outside your scope.');

  // Matching schoolId -> 200
  const resOk = await request(adminToken, `/api/misconceptions/cohort?schoolId=${schoolA.id}`);
  assert.equal(resOk.status, 200);
});

test('compare: scopes schoolId for teacher and admin', async () => {
  const teacherToken = tokenFor(teacherUser.email);
  const adminToken = tokenFor(stateAdminUser.email);

  const teacherForbid = await request(teacherToken, `/api/misconceptions/compare?schoolId=${schoolB.id}`);
  assert.equal(teacherForbid.status, 403);

  const adminForbid = await request(adminToken, `/api/misconceptions/compare?schoolId=${schoolB.id}`);
  assert.equal(adminForbid.status, 403);
});

test('fingerprint/:studentId: guards cross-school IDOR', async () => {
  const teacherToken = tokenFor(teacherUser.email);
  const superAdminToken = tokenFor(superAdminUser.email);

  // Teacher viewing foreign student -> 403
  const resForbid = await request(teacherToken, `/api/misconceptions/fingerprint/${studentB.id}`);
  assert.equal(resForbid.status, 403);
  assert.equal(resForbid.body.error, 'Forbidden.');

  // Teacher viewing own student -> passes auth (may be 404 NO_SUBMISSIONS_WITH_ERRORS due to no submissions, but not 403)
  const resOwn = await request(teacherToken, `/api/misconceptions/fingerprint/${studentA.id}`);
  assert.notEqual(resOwn.status, 403);

  // Superadmin viewing studentB -> passes auth
  const resSuper = await request(superAdminToken, `/api/misconceptions/fingerprint/${studentB.id}`);
  assert.notEqual(resSuper.status, 403);
});
