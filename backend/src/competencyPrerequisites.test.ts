/**
 * Tests for the prerequisite graph and its AND/OR group overrides.
 *
 * Plain-script convention (node:assert, no runner). Run with:
 *   npm run test:competency-prerequisites --workspace @fln/backend
 *
 * Two things are being pinned here:
 *
 *  1. The graph invariants `index.ts` refuses to boot without (known conceptIds
 *     on both sides of every edge, no cycles).
 *
 *  2. #523's proposed S5.8 OR case. The override map is populated, but both of
 *     its groups are `status: 'PROPOSED'` pending Pavani's sign-off, and only
 *     VALIDATED groups gate. So S5.8 must still behave exactly like the flat
 *     AND list it had before the override existed, and the OR must switch on the
 *     moment a group's status flips. The activation path is exercised by
 *     injecting a VALIDATED copy of the override rather than mutating the
 *     module's const.
 *
 * Pure functions only - no DB, no network.
 */
import assert from 'node:assert';
import { getLevelForConcept } from './config/curriculumMap';
import {
  CONCEPT_PREREQUISITE_GROUP_OVERRIDES,
  CONCEPT_PREREQUISITES,
  directPrerequisites,
  effectiveHardPrerequisiteGroups,
  isPrerequisiteSatisfied,
  prerequisiteGroups,
  resolvePrerequisites,
  validateConceptPrerequisites,
  type PrerequisiteGroup,
} from './competencyPrerequisites';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${error?.message || error}`);
  }
}

const mastered = (...ids: string[]): ReadonlySet<string> => new Set(ids);

/** The S5.8 override exactly as it stands in the source map. */
const s58Override = CONCEPT_PREREQUISITE_GROUP_OVERRIDES['S5.8'];

/** The same override with the sign-off the policy requires applied. */
const approvedS58: PrerequisiteGroup[] = (s58Override ?? []).map(g => ({ ...g, status: 'VALIDATED' as const }));

console.log('graph invariants (index.ts refuses to boot without these)');

test('validateConceptPrerequisites() finds no unknown conceptIds', () => {
  const report = validateConceptPrerequisites();
  assert.deepStrictEqual(report.unknownConceptIds, []);
  assert.strictEqual(report.isValid, true);
});

test('validateConceptPrerequisites() finds no cycles', () => {
  const report = validateConceptPrerequisites();
  assert.deepStrictEqual(report.cycles, []);
});

console.log('\n#523: the proposed S5.8 OR override is present and well formed');

test('S5.8 is the only overridden concept', () => {
  assert.deepStrictEqual(Object.keys(CONCEPT_PREREQUISITE_GROUP_OVERRIDES), ['S5.8']);
});

test('S5.8 override declares two alternative routes', () => {
  assert.ok(s58Override, 'expected an S5.8 override');
  assert.strictEqual(s58Override.length, 2);
});

test('each S5.8 route is a single-member AND group, i.e. an OR across groups', () => {
  assert.ok(s58Override);
  // A plain OR of two single-concept routes is two one-member AND-groups.
  // Collapsing it into one group holding both ids would silently mean AND.
  assert.deepStrictEqual(s58Override.map(g => g.memberIds.length), [1, 1]);
  assert.deepStrictEqual(s58Override.map(g => g.memberIds[0]).sort(), ['S5.19', 'S5.6']);
  assert.ok(s58Override.every(g => g.type === 'AND'));
});

test('both S5.8 routes are hard prerequisites carrying rationale and evidence', () => {
  assert.ok(s58Override);
  for (const g of s58Override) {
    assert.strictEqual(g.relationshipType, 'HARD_PREREQUISITE');
    assert.ok(g.rationale && g.rationale.length > 0, `${g.groupId} needs a written rationale`);
    assert.strictEqual(g.evidence?.sourceType, 'EXPERT');
  }
});

test('both S5.8 routes are PROPOSED, not VALIDATED (sign-off still outstanding)', () => {
  assert.ok(s58Override);
  assert.deepStrictEqual(s58Override.map(g => g.status), ['PROPOSED', 'PROPOSED']);
});

test('every overridden memberId is a real conceptId', () => {
  for (const [conceptId, groups] of Object.entries(CONCEPT_PREREQUISITE_GROUP_OVERRIDES)) {
    assert.ok(getLevelForConcept(conceptId), `${conceptId} is not in the curriculum registry`);
    for (const g of groups) {
      for (const member of g.memberIds) {
        assert.ok(getLevelForConcept(member), `${conceptId}/${g.groupId} references unknown ${member}`);
      }
    }
  }
});

console.log('\n#523 AC3: S5.4 and S6.5 stay flat AND - no override on assumption (#466)');

test('no override exists for S5.4 or S6.5', () => {
  assert.strictEqual(CONCEPT_PREREQUISITE_GROUP_OVERRIDES['S5.4'], undefined);
  assert.strictEqual(CONCEPT_PREREQUISITE_GROUP_OVERRIDES['S6.5'], undefined);
});

test('S5.4 still requires both of its prerequisites', () => {
  assert.deepStrictEqual(directPrerequisites('S5.4'), ['S4.6', 'S5.2']);
  assert.strictEqual(isPrerequisiteSatisfied('S5.4', mastered('S4.6')), false);
  assert.strictEqual(isPrerequisiteSatisfied('S5.4', mastered('S4.6', 'S5.2')), true);
});

console.log('\n#523: a PROPOSED override gates nobody - S5.8 keeps today\'s AND behaviour');

test('S5.8 is NOT satisfied by skip-counting alone while the OR is only proposed', () => {
  assert.strictEqual(isPrerequisiteSatisfied('S5.8', mastered('S5.19')), false);
});

test('S5.8 is NOT satisfied by repeated addition alone while the OR is only proposed', () => {
  assert.strictEqual(isPrerequisiteSatisfied('S5.8', mastered('S5.6')), false);
});

test('S5.8 is satisfied by both prerequisites, exactly as before #523', () => {
  assert.strictEqual(isPrerequisiteSatisfied('S5.8', mastered('S5.6', 'S5.19')), true);
});

test('an unapproved override falls back to the flat CONCEPT_PREREQUISITES AND list', () => {
  assert.deepStrictEqual(
    effectiveHardPrerequisiteGroups('S5.8').map(g => g.memberIds),
    [directPrerequisites('S5.8')],
  );
});

test('a DEPRECATED group does not gate either', () => {
  const deprecated: PrerequisiteGroup[] = [
    { groupId: 'g1', type: 'AND', memberIds: ['S5.6'], relationshipType: 'HARD_PREREQUISITE', status: 'DEPRECATED' },
  ];
  assert.deepStrictEqual(
    effectiveHardPrerequisiteGroups('S5.8', { 'S5.8': deprecated }).map(g => g.memberIds),
    [directPrerequisites('S5.8')],
  );
});

console.log('\n#523: flipping status to VALIDATED activates the OR');

test('once approved, skip-counting alone satisfies S5.8', () => {
  const gate = (m: ReadonlySet<string>) =>
    effectiveHardPrerequisiteGroups('S5.8', { 'S5.8': approvedS58 })
      .some(g => g.memberIds.every(id => m.has(id)));
  assert.strictEqual(gate(mastered('S5.19')), true);
  assert.strictEqual(gate(mastered('S5.6')), true);
  assert.strictEqual(gate(mastered('S5.6', 'S5.19')), true);
  assert.strictEqual(gate(mastered()), false);
});

test('an approved multi-member route still requires ALL of its members (AND within a group)', () => {
  const bothRoutesTogether: PrerequisiteGroup[] = [
    { groupId: 'g1', type: 'AND', memberIds: ['S5.6', 'S5.19'], relationshipType: 'HARD_PREREQUISITE', status: 'VALIDATED' },
  ];
  const gate = (m: ReadonlySet<string>) =>
    effectiveHardPrerequisiteGroups('S5.8', { 'S5.8': bothRoutesTogether })
      .some(g => g.memberIds.every(id => m.has(id)));
  assert.strictEqual(gate(mastered('S5.6')), false);
  assert.strictEqual(gate(mastered('S5.6', 'S5.19')), true);
});

console.log('\nthe proposal stays visible for review even while it gates nothing');

test('prerequisiteGroups() surfaces the proposed S5.8 OR', () => {
  assert.deepStrictEqual(prerequisiteGroups('S5.8'), s58Override);
});

test('a concept with no override still resolves to one implicit AND group', () => {
  const groups = prerequisiteGroups('S5.4');
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].type, 'AND');
  assert.strictEqual(groups[0].status, 'VALIDATED');
  assert.deepStrictEqual(groups[0].memberIds, ['S4.6', 'S5.2']);
});

console.log('\nunrelated graph behaviour is untouched');

test('an entry node has no prerequisites and is satisfied by an empty set', () => {
  assert.strictEqual(CONCEPT_PREREQUISITES['S1.1'], undefined);
  assert.deepStrictEqual(prerequisiteGroups('S1.1'), []);
  assert.strictEqual(isPrerequisiteSatisfied('S1.1', mastered()), true);
});

test('an unknown conceptId resolves to no groups and is satisfied', () => {
  assert.deepStrictEqual(prerequisiteGroups('S9.99'), []);
  assert.strictEqual(isPrerequisiteSatisfied('S9.99', mastered()), true);
});

test('the S5.8 teaching chain is unchanged - both routes still listed', () => {
  // An OR is about gating, not about the order a teacher works in, so the
  // transitive teaching sequence must still contain both concepts.
  assert.deepStrictEqual(directPrerequisites('S5.8'), ['S5.6', 'S5.19']);
  const chain = resolvePrerequisites('S5.8');
  assert.ok(chain.includes('S5.6'), 'expected S5.6 in the transitive chain');
  assert.ok(chain.includes('S5.19'), 'expected S5.19 in the transitive chain');
});

test('resolvePrerequisites() does not repeat a concept reachable by two routes', () => {
  // S7.3 -> S6.5 -> S5.4 -> S5.2  and  S7.3 -> S6.5 -> S6.1 -> S5.3 -> S5.2
  const chain = resolvePrerequisites('S7.3');
  assert.ok(chain.includes('S5.2'), 'expected S5.2 in the transitive chain');
  assert.strictEqual(chain.filter(id => id === 'S5.2').length, 1);
  assert.strictEqual(new Set(chain).size, chain.length);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
