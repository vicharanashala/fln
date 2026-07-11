import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';

/**
 * Validate `req.body` against a Zod schema, replacing it with the parsed value.
 * Throws ZodError (handled centrally) on failure.
 */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body) as ZodInfer<T>;
    next();
  };
}
