import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

// Isolate DB from real database and local files
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-school-onboarding-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);

delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'school-onboarding-test-secret-2026';

const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { registerSchoolRoutes } = await import('../src/routes/schools');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;
const bcrypt = (await import('bcrypt')).default;

await dbStore.init();

// Seed test users across different roles for RBAC verification
await dbStore.addUser({
  id: 'superadmin-user',
  name: 'Super Administrator',
  email: 'superadmin@onboarding.test',
  role: UserRole.SUPERADMIN,
});

await dbStore.addUser({
  id: 'teacher-user',
  name: 'Regular Teacher',
  email: 'teacher@onboarding.test',
  role: UserRole.TEACHER,
});

await dbStore.addUser({
  id: 'principal-user',
  name: 'School Principal',
  email: 'principal@onboarding.test',
  role: UserRole.SCHOOL,
});

await dbStore.addUser({
  id: 'district-admin-user',
  name: 'District Admin',
  email: 'district@onboarding.test',
  role: UserRole.DISTRICT_ADMIN,
  districtCode: 'GNT',
});

await dbStore.addUser({
  id: 'state-admin-user',
  name: 'State Admin',
  email: 'admin@onboarding.test',
  role: UserRole.ADMIN,
  stateCode: 'AP',
});

await dbStore.addUser({
  id: 'volunteer-user',
  name: 'Field Volunteer',
  email: 'volunteer@onboarding.test',
  role: UserRole.VOLUNTEER,
});

const app = express();
app.use(express.json());
registerSchoolRoutes(app);

const server: http.Server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;

function createToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
}

const superadminToken = createToken('superadmin@onboarding.test');
const teacherToken = createToken('teacher@onboarding.test');
const principalToken = createToken('principal@onboarding.test');
const districtAdminToken = createToken('district@onboarding.test');
const stateAdminToken = createToken('admin@onboarding.test');
const volunteerToken = createToken('volunteer@onboarding.test');

function validSchoolPayload(overrides: Record<string, unknown> = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `sch-${suffix}`,
    name: `Test Public School ${suffix}`,
    stateCode: 'AP',
    districtCode: 'GNT',
    blockCode: 'GNT_01',
    villageCity: 'Guntur City',
    addressLine1: '100 Main Road',
    addressLine2: 'Phase 2',
    landmark: 'Near Gandhi Square',
    pinCode: '522001',
    schoolType: 'Primary',
    managementType: 'Government',
    email: `school-${suffix}@onboarding.test`,
    phone: '9876543210',
    establishmentYear: 2018,
    initialClasses: ['Class 1', 'Class 2', 'Class 3'],
    udiseCode: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
    principal: {
      name: `Principal Name ${suffix}`,
      email: `principal-${suffix}@onboarding.test`,
      password: 'StrongPassword123!',
      phone: '9876543211',
    },
    ...overrides,
  };
}

async function postSchool(body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}/api/schools`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json: Record<string, any> = {};
  try {
    json = await response.json();
  } catch {
    // Non-JSON response
  }
  return { status: response.status, json };
}

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  (server as any).closeAllConnections?.();
  try {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  } catch {
    // Windows file locks may occasionally delay deletion
  }
});

// ==========================================
// 1. Authorization & Role Barriers
// ==========================================

test('rejects unauthenticated requests with 403 Forbidden', async () => {
  const beforeCount = (await dbStore.getSchools()).length;
  const payload = validSchoolPayload();
  const res = await postSchool(payload); // No token
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'Forbidden. Superadmin only.');
  assert.equal((await dbStore.getSchools()).length, beforeCount);
});

test('rejects requests with invalid or forged token with 403 Forbidden', async () => {
  const beforeCount = (await dbStore.getSchools()).length;
  const payload = validSchoolPayload();
  const fakeToken = jwt.sign({ email: 'superadmin@onboarding.test' }, 'wrong-secret-key');
  const res = await postSchool(payload, fakeToken);
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'Forbidden. Superadmin only.');
  assert.equal((await dbStore.getSchools()).length, beforeCount);
});

test('rejects non-superadmin roles (Teacher, Principal, District Admin, State Admin, Volunteer) with 403 Forbidden', async () => {
  const unauthorizedTokens = [
    { role: 'Teacher', token: teacherToken },
    { role: 'Principal', token: principalToken },
    { role: 'District Admin', token: districtAdminToken },
    { role: 'State Admin', token: stateAdminToken },
    { role: 'Volunteer', token: volunteerToken },
  ];

  for (const { role, token } of unauthorizedTokens) {
    const beforeCount = (await dbStore.getSchools()).length;
    const payload = validSchoolPayload();
    const res = await postSchool(payload, token);
    assert.equal(res.status, 403, `Role ${role} should be rejected with 403 Forbidden`);
    assert.equal(res.json.error, 'Forbidden. Superadmin only.');
    assert.equal((await dbStore.getSchools()).length, beforeCount);
  }
});

// ==========================================
// 2. Successful School Onboarding (Happy Path)
// ==========================================

test('successfully onboards a new school, registers principal user, seeds classes, and writes audit log', async () => {
  const payload = validSchoolPayload({
    name: 'Guntur Model Primary School',
    initialClasses: ['Class 1', 'Class 2', 'Class 3'],
  });

  const res = await postSchool(payload, superadminToken);
  assert.equal(res.status, 200);

  // Response assertions
  assert.equal(res.json.id, payload.id.toLowerCase());
  assert.equal(res.json.name, payload.name);
  assert.equal(res.json.stateCode, 'AP');
  assert.equal(res.json.districtCode, 'GNT');
  assert.equal(res.json.blockCode, 'GNT_01');
  assert.equal(res.json.schoolType, 'Primary');
  assert.equal(res.json.managementType, 'Government');
  assert.equal(res.json.pinCode, '522001');
  assert.equal(res.json.udiseCode, payload.udiseCode);
  assert.equal(res.json.establishmentYear, 2018);
  assert.ok(res.json.principalId, 'principalId should be generated and returned');
  assert.ok(res.json.createdAt, 'createdAt timestamp should be set');
  assert.ok(res.json.updatedAt, 'updatedAt timestamp should be set');

  // Database verification: School entity
  const schools = await dbStore.getSchools();
  const createdSchool = schools.find(s => s.id === payload.id.toLowerCase());
  assert.ok(createdSchool, 'School record must exist in DB');
  assert.equal(createdSchool?.principalId, res.json.principalId);
  assert.equal(createdSchool?.email, payload.email.toLowerCase());
  assert.equal(createdSchool?.phone, payload.phone);

  // Database verification: Principal User account
  const users = await dbStore.getUsers();
  const createdPrincipal = users.find(u => u.email === payload.principal.email.toLowerCase());
  assert.ok(createdPrincipal, 'Principal user account must exist in DB');
  assert.equal(createdPrincipal?.id, res.json.principalId);
  assert.equal(createdPrincipal?.name, payload.principal.name);
  assert.equal(createdPrincipal?.role, UserRole.SCHOOL);
  assert.equal(createdPrincipal?.schoolId, payload.id.toLowerCase());
  assert.equal(createdPrincipal?.stateCode, 'AP');
  assert.equal(createdPrincipal?.districtCode, 'GNT');
  assert.equal(createdPrincipal?.blockCode, 'GNT_01');
  assert.ok(createdPrincipal?.passwordHash, 'Principal passwordHash must be stored');

  // Verify bcrypt password hashing
  const passwordValid = await bcrypt.compare(payload.principal.password, createdPrincipal!.passwordHash!);
  assert.equal(passwordValid, true, 'bcrypt.compare must verify password successfully');

  // Database verification: Classes seeded
  const classes = await dbStore.getClasses();
  const schoolClasses = classes.filter(c => c.schoolId === payload.id.toLowerCase());
  assert.equal(schoolClasses.length, 3, 'Should seed exactly 3 classes');
  const classNames = schoolClasses.map(c => c.className).sort();
  assert.deepEqual(classNames, ['Class 1', 'Class 2', 'Class 3']);

  // Database verification: Audit log recorded
  const logs = await dbStore.getLogbook();
  const schoolLog = logs.find(l => l.schoolId === payload.id.toLowerCase() && l.activityType === 'verify');
  assert.ok(schoolLog, 'Audit log must be recorded for onboarding');
  assert.equal(schoolLog?.status, 'Success');
  assert.ok(schoolLog?.details.includes(payload.id.toLowerCase()));
});

// ==========================================
// 3. Security Leak Prevention
// ==========================================

test('ensures neither plaintext password nor passwordHash leak in response or school record', async () => {
  const payload = validSchoolPayload();
  const res = await postSchool(payload, superadminToken);
  assert.equal(res.status, 200);

  // The HTTP response should never contain password or passwordHash
  assert.equal(res.json.password, undefined);
  assert.equal(res.json.passwordHash, undefined);
  assert.equal(res.json.principal?.password, undefined);
  assert.equal(res.json.principal?.passwordHash, undefined);

  // The School database entity should never store password or passwordHash
  const school = (await dbStore.getSchools()).find(s => s.id === payload.id.toLowerCase());
  assert.equal((school as any)?.password, undefined);
  assert.equal((school as any)?.passwordHash, undefined);

  // The User database record must store passwordHash but NEVER plaintext password
  const principal = (await dbStore.getUsers()).find(u => u.email === payload.principal.email.toLowerCase());
  assert.equal((principal as any)?.password, undefined);
  assert.ok(principal?.passwordHash?.startsWith('$2'), 'passwordHash must be a bcrypt hash');
});

// ==========================================
// 4. Duplicate Prevention (Uniqueness Constraints)
// ==========================================

test('rejects duplicate school ID (case-insensitive) with 400 Bad Request', async () => {
  const payload1 = validSchoolPayload({ id: 'unique-school-01' });
  const res1 = await postSchool(payload1, superadminToken);
  assert.equal(res1.status, 200);

  const payload2 = validSchoolPayload({ id: 'UNIQUE-SCHOOL-01' });
  const res2 = await postSchool(payload2, superadminToken);
  assert.equal(res2.status, 400);
  assert.equal(res2.json.error, 'School ID already exists.');
});

test('rejects duplicate UDISE code with 400 Bad Request', async () => {
  const sharedUdise = '28170199999';
  const payload1 = validSchoolPayload({ udiseCode: sharedUdise });
  const res1 = await postSchool(payload1, superadminToken);
  assert.equal(res1.status, 200);

  const payload2 = validSchoolPayload({ udiseCode: sharedUdise });
  const res2 = await postSchool(payload2, superadminToken);
  assert.equal(res2.status, 400);
  assert.equal(res2.json.error, 'Government school code already exists.');
});

test('rejects duplicate Government School Code with 400 Bad Request', async () => {
  const sharedGovCode = 'GOV-AP-GNT-888';
  const payload1 = validSchoolPayload({ udiseCode: undefined, governmentSchoolCode: sharedGovCode });
  const res1 = await postSchool(payload1, superadminToken);
  assert.equal(res1.status, 200);

  const payload2 = validSchoolPayload({ udiseCode: undefined, governmentSchoolCode: sharedGovCode });
  const res2 = await postSchool(payload2, superadminToken);
  assert.equal(res2.status, 400);
  assert.equal(res2.json.error, 'Government school code already exists.');
});

test('rejects duplicate principal email with 400 Bad Request', async () => {
  const sharedPrincipalEmail = 'principal.shared@onboarding.test';
  const payload1 = validSchoolPayload({
    principal: {
      name: 'First Principal',
      email: sharedPrincipalEmail,
      password: 'StrongPassword1!',
    },
  });
  const res1 = await postSchool(payload1, superadminToken);
  assert.equal(res1.status, 200);

  const payload2 = validSchoolPayload({
    principal: {
      name: 'Second Principal',
      email: sharedPrincipalEmail.toUpperCase(), // case-insensitive check
      password: 'StrongPassword2!',
    },
  });
  const res2 = await postSchool(payload2, superadminToken);
  assert.equal(res2.status, 400);
  assert.equal(res2.json.error, 'A user with the principal email already exists.');
});

// ==========================================
// 5. Payload Validation & Field Constraints
// ==========================================

test('rejects missing required school identity fields with 400 Bad Request', async () => {
  const requiredFields = ['id', 'name', 'stateCode', 'districtCode', 'blockCode', 'villageCity', 'addressLine1', 'pinCode', 'schoolType', 'managementType', 'email', 'phone'];

  for (const field of requiredFields) {
    const payload = validSchoolPayload();
    delete (payload as any)[field];
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 400, `Missing field '${field}' should return 400`);
    assert.equal(res.json.error, 'Missing or invalid required school identity fields.');
  }
});

test('rejects request when both UDISE code and Government School Code are missing', async () => {
  const payload = validSchoolPayload();
  delete (payload as any).udiseCode;
  delete (payload as any).governmentSchoolCode;

  const res = await postSchool(payload, superadminToken);
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Missing or invalid required school identity fields.');
});

test('accepts onboarding with only Government School Code when UDISE code is omitted', async () => {
  const payload = validSchoolPayload({
    udiseCode: undefined,
    governmentSchoolCode: 'GOV-DEPT-9901',
  });

  const res = await postSchool(payload, superadminToken);
  assert.equal(res.status, 200);
  assert.equal(res.json.governmentSchoolCode, 'GOV-DEPT-9901');
});

test('rejects invalid PIN code (must be exactly 6 digits)', async () => {
  const invalidPins = ['12345', '1234567', 'ABCDEF', '52200a', '52200-'];

  for (const pinCode of invalidPins) {
    const payload = validSchoolPayload({ pinCode });
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 400);
    assert.ok(res.json.error.includes('PIN code must contain exactly 6 digits.'));
  }
});

test('rejects invalid UDISE code (must be exactly 11 digits when provided)', async () => {
  const invalidUdiseCodes = ['1234567890', '123456789012', '281701A0101', 'abcdefghijk'];

  for (const udiseCode of invalidUdiseCodes) {
    const payload = validSchoolPayload({ udiseCode });
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'UDISE code must contain exactly 11 digits.');
  }
});

test('rejects invalid establishment year (< 1800 or > current year)', async () => {
  const currentYear = new Date().getFullYear();
  const invalidYears = [1799, currentYear + 1, 'not-a-year', 2020.5];

  for (const establishmentYear of invalidYears) {
    const payload = validSchoolPayload({ establishmentYear });
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Missing or invalid required school identity fields.');
  }
});

test('rejects empty or invalid initial classes format', async () => {
  const invalidClassesPayloads = [
    [],
    ['Class 0'],
    ['Class 13'],
    ['Grade 1'],
    ['Kindergarten'],
    ['Class 1', 'InvalidClass'],
  ];

  for (const initialClasses of invalidClassesPayloads) {
    const payload = validSchoolPayload({ initialClasses });
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Missing or invalid required school identity fields.');
  }
});

test('rejects weak principal password failing complexity rules', async () => {
  const weakPasswords = [
    { pwd: 'Short1!', reason: 'Too short (<8 chars)' },
    { pwd: 'nouppercase123!', reason: 'Missing uppercase' },
    { pwd: 'NOLOWERCASENUMBER!', reason: 'Missing number' },
    { pwd: 'NoSpecialChar123', reason: 'Missing special char' },
  ];

  for (const { pwd, reason } of weakPasswords) {
    const payload = validSchoolPayload({
      principal: {
        name: 'Principal Tester',
        email: `pwd-test-${Math.random().toString(36).slice(2, 6)}@onboarding.test`,
        password: pwd,
      },
    });
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 400, `Password failing '${reason}' should be rejected`);
    assert.equal(
      res.json.error,
      'Principal password must be at least 8 characters and include an uppercase letter, number, and special character.'
    );
  }
});

test('rejects invalid schoolType or managementType', async () => {
  const res1 = await postSchool(validSchoolPayload({ schoolType: 'KindergartenOnly' }), superadminToken);
  assert.equal(res1.status, 400);
  assert.equal(res1.json.error, 'School type or management type is invalid.');

  const res2 = await postSchool(validSchoolPayload({ managementType: 'CharterInternational' }), superadminToken);
  assert.equal(res2.status, 400);
  assert.equal(res2.json.error, 'School type or management type is invalid.');
});

test('rejects invalid school email, principal email, or phone number format', async () => {
  const resSchoolEmail = await postSchool(validSchoolPayload({ email: 'not-an-email' }), superadminToken);
  assert.equal(resSchoolEmail.status, 400);
  assert.equal(resSchoolEmail.json.error, 'Enter a valid school email and phone number.');

  const resPhone = await postSchool(validSchoolPayload({ phone: '123' }), superadminToken);
  assert.equal(resPhone.status, 400);
  assert.equal(resPhone.json.error, 'Enter a valid school email and phone number.');

  const resPrincipalEmail = await postSchool(validSchoolPayload({
    principal: {
      name: 'Principal',
      email: 'invalid-email-address',
      password: 'StrongPassword1!',
    },
  }), superadminToken);
  assert.equal(resPrincipalEmail.status, 400);
  assert.equal(resPrincipalEmail.json.error, 'Enter a valid principal email.');
});

// ==========================================
// 6. Rollback / Cleanup on Failure
// ==========================================

test('atomic cleanup: rolls back created school and user if an unexpected error occurs during onboarding', async () => {
  const payload = validSchoolPayload();

  // Mock ensureClassesExist to simulate an unexpected error during the transaction
  const originalEnsureClassesExist = dbStore.ensureClassesExist.bind(dbStore);
  dbStore.ensureClassesExist = async () => {
    throw new Error('Simulated database error in ensureClassesExist');
  };

  try {
    const res = await postSchool(payload, superadminToken);
    assert.equal(res.status, 500);
    assert.equal(res.json.error, 'Failed to onboard school.');
    assert.ok(res.json.details.includes('Simulated database error'));

    // Assert rollback: school should have been deleted
    const schools = await dbStore.getSchools();
    assert.equal(schools.some(s => s.id === payload.id.toLowerCase()), false, 'School should be cleaned up on failure');

    // Assert rollback: user should have been deleted
    const users = await dbStore.getUsers();
    assert.equal(users.some(u => u.email === payload.principal.email.toLowerCase()), false, 'Principal user should be cleaned up on failure');
  } finally {
    dbStore.ensureClassesExist = originalEnsureClassesExist;
  }
});
