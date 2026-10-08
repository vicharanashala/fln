import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Keep the file-backed DB isolated from backend/data/db.json and import the
// singleton only after the environment and working directory are configured.
const originalCwd = process.cwd();
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-school-onboarding-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'school-onboarding-test-secret';
process.env.SEED_DEMO_PASSWORD = 'TestPass@123';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerSchoolRoutes } = await import('../src/routes/schools');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

// Pre-seed required state data for validation
const testState = {
  id: 'st1',
  code: 'ST',
  name: 'State Test',
  districts: [{ code: 'ST_D1', name: 'District 1', blocks: [{ code: 'ST_D1_B1', name: 'Block 1' }] }]
};
fs.writeFileSync(path.join(scratchDir, 'data', 'geo.json'), JSON.stringify([testState]));

const app = express();
app.use(express.json());
registerSchoolRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;

const superadminToken = jwt.sign({ email: 'superadmin@fln.org', role: UserRole.SUPERADMIN }, JWT_SECRET, { expiresIn: '1h' });
const teacherToken = jwt.sign({ email: 'teacher@fln.org', role: UserRole.TEACHER }, JWT_SECRET, { expiresIn: '1h' });
const schoolToken = jwt.sign({ email: 'school@fln.org', role: UserRole.SCHOOL }, JWT_SECRET, { expiresIn: '1h' });

// We must seed the users so auth middleware finds them
await dbStore.addUser({ id: 'su1', email: 'superadmin@fln.org', role: UserRole.SUPERADMIN, name: 'Super Admin', passwordHash: 'hash' } as any);
await dbStore.addUser({ id: 't1', email: 'teacher@fln.org', role: UserRole.TEACHER, name: 'Teacher', passwordHash: 'hash' } as any);
await dbStore.addUser({ id: 'sch1', email: 'school@fln.org', role: UserRole.SCHOOL, name: 'School', passwordHash: 'hash', schoolId: 'test-school-1' } as any);

async function request(method: string, route: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() as any };
}

const validSchoolPayload = {
  id: 'test-school-1',
  name: 'Test School One',
  stateCode: 'AP',
  districtCode: 'GNT',
  blockCode: 'GNT_01',
  villageCity: 'Test City',
  addressLine1: '123 Test Road',
  pinCode: '123456',
  udiseCode: '12345678901',
  schoolType: 'Primary',
  managementType: 'Government',
  email: 'school@test.org',
  phone: '9876543210',
  establishmentYear: 2000,
  initialClasses: ['Class 1', 'Class 2'],
  principal: {
    name: 'Principal Name',
    email: 'principal@test.org',
    password: 'Password@123'
  }
};

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalCwd);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

test('POST /api/schools successful onboarding', async () => {
  // Wait, schools route checks STATES_UTS directly which is imported from geoData.ts.
  // Geo data might be statically loaded from json in geoData.ts. Let's make sure test state matches real geo data,
  // or use a real state code instead.
  // Let's use real state codes since geoData is hardcoded or loaded from real data:
  // Use stateCode: 'AP', districtCode: 'AP_GUNTUR', blockCode: 'GNT_01'
  const payload = {
    ...validSchoolPayload,
    stateCode: 'AP',
    districtCode: 'GNT',
    blockCode: 'GNT_01'
  };

  const response = await request('POST', '/api/schools', payload, superadminToken);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, 'test-school-1');
  assert.equal(response.body.name, 'Test School One');
  assert.equal(response.body.password, undefined);
  assert.equal(response.body.passwordHash, undefined);

  // Verify principal user was created
  const users = await dbStore.getUsers();
  const principal = users.find(u => u.email === 'principal@test.org');
  assert.ok(principal);
  assert.equal(principal.role, UserRole.SCHOOL);
  assert.equal(principal.schoolId, 'test-school-1');

  // Verify log was created
  const persisted = JSON.parse(fs.readFileSync(path.join(scratchDir, 'data', 'db.json'), 'utf8'));
  const logbook = persisted.logbook || [];
  const verifyLog = logbook.find((l: any) => l.schoolId === 'test-school-1' && l.activityType === 'verify');
  assert.ok(verifyLog);
});

test('POST /api/schools requires superadmin authentication', async () => {
  // No auth
  let response = await request('POST', '/api/schools', validSchoolPayload);
  assert.equal(response.status, 403);
  
  // Teacher auth
  response = await request('POST', '/api/schools', validSchoolPayload, teacherToken);
  assert.equal(response.status, 403);

  // School auth
  response = await request('POST', '/api/schools', validSchoolPayload, schoolToken);
  assert.equal(response.status, 403);
});

test('POST /api/schools detects duplicate school ID', async () => {
  const payload = {
    ...validSchoolPayload,
    id: 'test-school-1', // Already exists from previous test
    udiseCode: '12345678902',
    principal: { ...validSchoolPayload.principal, email: 'principal2@test.org' },
    stateCode: 'AP', districtCode: 'GNT', blockCode: 'GNT_01'
  };
  const response = await request('POST', '/api/schools', payload, superadminToken);
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'School ID already exists.');
});

test('POST /api/schools detects duplicate UDISE/governmentSchoolCode', async () => {
  const payload = {
    ...validSchoolPayload,
    id: 'test-school-2',
    udiseCode: '12345678901', // Already exists
    principal: { ...validSchoolPayload.principal, email: 'principal2@test.org' },
    stateCode: 'AP', districtCode: 'GNT', blockCode: 'GNT_01'
  };
  const response = await request('POST', '/api/schools', payload, superadminToken);
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Government school code already exists.');
});

test('POST /api/schools detects duplicate principal email', async () => {
  const payload = {
    ...validSchoolPayload,
    id: 'test-school-2',
    udiseCode: '12345678902',
    principal: { ...validSchoolPayload.principal, email: 'principal@test.org' }, // Already exists
    stateCode: 'AP', districtCode: 'GNT', blockCode: 'GNT_01'
  };
  const response = await request('POST', '/api/schools', payload, superadminToken);
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'A user with the principal email already exists.');
});

test('POST /api/schools rejects missing or invalid input', async () => {
  const invalidPayloads = [
    { ...validSchoolPayload, udiseCode: '123' }, // Invalid UDISE length
    { ...validSchoolPayload, pinCode: '12' },    // Invalid PIN length
    { ...validSchoolPayload, principal: { ...validSchoolPayload.principal, password: 'weak' } }, // Weak password
    { ...validSchoolPayload, blockCode: 'INVALID' } // Invalid block code format
  ];

  for (const payload of invalidPayloads) {
    const p = { ...payload, stateCode: 'AP', districtCode: 'GNT' };
    const response = await request('POST', '/api/schools', p, superadminToken);
    assert.equal(response.status, 400);
  }
});
