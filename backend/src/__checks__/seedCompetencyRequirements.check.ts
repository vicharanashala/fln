import { strict as assert } from 'node:assert';
import { getSeedCompetencyRequirements } from '../db.js';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    ', err instanceof Error ? err.message : String(err));
    failed++;
  }
}

console.log('db — seedCompetencyRequirements ESM check');

check('getSeedCompetencyRequirements() returns 16 seed entries under ESM', () => {
  const competencyRequirements = getSeedCompetencyRequirements();
  assert.ok(Array.isArray(competencyRequirements), 'competencyRequirements should be an array');
  assert.equal(
    competencyRequirements.length,
    16,
    `Expected 16 competency requirements, got ${competencyRequirements.length}`
  );
});

check('each competency requirement entry contains required fields', () => {
  const competencyRequirements = getSeedCompetencyRequirements();
  for (const req of competencyRequirements) {
    assert.ok(typeof req.classNumber === 'number', 'classNumber must be number');
    assert.ok(typeof req.level === 'number', 'level must be number');
    assert.ok(typeof req.topic === 'string', 'topic must be string');
    assert.ok(typeof req.meetsThreshold === 'string', 'meetsThreshold must be string');
    assert.ok(typeof req.isMandatory === 'boolean', 'isMandatory must be boolean');
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
