import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { dbStore, UserRole, User, Student } from './db';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
export const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync('Fln@2026', 10);
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
if (JWT_SECRET === 'dev-insecure-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('[auth] WARNING: JWT_SECRET is unset in production — set it to a strong random value.');
}

// Verifies the signed JWT issued by /api/auth/login and resolves the current user
// from the database. There is deliberately NO role synthesis from the email/prefix:
// only real, seeded users with a valid signed token authenticate.
export function getAuthUser(req: express.Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  let payload: { email?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { email?: string };
  } catch {
    return null; // invalid signature or expired token
  }
  if (!payload?.email) return null;

  return dbStore.getUserSync(payload.email);
}

type SchoolArea = { stateCode?: string; districtCode?: string; blockCode?: string } | null | undefined;

const same = (a: unknown, b: unknown) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();

// Is this school inside the area a state, district or block admin looks after?
// The admin's own code is required (an account with none sees nothing), and when
// the account also carries its parent codes they must match too, so a district
// code that repeats in two states cannot reach across. Other roles: false.
export function adminAreaIncludesSchool(user: User, school: SchoolArea): boolean {
  if (!school) return false;
  const stateOk = !user.stateCode || same(school.stateCode, user.stateCode);
  const districtOk = !user.districtCode || same(school.districtCode, user.districtCode);
  switch (user.role) {
    case UserRole.ADMIN:
      return !!user.stateCode && same(school.stateCode, user.stateCode);
    case UserRole.DISTRICT_ADMIN:
      return !!user.districtCode && same(school.districtCode, user.districtCode) && stateOk;
    case UserRole.BLOCK_ADMIN:
      return !!user.blockCode && same(school.blockCode, user.blockCode) && districtOk && stateOk;
    default:
      return false;
  }
}

export function schoolIdPrefixForUser(user: User): string | null {
  if (user.role === UserRole.ADMIN && user.stateCode) {
    return user.stateCode.toUpperCase() + '_';
  }
  if (user.role === UserRole.DISTRICT_ADMIN && user.districtCode) {
    return user.districtCode.toUpperCase() + '_';
  }
  if (user.role === UserRole.BLOCK_ADMIN && user.blockCode) {
    return user.blockCode.toUpperCase() + '_';
  }
  return null;
}

// Authorization check for by-ID student endpoints (PATCH/diagnostic/diagnostic-submit,
// certification, observations, Aadhaar reveal). Mirrors the scoping applied to
// GET /api/students' list filtering, so nobody can act on a student outside their own
// school(s) or area by guessing/enumerating IDs (IDOR). A state, district or block
// admin reaches only the students of schools inside their area (FLN #737).
export async function canAccessStudent(user: User, student: Student): Promise<boolean> {
  switch (user.role) {
    case UserRole.SUPERADMIN:
      return true;
    case UserRole.ADMIN:
    case UserRole.DISTRICT_ADMIN:
    case UserRole.BLOCK_ADMIN:
      return adminAreaIncludesSchool(user, await dbStore.getSchoolById(student.schoolId));
    case UserRole.SCHOOL:
    case UserRole.TEACHER:
      return student.schoolId === user.schoolId;
    case UserRole.VOLUNTEER:
      return user.assignedSchools?.includes(student.schoolId) ?? false;
    default:
      return false;
  }
}

// Strip fields that must never be sent to clients (e.g. the bcrypt password hash).
export function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safe } = user;
  return safe;
}

// Express middleware requiring an authenticated user with SUPERADMIN role.
export function requireSuperadmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (user.role !== UserRole.SUPERADMIN) {
    return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
  }
  next();
}
