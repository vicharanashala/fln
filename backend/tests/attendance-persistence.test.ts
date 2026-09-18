import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

// Bootstrap: isolate environment and cwd BEFORE importing DBStore
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fln-attendance-test-'));
fs.mkdirSync(path.join(scratchDir, 'data'), { recursive: true });
process.chdir(scratchDir);
delete process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dev-insecure-secret-change-me';

// Dynamic imports so DBStore initializes DB_DIR inside scratchDir
const { dbStore, UserRole } = await import('../src/db');
const { registerAttendanceRoutes } = await import('../src/routes/attendance');
const { JWT_SECRET } = await import('../src/auth');
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;

test('attendance persistence via dbStore', async (t) => {
  await dbStore.init();

  after(() => {
    try {
      fs.rmSync(scratchDir, { recursive: true, force: true });
    } catch (_) {}
  });

  await t.test('getAttendance returns empty array when no records marked (no fake data)', async () => {
    const list = await dbStore.getAttendance({ date: '1999-01-01' });
    assert.deepEqual(list, [], 'Should not return any fake or fabricated seed records');
  });

  await t.test('upsertAttendance saves and updates records cleanly', async () => {
    const rec1 = {
      id: 'att-test-1',
      studentId: 'test-stu-101',
      studentName: 'Test Student One',
      classGroup: 'Class 2',
      section: 'A',
      schoolId: 'gps-mt-001',
      date: '2026-09-16',
      status: 'Present' as const,
      remarks: 'Active participation',
      markedBy: 'test-teacher@fln.org',
      updatedAt: new Date().toISOString(),
    };

    const saved1 = await dbStore.upsertAttendance(rec1);
    assert.equal(saved1.studentId, 'test-stu-101');

    const fetched = await dbStore.getAttendance({
      schoolId: 'gps-mt-001',
      date: '2026-09-16',
      classGroup: 'Class 2',
      section: 'A',
    });
    assert.equal(fetched.length, 1);
    assert.equal(fetched[0].status, 'Present');

    // Update attendance for the same student on the same day (e.g. status change from Present to Late)
    const rec1Updated = {
      ...rec1,
      status: 'Late' as const,
      remarks: 'Arrived after morning assembly',
      updatedAt: new Date().toISOString(),
    };

    await dbStore.upsertAttendance(rec1Updated);

    const fetchedAfterUpdate = await dbStore.getAttendance({
      schoolId: 'gps-mt-001',
      date: '2026-09-16',
    });
    assert.equal(fetchedAfterUpdate.length, 1, 'Should update existing record without duplicating');
    assert.equal(fetchedAfterUpdate[0].status, 'Late');
    assert.equal(fetchedAfterUpdate[0].remarks, 'Arrived after morning assembly');
  });

  await t.test('filtering by schoolId isolates attendance records', async () => {
    const recOtherSchool = {
      id: 'att-test-2',
      studentId: 'test-stu-202',
      studentName: 'Other School Student',
      classGroup: 'Class 3',
      section: 'B',
      schoolId: 'gps-amb-003',
      date: '2026-09-16',
      status: 'Present' as const,
      updatedAt: new Date().toISOString(),
    };

    await dbStore.upsertAttendance(recOtherSchool);

    const gpsMtOnly = await dbStore.getAttendance({ schoolId: 'gps-mt-001', date: '2026-09-16' });
    assert.ok(gpsMtOnly.every((r: any) => r.schoolId === 'gps-mt-001'));

    const gpsAmbOnly = await dbStore.getAttendance({ schoolId: 'gps-amb-003', date: '2026-09-16' });
    assert.ok(gpsAmbOnly.every((r: any) => r.schoolId === 'gps-amb-003'));

    const multiSchool = await dbStore.getAttendance({ schoolId: ['gps-mt-001', 'gps-amb-003'], date: '2026-09-16' });
    assert.ok(multiSchool.length >= 2);
  });

  await t.test('HTTP attendance routes integration', async () => {
    const app = express();
    app.use(express.json());
    registerAttendanceRoutes(app);

    const server = app.listen(0);
    const address = server.address() as any;
    const port = address.port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // 1. Unauthenticated request should return 401
      const resUnauth = await fetch(`${baseUrl}/api/attendance`);
      assert.equal(resUnauth.status, 401);

      // 2. Authenticated request as teacher of gps-mt-001
      const teacherToken = jwt.sign(
        { email: 'teacher.mt@fln.org', role: UserRole.TEACHER, schoolId: 'gps-mt-001' },
        JWT_SECRET
      );

      // Mark attendance via HTTP POST /api/attendance/mark
      const postRes = await fetch(`${baseUrl}/api/attendance/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          date: '2026-09-17',
          records: [
            {
              studentId: 'http-stu-1',
              studentName: 'HTTP Student',
              classGroup: 'Class 2',
              section: 'A',
              schoolId: 'gps-mt-001',
              status: 'Present',
            },
          ],
        }),
      });
      assert.equal(postRes.status, 200);
      const postJson: any = await postRes.json();
      assert.equal(postJson.records.length, 1);
      assert.equal(postJson.records[0].studentId, 'http-stu-1');

      // Query attendance via HTTP GET /api/attendance
      const getRes = await fetch(`${baseUrl}/api/attendance?date=2026-09-17&schoolId=gps-mt-001`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(getRes.status, 200);
      const getJson: any = await getRes.json();
      assert.ok(Array.isArray(getJson));
      assert.equal(getJson.length, 1);
      assert.equal(getJson[0].studentId, 'http-stu-1');

      // Query stats via HTTP GET /api/attendance/stats
      const statsRes = await fetch(`${baseUrl}/api/attendance/stats?schoolId=gps-mt-001`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(statsRes.status, 200);
      const statsJson: any = await statsRes.json();
      assert.ok(statsJson.totalRecords > 0);
      assert.ok(statsJson.presentCount > 0);
      assert.equal(typeof statsJson.overallRate, 'number');
    } finally {
      server.close();
    }
  });
});
