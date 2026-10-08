import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-school-onboarding-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-12345';

const { dbStore, UserRole } = await import('../src/db.js');
const { JWT_SECRET } = await import('../src/auth.js');
const { registerSchoolRoutes } = await import('../src/routes/schools.js');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();
await dbStore.addUser({
  id: 'test-superadmin',
  name: 'Test Superadmin',
  email: 'superadmin@test.local',
  role: UserRole.SUPERADMIN,
});

await dbStore.addUser({
  id: 'test-teacher',
  name: 'Test Teacher',
  email: 'teacher@test.local',
  role: UserRole.TEACHER,
});

const app = express();
app.use(express.json());
registerSchoolRoutes(app);

const server: http.Server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const superadminToken = jwt.sign({ email: 'superadmin@test.local' }, JWT_SECRET, { expiresIn: '1h' });
const teacherToken = jwt.sign({ email: 'teacher@test.local' }, JWT_SECRET, { expiresIn: '1h' });

function generateValidSchoolBody(overrides: Record<string, unknown> = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const udise = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
  return {
    id: `sch-${suffix}`,
    name: `Onboarding Test School ${suffix}`,
    stateCode: 'AP',
    districtCode: 'GNT',
    blockCode: 'GNT_01',
    villageCity: 'Guntur City',
    addressLine1: '42 Main Street',
    pinCode: '522001',
    schoolType: 'Primary',
    managementType: 'Government',
    email: `school-${suffix}@test.local`,
    phone: '9876543210',
    establishmentYear: 2010,
    initialClasses: ['Class 2', 'Class 3', 'Class 4'],
    udiseCode: udise,
    principal: {
      name: 'Principal Name',
      email: `principal-${suffix}@test.local`,
      password: 'StrongPassword123!',
      phone: '9876543211',
    },
    ...overrides,
  };
}

async function postSchool(body: Record<string, unknown>, userToken: string | null = superadminToken) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userToken) {
    headers.Authorization = `Bearer ${userToken}`;
  }
  const response = await fetch(`${baseUrl}/api/schools`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  (server as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch {}
});

test('Valid onboarding creates school, principal, and unassigned initial classes without leaking credentials', async () => {
  const body = generateValidSchoolBody();
  const res = await postSchool(body);

  assert.equal(res.status, 200);
  assert.equal(res.json.id, body.id.toLowerCase());
  assert.equal(res.json.name, body.name);

  // Response safety checks
  assert.equal(res.json.password, undefined);
  assert.equal(res.json.passwordHash, undefined);
  assert.equal(res.json.principal, undefined);

  // Verify DB state
  const schools = await dbStore.getSchools();
  const createdSchool = schools.find(s => s.id === body.id.toLowerCase());
  assert.ok(createdSchool);
  assert.ok(createdSchool.principalId);

  const users = await dbStore.getUsers();
  const principal = users.find(u => u.email === (body.principal as any).email.toLowerCase());
  assert.ok(principal);
  assert.equal(principal.role, UserRole.SCHOOL);
  assert.equal(principal.schoolId, createdSchool.id);

  const classes = await dbStore.getClasses();
  const schoolClasses = classes.filter(c => c.schoolId === createdSchool.id);
  assert.equal(schoolClasses.length, 3);
  for (const cls of schoolClasses) {
    assert.equal(cls.teacherId, '', 'Initial classes should start with unassigned teacher (empty string)');
  }
});

test('Authorization checks: non-superadmin and unauthenticated requests are rejected', async () => {
  const body = generateValidSchoolBody();
  const unauthRes = await postSchool(body, null);
  assert.equal(unauthRes.status, 403);

  const teacherRes = await postSchool(body, teacherToken);
  assert.equal(teacherRes.status, 403);
});

test('Duplicate detection: rejects existing school ID, UDISE code, and principal email', async () => {
  const base = generateValidSchoolBody();
  const first = await postSchool(base);
  assert.equal(first.status, 200);

  // Duplicate school ID
  const dupId = generateValidSchoolBody({ id: base.id });
  const dupIdRes = await postSchool(dupId);
  assert.equal(dupIdRes.status, 400);
  assert.equal(dupIdRes.json.error, 'School ID already exists.');

  // Duplicate UDISE
  const dupUdise = generateValidSchoolBody({ udiseCode: base.udiseCode });
  const dupUdiseRes = await postSchool(dupUdise);
  assert.equal(dupUdiseRes.status, 400);
  assert.equal(dupUdiseRes.json.error, 'Government school code already exists.');

  // Duplicate Principal Email
  const dupPrincipal = generateValidSchoolBody({ principal: { ...base.principal } });
  const dupPrincipalRes = await postSchool(dupPrincipal);
  assert.equal(dupPrincipalRes.status, 400);
  assert.equal(dupPrincipalRes.json.error, 'A user with the principal email already exists.');
});

test('Validation checks: rejects invalid PIN, UDISE, classes, and weak password', async () => {
  // Invalid PIN (not 6 digits)
  const badPin = generateValidSchoolBody({ pinCode: '123' });
  const pinRes = await postSchool(badPin);
  assert.equal(pinRes.status, 400);
  assert.equal(pinRes.json.error, 'PIN code must contain exactly 6 digits.');

  // Invalid UDISE length (not 11 digits)
  const badUdise = generateValidSchoolBody({ udiseCode: '12345' });
  const udiseRes = await postSchool(badUdise);
  assert.equal(udiseRes.status, 400);
  assert.equal(udiseRes.json.error, 'UDISE code must contain exactly 11 digits.');

  // Invalid initial class (Class > 12)
  const badClass = generateValidSchoolBody({ initialClasses: ['Class 15'] });
  const classRes = await postSchool(badClass);
  assert.equal(classRes.status, 400);
  assert.equal(classRes.json.error, 'Missing or invalid required school identity fields.');

  // Weak password (no uppercase/special/number or <8 chars)
  const weakPass = generateValidSchoolBody({ principal: { name: 'P', email: 'p@test.local', password: 'weak' } });
  const passRes = await postSchool(weakPass);
  assert.equal(passRes.status, 400);
  assert.equal(passRes.json.error, 'Principal password must be at least 8 characters and include an uppercase letter, number, and special character.');
});
