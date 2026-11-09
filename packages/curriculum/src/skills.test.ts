import assert from 'node:assert';
import { CORE_SKILLS, CURRICULUM_MAPPING, LEVEL_SKILLS, MAX_LEVEL, getSkill, tagsForLevel } from './index';

assert.strictEqual(CORE_SKILLS.length, 24, 'SK01 to SK24');
assert.deepStrictEqual(CORE_SKILLS.map(s => s.id), Array.from({ length: 24 }, (_, i) => `SK${String(i + 1).padStart(2, '0')}`));
const subIds = CORE_SKILLS.flatMap(s => s.subskills.map(x => x.id));
assert.strictEqual(new Set(subIds).size, subIds.length, 'subskill ids are unique');
assert.ok(CORE_SKILLS.every(s => s.subskills.length > 0 && s.subskills.every(x => x.id.startsWith(s.id + '.'))), 'every subskill id starts with its skill id');

assert.strictEqual(Object.keys(LEVEL_SKILLS).length, MAX_LEVEL, 'every level has a skill mapping');
for (let n = 1; n <= MAX_LEVEL; n++) {
  const m = LEVEL_SKILLS[n];
  assert.ok(CURRICULUM_MAPPING[n], `level ${n} exists in the curriculum`);
  assert.ok(m.primary.length > 0, `level ${n} has a primary skill`);
  assert.ok([...m.primary, ...m.supporting].every(id => getSkill(id)), `level ${n} refers only to real skills`);
  assert.ok(!m.primary.some(id => m.supporting.includes(id)), `level ${n}: a skill is not both primary and supporting`);
}
const t = tagsForLevel(1)!;
assert.deepStrictEqual(t.primarySkills.map(s => s.id), ['SK01']);
assert.ok(t.subskills.some(s => s.id === 'SK01.01' && s.skillId === 'SK01'));
assert.ok(!t.subskills.some(s => s.skillId === 'SK20'), 'a level offers only its own skills\' subskills');
assert.strictEqual(tagsForLevel(0), undefined);
assert.strictEqual(tagsForLevel(MAX_LEVEL + 1), undefined);
console.log('PASS  skills: 24 skills, unique subskills, all 109 levels mapped to real skills');
