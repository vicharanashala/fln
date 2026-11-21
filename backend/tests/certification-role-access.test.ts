import { describe, expect, it } from 'vitest';
import { UserRole } from '../src/db';
import { canViewStudentCertificate } from '../src/routes/certification';

describe('per-student certificate role access', () => {
  it('allows teachers and assigned volunteers to request a certificate', () => {
    expect(canViewStudentCertificate(UserRole.TEACHER)).toBe(true);
    expect(canViewStudentCertificate(UserRole.VOLUNTEER)).toBe(true);
  });

  it('denies school/principal and administrative roles', () => {
    expect(canViewStudentCertificate(UserRole.SCHOOL)).toBe(false);
    expect(canViewStudentCertificate(UserRole.SUPERADMIN)).toBe(false);
    expect(canViewStudentCertificate(UserRole.ADMIN)).toBe(false);
    expect(canViewStudentCertificate(UserRole.DISTRICT_ADMIN)).toBe(false);
    expect(canViewStudentCertificate(UserRole.BLOCK_ADMIN)).toBe(false);
  });
});
