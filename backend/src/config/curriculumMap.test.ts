import assert from 'node:assert';
import { CURRICULUM_MAPPING, isBalvatikaStage } from './curriculumMap';

let passed = 0;

for (const [level, config] of Object.entries(CURRICULUM_MAPPING)) {
  const levelNumber = Number(level);
  const expected = config.stage === 3;

  assert.strictEqual(
    isBalvatikaStage(levelNumber),
    expected,
    `Level ${levelNumber}: expected ${expected} for stage ${config.stage}`
  );

  passed++;
}

console.log(`PASS  isBalvatikaStage matches all ${passed} curriculum levels`);

for (let level = 1; level <= 109; level++) {
  assert.strictEqual(
    isBalvatikaStage(level),
    level >= 19 && level <= 46,
    `Level ${level}`
  );
}