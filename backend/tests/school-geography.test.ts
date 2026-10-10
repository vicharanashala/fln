import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-school-geography-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerSchoolRoutes } = await import('../src/routes/schools');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

await dbStore.init();
await dbStore.addUser({
  id: 'test-superadmin',
  name: 'Test Superadmin',
  email: 'superadmin@test.local',
  role: UserRole.SUPERADMIN,
});

const app = express();
app.use(express.json());
registerSchoolRoutes(app);
const server: http.Server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const token = jwt.sign({ email: 'superadmin@test.local' }, JWT_SECRET, { expiresIn: '1h' });

function schoolBody(overrides: Record<string, unknown> = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return {
    id: `geo-test-${suffix}`,
    name: 'Geography Test School',
    stateCode: 'AP',
    districtCode: 'GNT',
    blockCode: 'GNT_09',
    villageCity: 'Guntur',
    addressLine1: '1 Test Road',
    pinCode: '522001',
    schoolType: 'Primary',
    managementType: 'Government',
    email: `school-${suffix}@test.local`,
    phone: '9876543210',
    establishmentYear: 2020,
    initialClasses: ['Class 1'],
    udiseCode: `${Math.floor(Math.random() * 1_000_000_000).toString().padStart(11, '0')}`,
    principal: {
      name: 'Test Principal',
      email: `principal-${suffix}@test.local`,
      password: 'StrongPass1!',
    },
    ...overrides,
  };
}

async function postSchool(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/schools`, {
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

test('rejects an unknown state code without creating a school', async () => {
  const before = (await dbStore.getSchools()).length;
  const response = await postSchool(schoolBody({ stateCode: 'ZZ' }));
  assert.equal(response.status, 400);
  assert.equal(response.json.error, 'Unknown state code.');
  assert.equal((await dbStore.getSchools()).length, before);
});

test('rejects a district that does not belong to the selected state', async () => {
  const before = (await dbStore.getSchools()).length;
  const response = await postSchool(schoolBody({ districtCode: 'TWG' }));
  assert.equal(response.status, 400);
  assert.equal(response.json.error, 'Unknown district for this state.');
  assert.equal((await dbStore.getSchools()).length, before);
});

test('rejects a block code that does not match the code format', async () => {
  const before = (await dbStore.getSchools()).length;
  const response = await postSchool(schoolBody({ blockCode: 'not a block!!' }));
  assert.equal(response.status, 400);
  assert.equal(response.json.error, 'Block code must look like GNT_01.');
  assert.equal((await dbStore.getSchools()).length, before);
});

test('accepts a correctly formatted new block code', async () => {
  const response = await postSchool(schoolBody({ blockCode: 'GNT_09' }));
  assert.equal(response.status, 200);
  assert.equal(response.json.blockCode, 'GNT_09');
});
