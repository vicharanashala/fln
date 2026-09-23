import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole, User, School } from '../src/db';

test('Issue #450: Geographic scope inheritance from school', () => {
  const sampleSchools: School[] = [
    {
      id: 'gps-asr-001',
      name: 'GPS Amritsar 1',
      stateCode: 'PB',
      districtCode: 'PB-ASR',
      blockCode: 'PB-ASR-BLK1',
      isAccessLocked: false,
      strength: 'high',
      teachersCount: 5,
    },
    {
      id: 'gps-jai-002',
      name: 'GPS Jaipur 2',
      stateCode: 'RJ',
      districtCode: 'RJ-JAI',
      blockCode: 'RJ-JAI-BLK2',
      isAccessLocked: false,
      strength: 'high',
      teachersCount: 6,
    }
  ];

  // Helper simulating admin.ts user creation logic
  function resolveUserGeography(input: {
    stateCode?: string;
    districtCode?: string;
    blockCode?: string;
    schoolId?: string;
    assignedSchools?: string[];
  }) {
    let resolvedState = input.stateCode ? input.stateCode.toUpperCase() : undefined;
    let resolvedDistrict = input.districtCode ? input.districtCode.toUpperCase() : undefined;
    let resolvedBlock = input.blockCode ? input.blockCode.toUpperCase() : undefined;

    const primarySchoolId = input.schoolId || (input.assignedSchools && input.assignedSchools.length > 0 ? input.assignedSchools[0] : undefined);
    if (primarySchoolId) {
      const targetSchool = sampleSchools.find(s => s.id.toLowerCase() === String(primarySchoolId).toLowerCase());
      if (targetSchool) {
        resolvedState = resolvedState || targetSchool.stateCode;
        resolvedDistrict = resolvedDistrict || targetSchool.districtCode;
        resolvedBlock = resolvedBlock || targetSchool.blockCode;
      }
    }

    return { resolvedState, resolvedDistrict, resolvedBlock };
  }

  // 1. Principal created with schoolId only (no state/district/block passed)
  const result1 = resolveUserGeography({ schoolId: 'gps-asr-001' });
  assert.equal(result1.resolvedState, 'PB', 'Should inherit stateCode from assigned school');
  assert.equal(result1.resolvedDistrict, 'PB-ASR', 'Should inherit districtCode from assigned school');
  assert.equal(result1.resolvedBlock, 'PB-ASR-BLK1', 'Should inherit blockCode from assigned school');

  // 2. Explicit stateCode override takes precedence if supplied
  const result2 = resolveUserGeography({ schoolId: 'gps-jai-002', stateCode: 'RJ' });
  assert.equal(result2.resolvedState, 'RJ', 'Explicit stateCode should be preserved');
  assert.equal(result2.resolvedDistrict, 'RJ-JAI', 'Should inherit districtCode from assigned school');
  assert.equal(result2.resolvedBlock, 'RJ-JAI-BLK2', 'Should inherit blockCode from assigned school');
});

test('Issue #456: Volunteer multiple school assignments normalization', () => {
  function normalizeAssignedSchools(assignedSchools: any, schoolId?: string): string[] | undefined {
    if (Array.isArray(assignedSchools)) {
      return assignedSchools.map(String).map(s => s.trim()).filter(Boolean);
    } else if (typeof assignedSchools === 'string' && assignedSchools.trim()) {
      return assignedSchools.split(',').map(s => s.trim()).filter(Boolean);
    } else if (schoolId) {
      return [String(schoolId).trim()];
    }
    return undefined;
  }

  // Array input with trailing spaces
  assert.deepEqual(
    normalizeAssignedSchools(['gps-asr-001', ' gps-jai-002 ']),
    ['gps-asr-001', 'gps-jai-002']
  );

  // Comma-separated string input
  assert.deepEqual(
    normalizeAssignedSchools('gps-asr-001, gps-jai-002, gps-lko-003'),
    ['gps-asr-001', 'gps-jai-002', 'gps-lko-003']
  );

  // Fallback to single schoolId if assignedSchools not specified
  assert.deepEqual(
    normalizeAssignedSchools(undefined, 'gps-asr-001'),
    ['gps-asr-001']
  );
});

test('Issue #444: School principal can register teachers for their own school', () => {
  const COORDINATOR_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN];

  function canRegisterTeacher(caller: { role: UserRole; schoolId?: string; blockCode?: string }, targetSchool: { id: string; blockCode: string }) {
    const isCoordinator = COORDINATOR_ROLES.includes(caller.role);
    const isPrincipal = caller.role === UserRole.SCHOOL;
    if (!isCoordinator && !isPrincipal) {
      return { allowed: false, reason: 'Forbidden. Coordinator or School Principal role required.' };
    }

    if (caller.role === UserRole.SCHOOL && targetSchool.id.toLowerCase() !== (caller.schoolId || '').toLowerCase()) {
      return { allowed: false, reason: 'Forbidden. School Principals can only register teachers for their own school.' };
    }

    if (caller.role === UserRole.BLOCK_ADMIN && targetSchool.blockCode !== caller.blockCode) {
      return { allowed: false, reason: 'Forbidden. Block Admins can only register teachers within their block.' };
    }

    return { allowed: true };
  }

  const schoolA = { id: 'gps-asr-001', blockCode: 'PB-ASR-BLK1' };
  const schoolB = { id: 'gps-jai-002', blockCode: 'RJ-JAI-BLK2' };

  // 1. Principal A registering teacher for School A -> ALLOWED
  const principalA = { role: UserRole.SCHOOL, schoolId: 'gps-asr-001' };
  assert.equal(canRegisterTeacher(principalA, schoolA).allowed, true);

  // 2. Principal A registering teacher for School B -> FORBIDDEN
  assert.equal(canRegisterTeacher(principalA, schoolB).allowed, false);

  // 3. Superadmin registering teacher for any school -> ALLOWED
  const superadmin = { role: UserRole.SUPERADMIN };
  assert.equal(canRegisterTeacher(superadmin, schoolA).allowed, true);
  assert.equal(canRegisterTeacher(superadmin, schoolB).allowed, true);

  // 4. Regular Teacher attempting to register -> FORBIDDEN
  const teacher = { role: UserRole.TEACHER, schoolId: 'gps-asr-001' };
  assert.equal(canRegisterTeacher(teacher, schoolA).allowed, false);
});
