import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPlacedStudents } from './worksheetBatch';

test('selects every placed student and derives missing current levels from placement history', () => {
  const students = Array.from({ length: 20 }, (_, index) => ({
    id: `student-${index + 1}`,
    currentLevel: index < 17 ? index + 1 : null,
    levelHistory: [{ level: index + 1 }]
  }));
  const result = selectPlacedStudents(students, students.map(student => student.id));
  assert.equal(result.targets.length, 20);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.targets[19].currentLevel, 20);
});