import 'dotenv/config';
import { strict as assert } from 'node:assert';
import {
  getGenerationWindowStatus,
  getLatestGenerationWindow,
  isWorksheetGenerationLocked
} from '../generationWindowRules';
import { WorksheetGenerationWindow, UserRole } from '../db';

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

console.log('worksheet generation window checks');
const MINUTE = 60 * 1000;

function windowAt(minutesElapsed: number): WorksheetGenerationWindow & {
  currentTime: Date;
} {
  const start = new Date('2026-09-30T10:00:00.000Z');

  return {
    id: 'check-window',
    classId: 'check-class',
    cycle: 'Mid-year',
    schoolId: 'check-school',
    start: start.toISOString(),
    teacherPriorityEnd: new Date(
      start.getTime() + 30 * MINUTE
    ).toISOString(),
    end: new Date(
      start.getTime() + 60 * MINUTE
    ).toISOString(),
    generatedByRole: null,
    generatedByEmail: null,
    closed: false,
    currentTime: new Date(
      start.getTime() + minutesElapsed * MINUTE
    )
  };
}
check('teacher rejected after 30 minutes', () => {
  const window = windowAt(31);

  const status = getGenerationWindowStatus(
    window,
    UserRole.TEACHER,
    window.currentTime
  );

  assert.equal(status, 'teacher-priority-ended');
});

check('school rejected before 30 minutes', () => {
  const window = windowAt(29);

  const status = getGenerationWindowStatus(
    window,
    UserRole.SCHOOL,
    window.currentTime
  );

  assert.equal(status, 'school-priority-not-started');
});

check('generation rejected after 60 minutes', () => {
  const window = windowAt(61);

  const status = getGenerationWindowStatus(
    window,
    UserRole.TEACHER,
    window.currentTime
  );

  assert.equal(status, 'expired');
});

check('active window is accepted before expiry', () => {
  const window = windowAt(10);

  const status = getGenerationWindowStatus(
    window as any,
    'teacher' as any,
    window.currentTime
  );

  assert.equal(status, 'active');
});

check('restarted window is picked over expired one', () => {
  const expiredWindow = windowAt(61);
  const restartedWindow = {
    ...windowAt(10),
    start: '2026-09-30T11:01:00.000Z'
  };

  const windows = [expiredWindow, restartedWindow];

  const latestWindow = getLatestGenerationWindow(windows);

  assert.equal(latestWindow?.start, restartedWindow.start);
});

check('second-generation attempt is rejected (423 lock condition)', () => {
  const lockedWorksheet = {
    locks: { locked: true }
  };
  assert.equal(isWorksheetGenerationLocked(lockedWorksheet), true);

  const unlockedWorksheet = {
    locks: { locked: false }
  };
  assert.equal(isWorksheetGenerationLocked(unlockedWorksheet), false);
});

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}