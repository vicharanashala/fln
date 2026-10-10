import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { registerAnalyticsRoutes } from '../src/routes/analytics';
import { dbStore, UserRole, User, School, Student } from '../src/db';
import { JWT_SECRET } from '../src/auth';

test('Issue #448: Analytics API Role-Based Scoping & Principal Data Isolation', async (t) => {
  const app = express();
  app.use(express.json());

  registerAnalyticsRoutes(app);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Seed dbStore with mock test data
  const testSchools: School[] = [
    {
      id: 'sch-pb-01',
      name: 'GPS Amritsar',
      stateCode: 'PB',
      districtCode: 'ASR',
      blockCode: 'ASR-01',
      strength: 'high',
      teachersCount: 5,
    },
    {
      id: 'sch-rj-02',
      name: 'GPS Jaipur',
      stateCode: 'RJ',
      districtCode: 'JAI',
      blockCode: 'JAI-01',
      strength: 'high',
      teachersCount: 4,
    }
  ];

  const testStudents: Student[] = [
    {
      id: 'stu-01',
      name: 'Student 1',
      schoolId: 'sch-pb-01',
      currentLevel: 5,
      classGroup: 'Class 2',
      section: 'A',
      gender: 'M',
      grade: 2
    } as any,
    {
      id: 'stu-02',
      name: 'Student 2',
      schoolId: 'sch-pb-01',
      currentLevel: 3,
      classGroup: 'Class 2',
      section: 'A',
      gender: 'F',
      grade: 2
    } as any,
    {
      id: 'stu-03',
      name: 'Student 3',
      schoolId: 'sch-rj-02',
      currentLevel: 6,
      classGroup: 'Class 3',
      section: 'B',
      gender: 'F',
      grade: 3
    } as any,
  ];

  const principalUser: User = {
    id: 'user-principal-1',
    name: 'Principal PB',
    email: 'principal@pb.gov.in',
    role: UserRole.SCHOOL,
    schoolId: 'sch-pb-01',
    stateCode: 'PB',
    districtCode: 'ASR',
    blockCode: 'ASR-01'
  };

  const superadminUser: User = {
    id: 'user-superadmin-1',
    name: 'Super Admin',
    email: 'superadmin@fln.gov.in',
    role: UserRole.SUPERADMIN
  };

  const stateAdminUser: User = {
    id: 'user-admin-pb',
    name: 'PB Admin',
    email: 'admin@pb.gov.in',
    role: UserRole.ADMIN,
    stateCode: 'PB'
  };

  const volunteerUser: User = {
    id: 'user-volunteer-1',
    name: 'Volunteer Multi',
    email: 'volunteer@fln.gov.in',
    role: UserRole.VOLUNTEER,
    assignedSchools: ['sch-pb-01', 'sch-rj-02']
  };

  const unassignedUser: User = {
    id: 'user-unassigned-1',
    name: 'Volunteer Unassigned',
    email: 'unassigned@fln.gov.in',
    role: UserRole.VOLUNTEER
  };

  const testUsers = [principalUser, superadminUser, stateAdminUser, volunteerUser, unassignedUser];

  (dbStore as any).data = {
    users: testUsers,
    schools: testSchools,
    students: testStudents,
    worksheets: [
      { id: 'ws-1', schoolId: 'sch-pb-01' },
      { id: 'ws-2', schoolId: 'sch-rj-02' }
    ],
    evaluationReports: [
      { id: 'rep-1', studentId: 'stu-01', score: 80, totalQuestions: 10 },
      { id: 'rep-2', studentId: 'stu-03', score: 90, totalQuestions: 10 }
    ]
  };

  const principalToken = jwt.sign({ email: principalUser.email }, JWT_SECRET);
  const superadminToken = jwt.sign({ email: superadminUser.email }, JWT_SECRET);
  const stateAdminToken = jwt.sign({ email: stateAdminUser.email }, JWT_SECRET);
  const volunteerToken = jwt.sign({ email: volunteerUser.email }, JWT_SECRET);
  const unassignedToken = jwt.sign({ email: unassignedUser.email }, JWT_SECRET);

  await t.test('1. Principal analytics is strictly scoped to user.schoolId and ignores query param widening', async () => {
    // Principal tries to widen scope by querying RJ state data
    const res = await fetch(`${baseUrl}/api/analytics?stateCode=RJ&districtCode=JAI&blockCode=JAI-01`, {
      headers: { Authorization: `Bearer ${principalToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    // Verify school isolation:
    assert.equal(data.totalSchools, 1, 'Principal must only see 1 school (their own)');
    assert.equal(data.totalStudents, 2, 'Principal must only see the 2 students in sch-pb-01');
    assert.equal(data.totalWorksheets, 1, 'Principal must only see the 1 worksheet in sch-pb-01');
    assert.equal(data.pipeline.certified, 1, 'Principal must only see the 1 certified student in sch-pb-01');
    assert.equal(data.pipeline.evaluated, 1, 'Principal must only see the 1 report in sch-pb-01');
    assert.equal(data.schoolId, 'sch-pb-01');
    assert.ok(data.school, 'Must return school analytics object');
    assert.equal(data.school.count, 2);

    // Verify national and other scope aggregates are NOT leaked to principal:
    assert.equal(data.national, null, 'National scope must be null for principal');
    assert.equal(data.state, null, 'State scope must be null for principal');
    assert.equal(data.district, null, 'District scope must be null for principal');
    assert.equal(data.block, null, 'Block scope must be null for principal');
  });

  await t.test('2. Superadmin can query across geographic boundaries and receives national scope', async () => {
    const res = await fetch(`${baseUrl}/api/analytics?stateCode=RJ&districtCode=JAI&blockCode=JAI-01`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.national, 'Superadmin must receive national analytics');
    assert.equal(data.totalSchools, 1, 'Should filter schools by stateCode RJ');
    assert.equal(data.roleScope, UserRole.SUPERADMIN);
  });

  await t.test('3. State Admin is locked to own state and cannot widen to another state', async () => {
    // State admin for PB attempts to query RJ
    const res = await fetch(`${baseUrl}/api/analytics?stateCode=RJ`, {
      headers: { Authorization: `Bearer ${stateAdminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.totalSchools, 1, 'State admin should only see schools in PB');
    assert.equal(data.national, null, 'State admin does not receive national scope');
    assert.ok(data.state, 'State admin receives state analytics for PB');
  });

  await t.test('4. Volunteer with multiple assignedSchools aggregates data across assigned schools', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    // Volunteer assigned to both PB and RJ schools
    assert.equal(data.totalSchools, 2, 'Volunteer should see 2 assigned schools');
    assert.equal(data.totalStudents, 3, 'Volunteer should see all 3 students across both schools');
    assert.equal(data.totalWorksheets, 2, 'Volunteer should see 2 worksheets across both schools');
    assert.equal(data.pipeline.certified, 2, 'Volunteer should see 2 certified students');
    assert.equal(data.pipeline.evaluated, 2, 'Volunteer should see 2 evaluation reports');
    assert.ok(data.school, 'Must return school analytics object');
    assert.equal(data.school.count, 3);
    assert.equal(data.national, null, 'National scope must be null for volunteer');
  });

  await t.test('5. User without assigned schools returns empty topicMastery and zeroes', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { Authorization: `Bearer ${unassignedToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.totalSchools, 0);
    assert.equal(data.totalStudents, 0);
    assert.equal(data.totalWorksheets, 0);
    assert.equal(data.pipeline.certified, 0);
    assert.equal(data.pipeline.evaluated, 0);
    assert.deepEqual(data.school.topicMastery, {}, 'Empty topicMastery when no schools assigned');
  });

  await t.test('6. Unauthorized request without authentication is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`);
    assert.equal(res.status, 401);
  });

  server.close();
});
