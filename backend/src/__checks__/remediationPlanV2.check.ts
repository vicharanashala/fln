import assert from 'node:assert';
import { dbStore } from '../db';
import { createRemediationPlan, computePrerequisiteDepths } from '../services/remediationPlanService';

async function runCheck() {
  console.log('--- Running Check: Remediation Plan V2 (#676) ---');
  await dbStore.init();

  // Test target concept S5.8 (Multiplication Tables) which has prerequisites
  const plan = await createRemediationPlan('student_001', 'S5.8', ['probe_S5.8_01']);

  assert.strictEqual(plan.studentId, 'student_001', 'Plan should store studentId');
  assert.strictEqual(plan.targetConceptId, 'S5.8', 'Plan should store targetConceptId by S-code');
  assert.notStrictEqual(plan.orderedGaps.length, 0, 'Ordered gaps list should not be empty');
  assert.notStrictEqual(plan.rationale, '', 'Plan rationale should be present and non-empty');
  assert.strictEqual(typeof plan.deepestGapConceptId, 'string', 'Deepest gap concept ID should be a string');

  // Verify deepest gap is prioritized first (depth descending)
  const gaps = plan.orderedGaps;
  for (let i = 0; i < gaps.length - 1; i++) {
    assert.ok(
      gaps[i].depth >= gaps[i + 1].depth,
      `Gap at index ${i} depth (${gaps[i].depth}) should be >= gap at index ${i + 1} depth (${gaps[i + 1].depth})`
    );
  }

  // Verify stored plan can be read from dbStore
  const plans = await dbStore.getRemediationPlans();
  const fetched = plans.find(p => p.id === plan.id);
  assert.notStrictEqual(fetched, undefined, 'Created plan should be persisted in dbStore');

  console.log('✓ All checks passed for #676 Remediation Plan V2!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
