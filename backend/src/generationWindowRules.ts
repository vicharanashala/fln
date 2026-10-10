import { UserRole, WorksheetGenerationWindow } from './db';

export function getGenerationWindowStatus(
  window: WorksheetGenerationWindow,
  userRole: UserRole,
  currentTime: Date
): 'active' | 'teacher-priority-ended' | 'school-priority-not-started' | 'expired' {
  if (window.closed || currentTime >= new Date(window.end)){
    return 'expired';
  }

  if (
    userRole === UserRole.TEACHER &&
    currentTime >= new Date(window.teacherPriorityEnd)
  ) {
    return 'teacher-priority-ended';
  }

  if (
    userRole === UserRole.SCHOOL &&
    currentTime < new Date(window.teacherPriorityEnd)
  ) {
    return 'school-priority-not-started';
  }

  return 'active';
}

export function getLatestGenerationWindow(
  windows: WorksheetGenerationWindow[],
  classId?: string,
  cycle?: string
): WorksheetGenerationWindow | undefined {
  return windows
    .filter(
      window =>
        (!classId || window.classId === classId) &&
        (!cycle || window.cycle === cycle)
    )
    .sort(
      (a, b) =>
        new Date(b.start).getTime() - new Date(a.start).getTime()
    )[0];
}

export function isWorksheetGenerationLocked(
  worksheet?: { locks?: { locked: boolean } } | null
): boolean {
  return Boolean(worksheet && worksheet.locks?.locked);
}