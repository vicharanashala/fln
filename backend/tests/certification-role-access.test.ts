import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserRole } from '../src/db.js';
import { canViewStudentCertificate } from '../src/routes/certification.js';

test('per-student certificate access allows teachers and volunteers', () => {
  assert.equal(canViewStudentCertificate(UserRole.TEACHER), true);
  assert.equal(canViewStudentCertificate(UserRole.VOLUNTEER), true);
});

test('per-student certificate access denies school and administrative roles', () => {
  for (const role of [
    UserRole.SCHOOL,
    UserRole.SUPERADMIN,
    UserRole.ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.BLOCK_ADMIN,
  ]) {
    assert.equal(canViewStudentCertificate(role), false, `expected ${role} to be denied`);
  }
});
