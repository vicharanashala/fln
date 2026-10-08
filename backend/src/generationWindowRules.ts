import { UserRole } from './identity.types';
import type { WorksheetGenerationWindow } from './assessment.types';

export function getGenerationWindowStatus(
  window: WorksheetGenerationWindow,
  userRole: UserRole,
  currentTime: Date
): 'active' | 'teacher-priority-ended' | 'school-priority-not-started' | 'expired' {
  if (window.closed || currentTime >= new Date(window.end)) {
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