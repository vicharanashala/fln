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

// Authorization check for by-ID student endpoints (PATCH/diagnostic/diagnostic-submit).
// Mirrors the scoping already applied to GET /api/students' list filtering, so a
// teacher/volunteer/school user can't act on a student outside their own school(s)
// by guessing/enumerating IDs (IDOR). Superadmin/state/district/block admins keep
// their existing broad access — restricting THAT scope is a separate, tracked fix.
export function canAccessStudent(user: User, student: Student): boolean {
  switch (user.role) {
    case UserRole.SUPERADMIN:
    case UserRole.ADMIN:
    case UserRole.DISTRICT_ADMIN:
    case UserRole.BLOCK_ADMIN:
      return true;
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
