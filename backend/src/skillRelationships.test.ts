import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  getAllSkillRelationships,
  getRelationshipsForTargetSkill,
  getSkillPrerequisites,
  isSkillPrerequisiteSatisfied,
  validateSkillRelationships,
} from './skillRelationships.js';

describe('SK13 Skill Relationship Graph (Issue #483 / D1.2)', () => {
  test('Graph validation passes with zero unknown IDs and zero cycles', () => {
    const report = validateSkillRelationships();
    assert.strictEqual(report.isValid, true, 'Skill relationship graph must be valid');
    assert.strictEqual(report.unknownSkillIds.length, 0, 'No unknown skill IDs');
    assert.strictEqual(report.cycles.length, 0, 'Graph must be acyclic');
    assert.strictEqual(report.totalRelationships, 11, 'Must contain 11 relationship edges');
    assert.strictEqual(report.totalSkillsWithPrerequisites, 9, '9 skills carry prerequisite rules (SK13.02-SK13.10)');
  });

  test('All 10 subskills SK13.01-SK13.10 are represented in the graph chain', () => {
    const allRels = getAllSkillRelationships();
    const subskillIds = Array.from({ length: 10 }, (_, i) => `SK13.${String(i + 1).padStart(2, '0')}`);

    // SK13.01 is an entry node
    const sk13_01_prereqs = getSkillPrerequisites('SK13.01');
    assert.strictEqual(sk13_01_prereqs.routes.length, 0, 'SK13.01 is entry node with no prerequisites');

    // SK13.02 to SK13.10 must all have prerequisite routes
    for (let i = 2; i <= 10; i++) {
      const id = `SK13.${String(i).padStart(2, '0')}`;
      const rels = getRelationshipsForTargetSkill(id);
      assert.ok(rels.length > 0, `${id} must have prerequisite relationships configured`);
    }
  });

  test('Ruling 2: SK13.02 (concrete addition) strictly requires SK13.01 with no OR bypass', () => {
    const result = getSkillPrerequisites('SK13.02');
    assert.strictEqual(result.routes.length, 1, 'SK13.02 must have exactly 1 prerequisite route');
    assert.strictEqual(result.routes[0].groupId, 'g1');
    assert.deepStrictEqual(result.routes[0].members, ['SK13.01']);
    assert.strictEqual(result.routes[0].relationshipType, 'PREREQUISITE');
  });

  test('Ruling 3: SK13.06 (two-digit addition) has two valid AND-routes in an OR-group', () => {
    const result = getSkillPrerequisites('SK13.06');
    assert.strictEqual(result.routes.length, 2, 'SK13.06 must have exactly 2 valid prerequisite routes');

    const route1 = result.routes.find(r => r.groupId === 'g1');
    const route2 = result.routes.find(r => r.groupId === 'g2');

    assert.ok(route1, 'Route 1 (g1) must exist');
    assert.ok(route2, 'Route 2 (g2) must exist');

    // Route 1: via SK13.05 (Addition within 30)
    assert.deepStrictEqual(route1.members, ['SK13.05']);

    // Route 2: via SK13.04 (Addition within 20) + SK12 (Place Value)
    assert.strictEqual(route2.members.length, 2);
    assert.ok(route2.members.includes('SK13.04'), 'Route 2 includes SK13.04');
    assert.ok(route2.members.includes('SK12'), 'Route 2 includes SK12 (Place Value)');
    assert.strictEqual(route2.relationshipType, 'AND');
  });

  test('isSkillPrerequisiteSatisfied correctly evaluates OR-group pathways for SK13.06', () => {
    // Route 1 satisfied (SK13.05 mastered)
    assert.strictEqual(
      isSkillPrerequisiteSatisfied('SK13.06', ['SK13.05']),
      true,
      'SK13.06 satisfied via Route 1 (SK13.05)'
    );

    // Route 2 satisfied (SK13.04 AND SK12 mastered)
    assert.strictEqual(
      isSkillPrerequisiteSatisfied('SK13.06', ['SK13.04', 'SK12']),
      true,
      'SK13.06 satisfied via Route 2 (SK13.04 + SK12)'
    );

    // Incomplete Route 2 (only SK13.04) -> Not satisfied
    assert.strictEqual(
      isSkillPrerequisiteSatisfied('SK13.06', ['SK13.04']),
      false,
      'SK13.06 not satisfied with only SK13.04'
    );

    // Incomplete Route 2 (only SK12) -> Not satisfied
    assert.strictEqual(
      isSkillPrerequisiteSatisfied('SK13.06', ['SK12']),
      false,
      'SK13.06 not satisfied with only SK12'
    );

    // Empty mastered set -> Not satisfied
    assert.strictEqual(
      isSkillPrerequisiteSatisfied('SK13.06', []),
      false,
      'SK13.06 not satisfied with empty mastered skills'
    );
  });

  test('Linear subskill chain SK13.07 through SK13.10', () => {
    assert.deepStrictEqual(getSkillPrerequisites('SK13.07').routes[0].members, ['SK13.06']);
    assert.deepStrictEqual(getSkillPrerequisites('SK13.08').routes[0].members, ['SK13.07']);
    assert.deepStrictEqual(getSkillPrerequisites('SK13.09').routes[0].members, ['SK13.08']);
    assert.deepStrictEqual(getSkillPrerequisites('SK13.10').routes[0].members, ['SK13.09']);
  });
});
