import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z.string().min(1),
  rollNo: z.string().min(1),
  age: z.coerce.number().int().min(3).max(15),
  section: z.string().optional(),
  aadhar: z.string().min(4, 'Aadhar / Birth Certificate number is required'),
});

export const updateStudentSchema = createStudentSchema.partial();
