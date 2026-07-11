import { connectDatabase, disconnectDatabase } from './config/db.js';
import { User } from './modules/users/user.model.js';
import { authService } from './modules/auth/auth.service.js';
import { UserRole } from './shared/enums.js';

/**
 * Seed a demo Superadmin + Teacher when no users exist. Idempotent.
 *
 * Superadmin: superadmin@fln.org / Admin@123
 * Teacher:    teacher@fln.org    / Teach@123   (Class 3, Section A)
 */
export async function runSeed(): Promise<void> {
  if ((await User.countDocuments()) > 0) return;

  await authService.createUser({
    email: 'superadmin@fln.org',
    name: 'Super Admin',
    password: 'Admin@123',
    role: UserRole.SUPERADMIN,
  });
  await authService.createUser({
    email: 'teacher@fln.org',
    name: 'Anita Sharma',
    password: 'Teach@123',
    role: UserRole.TEACHER,
    schoolId: 'gps-mt-001',
    schoolName: 'Govt. Primary School, Mt. Road',
    classGrade: 3,
    section: 'A',
  });
  console.log('  Seeded demo users (superadmin@fln.org / teacher@fln.org).');
}

// Allow `npm run seed` standalone.
if (process.argv[1]?.endsWith('seed.ts')) {
  connectDatabase()
    .then(runSeed)
    .then(disconnectDatabase)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
