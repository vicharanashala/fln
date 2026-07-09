import { User, UserRole } from '../../types';

// Superadmin data to be saved here for the login
export const initialSuperadminLogins: User[] = [
  { id: 'u1', email: 'superadmin@fln.org', name: 'Jinal Gupta', role: UserRole.SUPERADMIN }
];
