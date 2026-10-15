import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-admin-principal-school-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'admin-principal-secret-test';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerAdminRoutes } = await import('../src/routes/admin');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();

// Pre-seed a school for testing
await dbStore.addSchool({
  id: 'test-school-1',
  name: 'Test School 1',
  stateCode: 'AP',
  districtCode: 'GNT',
  blockCode: 'GNT_01',
  villageCity: 'Test City',
  addressLine1: 'Test Address',
  pinCode: '123456',
  schoolType: 'Primary',
  managementType: 'Government',
  email: 'school@test.local',
  phone: '9876543210',
  establishmentYear: 2000,
  initialClasses: ['Class 1']
} as any);

await dbStore.addUser({
  id: 'su1',
  name: 'Super Admin',
  email: 'superadmin@fln.org',
  role: UserRole.SUPERADMIN,
  passwordHash: 'hash'
} as any);

const app = express();
app.use(express.json());
registerAdminRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const token = jwt.sign({ email: 'superadmin@fln.org', role: UserRole.SUPERADMIN }, JWT_SECRET, { expiresIn: '1h' });

async function createPrincipal(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/admin/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  (server as any).closeAllConnections?.();
  try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch { /* Windows file locks */ }
});

test('POST /api/admin/create inherits school geography when omitted', async () => {
  const payload = {
    name: 'Principal 1',
    email: 'p1@test.local',
    password: 'Password@123',
    role: UserRole.SCHOOL,
    schoolId: 'test-school-1'
  };
  const res = await createPrincipal(payload);
  assert.equal(res.status, 200);
  assert.equal(res.json.stateCode, 'AP');
  assert.equal(res.json.districtCode, 'GNT');
  assert.equal(res.json.blockCode, 'GNT_01');
});

test('POST /api/admin/create succeeds when geography exactly matches the school', async () => {
  const payload = {
    name: 'Principal 2',
    email: 'p2@test.local',
    password: 'Password@123',
    role: UserRole.SCHOOL,
    schoolId: 'test-school-1',
    stateCode: 'AP',
    districtCode: 'GNT',
    blockCode: 'GNT_01'
  };
  const res = await createPrincipal(payload);
  assert.equal(res.status, 200);
  assert.equal(res.json.stateCode, 'AP');
  assert.equal(res.json.districtCode, 'GNT');
  assert.equal(res.json.blockCode, 'GNT_01');
});

test('POST /api/admin/create fails with 400 when school does not exist', async () => {
  const payload = {
    name: 'Principal 3',
    email: 'p3@test.local',
    password: 'Password@123',
    role: UserRole.SCHOOL,
    schoolId: 'non-existent-school',
  };
  const res = await createPrincipal(payload);
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Assigned school does not exist.');
});

test('POST /api/admin/create fails with 400 when stateCode conflicts', async () => {
  const payload = {
    name: 'Principal 4',
    email: 'p4@test.local',
    password: 'Password@123',
    role: UserRole.SCHOOL,
    schoolId: 'test-school-1',
    stateCode: 'XX'
  };
  const res = await createPrincipal(payload);
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Geographic state does not match the assigned school.');
});

test('POST /api/admin/create fails with 400 when districtCode conflicts', async () => {
  const payload = {
    name: 'Principal 5',
    email: 'p5@test.local',
    password: 'Password@123',
    role: UserRole.SCHOOL,
    schoolId: 'test-school-1',
    districtCode: 'XX'
  };
  const res = await createPrincipal(payload);
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Geographic district does not match the assigned school.');
});

test('POST /api/admin/create fails with 400 when blockCode conflicts', async () => {
  const payload = {
    name: 'Principal 6',
    email: 'p6@test.local',
    password: 'Password@123',
    role: UserRole.SCHOOL,
    schoolId: 'test-school-1',
    blockCode: 'XX_01'
  };
  const res = await createPrincipal(payload);
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Geographic block does not match the assigned school.');
});
