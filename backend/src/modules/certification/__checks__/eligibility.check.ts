/**
 * Runnable assert script for the new (Mongoose) backend's eligibility engine.
 *
 * Invoked via:
 *   npx tsx backend/src/modules/certification/__checks__/eligibility.check.ts
 *
 * Exits 0 on success, 1 on any failed assertion. No new dependencies.
 */
import { strict as assert } from 'node:assert';
import {
  decideEligibility,
  EligibilityDecision,
} from '../services/eligibility.service';
import { ICompetencyRequirement } from '../../../interfaces/competency/competency.interface';
import { Certification } from '../models/certification.model';

// A representative mandatory-requirement set for class 3 at level 5, matching
// backend/src/data/competencyRequirements.seed.json. Used by every case below.
const REQUIREMENTS_CLASS3_L5: ICompetencyRequirement[] = [
  { classNumber: 3, level: 5, topic: 'Number Sense', isMandatory: true, meetsThreshold: 'Strong' },
  { classNumber: 3, level: 5, topic: 'Number Operations', isMandatory: true, meetsThreshold: 'Strong' },
  { classNumber: 3, level: 5, topic: 'Fractions', isMandatory: true, meetsThreshold: 'Satisfactory' },
  { classNumber: 3, level: 5, topic: 'Measurement', isMandatory: true, meetsThreshold: 'Satisfactory' },
  { classNumber: 3, level: 5, topic: 'Money', isMandatory: true, meetsThreshold: 'Strong' },
];

const TS = '2026-08-02T10:00:00.000Z';

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

console.log('eligibility engine — new backend');

// Case 1: full mastery → eligible.
check('full mastery → eligible', () => {
  const decision: EligibilityDecision = decideEligibility(
    REQUIREMENTS_CLASS3_L5,
    {
      'Number Sense': 'Strong',
      'Number Operations': 'Strong',
      Fractions: 'Strong',
      Measurement: 'Satisfactory',
      Money: 'Strong',
    },
    TS
  );
  assert.equal(decision.outcome, 'eligible');
  assert.deepEqual(decision.missingTopics, []);
  assert.deepEqual(decision.unassessedTopics, []);
  assert.equal(decision.metTopics.length, 5);
});

// Case 2: one missing competency → not_eligible with correct detail.
check('one missing → not_eligible', () => {
  const decision = decideEligibility(
    REQUIREMENTS_CLASS3_L5,
    {
      'Number Sense': 'Strong',
      'Number Operations': 'Needs Practice', // below Strong threshold
      Fractions: 'Strong',
      Measurement: 'Satisfactory',
      Money: 'Strong',
    },
    TS
  );
  assert.equal(decision.outcome, 'not_eligible');
  assert.deepEqual(decision.missingTopics, ['Number Operations']);
  assert.deepEqual(decision.unassessedTopics, []);
});

// Case 3: unassessed competency → insufficient_evidence.
check('unassessed → insufficient_evidence', () => {
  const decision = decideEligibility(
    REQUIREMENTS_CLASS3_L5,
    {
      'Number Sense': 'Strong',
      'Number Operations': 'Strong',
      // Fractions intentionally absent
      Measurement: 'Satisfactory',
      Money: 'Strong',
    },
    TS
  );
  assert.equal(decision.outcome, 'insufficient_evidence');
  assert.deepEqual(decision.unassessedTopics, ['Fractions']);
  assert.deepEqual(decision.missingTopics, []);
});

// Case 4: re-assessment improving status (was not_eligible, now eligible).
check('re-assessment: not_eligible → eligible', () => {
  const first = decideEligibility(
    REQUIREMENTS_CLASS3_L5,
    {
      'Number Sense': 'Strong',
      'Number Operations': 'Needs Practice',
      Fractions: 'Strong',
      Measurement: 'Satisfactory',
      Money: 'Strong',
    },
    '2026-06-15T10:00:00.000Z'
  );
  assert.equal(first.outcome, 'not_eligible');

  const second = decideEligibility(
    REQUIREMENTS_CLASS3_L5,
    {
      'Number Sense': 'Strong',
      'Number Operations': 'Strong', // improved
      Fractions: 'Strong',
      Measurement: 'Satisfactory',
      Money: 'Strong',
    },
    '2026-08-02T10:00:00.000Z'
  );
  assert.equal(second.outcome, 'eligible');
  assert.deepEqual(second.missingTopics, []);
});

// Case 5: post-certification data correction → not_eligible verdict
// (the orchestration layer in legacy/certificationRecords.ts is what would
// transition an active cert to review_needed; the engine itself only
// produces the verdict).
check('post-cert correction → not_eligible verdict', () => {
  const corrected = decideEligibility(
    REQUIREMENTS_CLASS3_L5,
    {
      'Number Sense': 'Strong',
      'Number Operations': 'Strong',
      Fractions: 'Needs Practice', // graded down
      Measurement: 'Satisfactory',
      Money: 'Strong',
    },
    '2026-08-02T10:00:00.000Z'
  );
  assert.equal(corrected.outcome, 'not_eligible');
  assert.deepEqual(corrected.missingTopics, ['Fractions']);
});

// Bonus: Satisfactory threshold met by either Strong or Satisfactory.
check('Satisfactory threshold met by Strong or Satisfactory, not Needs Practice', () => {
  const reqs: ICompetencyRequirement[] = [
    { classNumber: 2, level: 5, topic: 'Shapes', isMandatory: true, meetsThreshold: 'Satisfactory' },
  ];
  assert.equal(
    decideEligibility(reqs, { Shapes: 'Strong' }, TS).outcome,
    'eligible'
  );
  assert.equal(
    decideEligibility(reqs, { Shapes: 'Satisfactory' }, TS).outcome,
    'eligible'
  );
  assert.equal(
    decideEligibility(reqs, { Shapes: 'Needs Practice' }, TS).outcome,
    'not_eligible'
  );
});

console.log('\nadmin review resolve — new backend');

// The new backend has no resolveCertificationReview helper this phase (no
// route, no evaluation-creation flow that produces review_needed rows).
// The 4 resolve-path cases live in the legacy mirror script
// (backend/src/__checks__/certification.check.ts). The parity guard below
// catches schema drift if a future change drops 'revoked' from the
// Mongoose STATUSES array.
check('Mongoose Certification schema accepts "revoked" status', () => {
  // Mongoose 8 stores enum on path.options.enum as { values: string[], message: string }.
  const statusEnum: string[] | undefined = (Certification.schema.path('status') as any).options?.enum?.values;
  assert.ok(Array.isArray(statusEnum), 'status path must declare an enum');
  assert.ok(
    statusEnum.includes('revoked'),
    `STATUSES must include 'revoked', got: ${JSON.stringify(statusEnum)}`
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);