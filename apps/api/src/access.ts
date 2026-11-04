import type { ClassGroup, User } from './types';

/** Superadmin sees everything; a school account sees its own school; a teacher sees only their own classes. */
export function canAccessClass(user: User, cls: ClassGroup): boolean {
  if (user.role === 'superadmin') return true;
  if (user.role === 'school') return !!user.schoolId && user.schoolId === cls.schoolId;
  return user.role === 'teacher' && !!user.schoolId && user.schoolId === cls.schoolId && cls.teacherId === user.id;
}
