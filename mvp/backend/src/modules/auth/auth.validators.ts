import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// SRS §3.2 A-3: min 8 chars, 1 uppercase, 1 number, 1 special char.
const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[0-9]/, 'Password needs a number')
  .regex(/[^A-Za-z0-9]/, 'Password needs a special character');

export const createTeacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordRule,
  schoolId: z.string().optional(),
  schoolName: z.string().optional(),
  classGrade: z.coerce.number().int().min(1).max(8).optional(),
  section: z.string().optional(),
});
