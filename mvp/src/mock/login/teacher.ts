import { User, UserRole } from '../../types';

// Teacher data to be saved here for the login
// It is created by the superadmin
export const initialTeacherLogins: User[] = [
  { id: 'u6', email: 'gps-mt-001.t01@fln.org', name: 'Ritu Sharma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-mt-001' }
];