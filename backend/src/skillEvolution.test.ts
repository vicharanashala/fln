/**
 * Tests for D1.6 Skill Evolution: candidate_skill + human validation (#481)
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npm run test:skill-evolution --workspace @fln/backend
 */
import assert from 'node:assert';
import { dbStore, CandidateSkill, Skill } from './db';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${error?.message || error}`);
  }
}

async function run() {
  await dbStore.init();
  console.log('\n--- D1.6 Candidate Skill Lifecycle (#481) ---');

  await test('A candidate_skill record can be created with evidence shape', async () => {
    const candidate: CandidateSkill = {
      id: 'C-018',
      parentSkillId: 'SK13.06',
      observedPattern: 'Fails regrouping when carry crosses tens boundary',
      evidence: {
        attemptsCount: 1248,
        affectedLearnersCount: 911,
        affectedLearnersPercentage: 73,
        questionTemplateIds: ['QT-ADD-01', 'QT-ADD-02'],
        errorTypes: ['conceptual'],
      },
      algorithmConfidence: 0.87,
      status: 'PENDING',
      proposedSubskillName: 'Tens Boundary Regrouping',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbStore.addCandidateSkill(candidate);
    const retrieved = await dbStore.getCandidateSkillById('C-018');

    assert.ok(retrieved, 'Candidate C-018 should be found');
    assert.strictEqual(retrieved.status, 'PENDING');
    assert.strictEqual(retrieved.evidence.attemptsCount, 1248);
    assert.strictEqual(retrieved.evidence.affectedLearnersPercentage, 73);
    assert.strictEqual(retrieved.algorithmConfidence, 0.87);
  });

  await test('Candidate list query supports filtering by status', async () => {
    const pending = await dbStore.getCandidateSkills({ status: 'PENDING' });
    assert.ok(pending.some(c => c.id === 'C-018'), 'Should include C-018 in pending list');

    const accepted = await dbStore.getCandidateSkills({ status: 'ACCEPTED' });
    assert.ok(!accepted.some(c => c.id === 'C-018'), 'Should NOT include C-018 in accepted list yet');
  });

  await test('No candidate reaches skill status without ACCEPT', async () => {
    // Skills collection should not contain any skill with candidateSourceId = 'C-018'
    const skills = await dbStore.getSkills();
    assert.ok(!skills.some(s => s.candidateSourceId === 'C-018'), 'Skill must not exist before validation');
  });

  await test('REJECT action updates candidate without creating a skill', async () => {
    const rejectCandidate: CandidateSkill = {
      id: 'C-019',
      parentSkillId: 'SK13.06',
      observedPattern: 'Spurious correlation on single question',
      evidence: {
        attemptsCount: 15,
        affectedLearnersCount: 3,
        affectedLearnersPercentage: 20,
        questionTemplateIds: ['QT-TEST'],
        errorTypes: ['careless'],
      },
      algorithmConfidence: 0.25,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbStore.addCandidateSkill(rejectCandidate);

    await dbStore.updateCandidateSkill('C-019', {
      status: 'REJECTED',
      validatedBy: 'curriculum-lead@fln.org',
      validatedAt: new Date().toISOString(),
      reviewNotes: 'Insufficient sample size, appears to be reading comprehension issue',
    });

    const updated = await dbStore.getCandidateSkillById('C-019');
    assert.strictEqual(updated?.status, 'REJECTED');
    assert.strictEqual(updated?.validatedBy, 'curriculum-lead@fln.org');

    const skills = await dbStore.getSkills();
    assert.ok(!skills.some(s => s.candidateSourceId === 'C-019'), 'Rejected candidate must never create a skill');
  });

  await test('ACCEPT promotes candidate to official Skill with matching provenance shape', async () => {
    const now = new Date().toISOString();
    const newSkill: Skill = {
      id: 'SK13.06.01',
      parentSkillId: 'SK13.06',
      name: 'Tens Boundary Regrouping',
      description: 'Fails regrouping when carry crosses tens boundary',
      sourceType: 'DISCOVERED_DATA',
      validationStatus: 'VALIDATED',
      createdBy: 'curriculum-lead@fln.org',
      validatedBy: 'curriculum-lead@fln.org',
      validatedAt: now,
      candidateSourceId: 'C-018',
      createdAt: now,
      updatedAt: now,
    };

    await dbStore.addSkill(newSkill);
    await dbStore.updateCandidateSkill('C-018', {
      status: 'ACCEPTED',
      validatedBy: 'curriculum-lead@fln.org',
      validatedAt: now,
      resultingSkillId: newSkill.id,
    });

    const candidate = await dbStore.getCandidateSkillById('C-018');
    assert.strictEqual(candidate?.status, 'ACCEPTED');
    assert.strictEqual(candidate?.resultingSkillId, 'SK13.06.01');

    const skill = await dbStore.getSkillById('SK13.06.01');
    assert.ok(skill, 'New skill must exist');
    assert.strictEqual(skill.sourceType, 'DISCOVERED_DATA');
    assert.strictEqual(skill.validationStatus, 'VALIDATED');
    assert.strictEqual(skill.candidateSourceId, 'C-018');
    assert.strictEqual(skill.validatedBy, 'curriculum-lead@fln.org');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
