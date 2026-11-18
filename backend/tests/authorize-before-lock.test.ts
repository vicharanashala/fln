import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.LEVELS_BACKEND_URL = 'http://127.0.0.1:1';
process.env.PUPPETEER_EXECUTABLE_PATH = '/nonexistent-chromium';

const { registerWorksheetRoutes } = await import('../src/routes/worksheets');
const { registerDiagnosticBulkRoutes } = await import('../src/routes/diagnosticBulk');
const { dbStore, UserRole } = await import('../src/db');
const { JWT_SECRET } = await import('../src/auth');
const { recordStudentCycleLock } = await import('../src/paperLock');

const app = express();
app.use(express.json());
registerWorksheetRoutes(app);
registerDiagnosticBulkRoutes(app);

const server = app.listen(0, '127.0.0.1');
let base: string;

before(async () => {
  if (!server.listening) {
    await new Promise<void>(resolve => server.once('listening', resolve));
  }
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
}));

const routes = [
  '/api/diagnostic/single',
  '/api/worksheets/generate-level-pdf',
];

const scenarios = [
  'unknown-student',
  'other-school-teacher',
  'other-block-admin',
  'own-block-admin',
  'superadmin',
  'existing-lock',
] as const;

for (const route of routes) {
  for (const scenario of scenarios) {
    test(`${route}: ${scenario}`, async t => {
      const user =
        scenario === 'other-block-admin'
          ? { id: 'ba-2', email: 'ba2@example.test', role: UserRole.BLOCK_ADMIN, stateCode: 'ST1', districtCode: 'DT1', blockCode: 'BL2' }
          : scenario === 'own-block-admin'
            ? { id: 'ba-1', email: 'ba1@example.test', role: UserRole.BLOCK_ADMIN, stateCode: 'ST1', districtCode: 'DT1', blockCode: 'BL1' }
            : scenario === 'superadmin'
              ? { id: 'sa-1', email: 'sa@example.test', role: UserRole.SUPERADMIN }
              : { id: 'teacher-1', email: 'teacher@example.test', role: UserRole.TEACHER, schoolId: 'school-1' };

      const student = {
        id: 'student-1',
        name: 'Test Student',
        teacherId: 'teacher-2',
        schoolId: scenario === 'other-school-teacher' ? 'school-2' : 'school-1',
        classGroup: 'Class 2',
        currentLevel: 5,
        currentSubLevel: 0,
      };

      t.mock.method(dbStore, 'getUserSync', () => user as any);
      t.mock.method(dbStore, 'getStudentById', async () =>
        (scenario === 'unknown-student' ? undefined : student) as any);
      t.mock.method(dbStore, 'getStudents', async () =>
        (scenario === 'unknown-student' ? [] : [student]) as any);
      t.mock.method(dbStore, 'getSchoolById', async (schoolId: string) => ({
        id: schoolId,
        name: 'School 1',
        stateCode: 'ST1',
        districtCode: 'DT1',
        blockCode: 'BL1',
      }) as any);

      const existing = recordStudentCycleLock([], {
        studentId: student.id,
        paperType: 'diagnostic',
        cycle: 'Baseline',
        generatedByEmail: user.email,
        generatedByRole: user.role,
      });
      assert.ok(existing.ok);

      const getLocks = t.mock.method(
        dbStore,
        'getStudentCycleLocks',
        async () => (scenario === 'existing-lock' ? [existing.lock] : []),
      );
      const addLock = t.mock.method(
        dbStore,
        'addStudentCycleLock',
        async (lock: any) => lock,
      );

      const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1m' });

      const response = await fetch(`${base}${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: student.id,
          className: 'Class 2',
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };

      if (scenario === 'unknown-student') {
        assert.equal(response.status, 404, JSON.stringify(body));
        assert.equal(getLocks.mock.callCount(), 0);
        assert.equal(addLock.mock.callCount(), 0);
      } else if (scenario === 'other-school-teacher' || scenario === 'other-block-admin') {
        assert.equal(response.status, 403, JSON.stringify(body));
        assert.equal(getLocks.mock.callCount(), 0);
        assert.equal(addLock.mock.callCount(), 0);
      } else if (scenario === 'existing-lock') {
        assert.equal(response.status, 409, JSON.stringify(body));
        assert.equal(getLocks.mock.callCount(), 1);
        assert.equal(addLock.mock.callCount(), 0);
        assert.match(body.error || '', /Lock Active/);
      } else {
        // own-block-admin and superadmin: allowed past auth, 1 lock written
        assert.notEqual(response.status, 401);
        assert.notEqual(response.status, 403);
        assert.notEqual(response.status, 404);
        assert.equal(getLocks.mock.callCount(), 1);
        assert.equal(addLock.mock.callCount(), 1);
      }
    });
  }
}
