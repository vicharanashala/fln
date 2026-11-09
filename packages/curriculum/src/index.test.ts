import assert from 'node:assert';
import { CURRICULUM_MAPPING, MAX_LEVEL, MVP_MAX_LEVEL, CLASS_LEVEL_RANGES, classForLevel, isBalvatikaStage } from './index';

assert.strictEqual(MAX_LEVEL, 109, 'the curriculum map has 109 levels');
assert.strictEqual(Object.keys(CURRICULUM_MAPPING).length, MAX_LEVEL, 'no gaps in level numbers');
assert.strictEqual(MVP_MAX_LEVEL, 91, 'FLN stops at the end of Class 3');

// The class ranges tile levels 19..91 with no gap and no overlap.
const ranges = Object.values(CLASS_LEVEL_RANGES);
for (let i = 1; i < ranges.length; i++) assert.strictEqual(ranges[i][0], ranges[i - 1][1] + 1, 'class ranges are contiguous');

assert.strictEqual(classForLevel(18), undefined, 'pre-Balvatika levels have no FLN class');
assert.strictEqual(classForLevel(19), 'Balvatika');
assert.strictEqual(classForLevel(46), 'Balvatika');
assert.strictEqual(classForLevel(47), 'Class 1');
assert.strictEqual(classForLevel(91), 'Class 3');
assert.strictEqual(classForLevel(92), 'Beyond MVP');
assert.strictEqual(classForLevel(109), 'Beyond MVP');
assert.strictEqual(classForLevel(110), undefined);
assert.strictEqual(classForLevel(0), undefined);
assert.strictEqual(classForLevel(2.5), undefined);

// The Balvatika class range agrees with the stage flag in the map itself.
for (let l = 1; l <= MAX_LEVEL; l++) assert.strictEqual(classForLevel(l) === 'Balvatika', isBalvatikaStage(l), `level ${l}`);

console.log('PASS  curriculum index: 109 levels, class ranges, MVP stop at 91');

import { listLevels, groupForLevel, MAX_LEVEL as MAX } from './index';
import assert2 from 'node:assert';
{
  const levels = listLevels();
  assert2.strictEqual(levels.length, MAX, 'one record per level');
  assert2.deepStrictEqual(levels.map(l => l.levelNumber), Array.from({ length: MAX }, (_, i) => i + 1), 'levels run 1..max with no gaps');
  assert2.ok(levels.every(l => l.levelTitle.length > 0 && l.conceptId.length > 0), 'every level has a title and a concept');
  assert2.strictEqual(groupForLevel(1), 'Before Balvatika');
  assert2.strictEqual(groupForLevel(MAX), 'Beyond MVP');
  assert2.strictEqual(new Set(levels.map(l => l.conceptId)).size, MAX, 'conceptIds are unique');
  console.log('PASS  listLevels: all levels, in order, unique concepts, grouped');
}
