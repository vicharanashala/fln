import { z } from 'zod';

/** Accept either { answers: {...} } or a flat { "Q1": "A", ... } map. */
export const evaluateSchema = z
  .object({ answers: z.record(z.string(), z.string()) })
  .or(z.record(z.string(), z.string()).transform((answers) => ({ answers })));
