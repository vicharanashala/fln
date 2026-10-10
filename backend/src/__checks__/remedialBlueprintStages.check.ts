import assert from 'node:assert';
import { dbStore } from '../db';
import { createRemediationPlan } from '../services/remediationPlanService';
import { generateRemedialBlueprint } from '../services/remedialBlueprintService';

async function runCheck() {
  console.log('--- Running Check: Remedial Blueprint Stages (#677) ---');
  await dbStore.init();

  const plan = await createRemediationPlan('student_blueprint_01', 'S5.8', ['probe_s5.8']);
  const blueprint = await generateRemedialBlueprint(plan, { 'S5.8': 'Needs Practice' });

  assert.strictEqual(blueprint.planId, plan.id, 'Blueprint planId should match remediation plan id');
  assert.strictEqual(blueprint.studentId, 'student_blueprint_01', 'Blueprint studentId should match');

  // Verify all 3 stages exist
  const { supportedExample, focusedPractice, mixedTransferItem } = blueprint.stages;
  assert.notStrictEqual(supportedExample, undefined, 'Stage 1: supportedExample should exist');
  assert.ok(Array.isArray(focusedPractice) && focusedPractice.length >= 3, 'Stage 2: focusedPractice items should exist (>= 3 items)');
  assert.notStrictEqual(mixedTransferItem, undefined, 'Stage 3: mixedTransferItem should exist');

  // Verify items outside approved bank are flagged for teacher review
  for (const item of [supportedExample, ...focusedPractice, mixedTransferItem]) {
    assert.strictEqual(typeof item.isApprovedBank, 'boolean', 'isApprovedBank flag should be boolean');
    assert.strictEqual(typeof item.flaggedForReview, 'boolean', 'flaggedForReview flag should be boolean');
    if (!item.isApprovedBank) {
      assert.strictEqual(item.flaggedForReview, true, 'Unapproved bank item MUST be flagged for teacher review');
    }
  }

  // Verify blueprint is persisted in dbStore
  const blueprints = await dbStore.getRemedialBlueprints();
  const fetched = blueprints.find(b => b.id === blueprint.id);
  assert.notStrictEqual(fetched, undefined, 'Generated blueprint should be persisted in dbStore');

  console.log('✓ All checks passed for #677 Remedial Blueprint Stages!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
