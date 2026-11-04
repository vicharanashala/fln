export type Role = 'superadmin' | 'school' | 'teacher';
export const ROLES: readonly Role[] = ['superadmin', 'school', 'teacher'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Required for school and teacher accounts; absent for superadmin. */
  schoolId?: string;
  passwordHash: string;
  isBanned?: boolean;
}

export interface School { id: string; name: string }

export interface ClassGroup {
  id: string;
  schoolId: string;
  /** Display name such as "Balvatika" or "Class 1". */
  className: string;
  section: string;
  teacherId: string;
}

export interface Student {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  currentLevel: number;
}

/** What the API puts in a response; never includes the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;
