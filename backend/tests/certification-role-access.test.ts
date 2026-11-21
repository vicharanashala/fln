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


test('certificate concept metadata uses the Balvatika core concept list and NCF mapping', async () => {
  const { getCertificateConceptsForClass } = await import('../src/routes/certification.js');
  const concepts = getCertificateConceptsForClass(0);
  const coreIds = concepts.filter((concept) => concept.core).map((concept) => concept.id).sort();

  assert.deepEqual(coreIds, ['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.7']);
  assert.equal(concepts.find((concept) => concept.id === 'S3.1')?.competency, 'C-8.5');
  assert.equal(concepts.find((concept) => concept.id === 'S3.8')?.core, false);
});

test('certificate concept metadata covers Class 1 to Class 3 and rejects out-of-scope classes', async () => {
  const { getCertificateConceptsForClass } = await import('../src/routes/certification.js');

  for (const classNumber of [1, 2, 3]) {
    const concepts = getCertificateConceptsForClass(classNumber);
    assert.ok(concepts.length > 0, `expected curriculum concepts for class ${classNumber}`);
    assert.ok(concepts.every((concept) => typeof concept.id === 'string' && concept.id.length > 0));
  }

  assert.throws(() => getCertificateConceptsForClass(4), RangeError);
});
