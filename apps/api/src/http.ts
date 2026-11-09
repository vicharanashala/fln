import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** An error the client should see, with the status to send. Anything else becomes a plain 500. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Express 4 never catches a rejected promise from an async handler, so a thrown error
 * leaves the request open forever (the bug found in the old scan route). Wrap every
 * async handler so errors always reach the error middleware.
 */
export function handler(fn: (req: Request, res: Response) => Promise<void> | void): RequestHandler {
  return (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) { next(err); return; }
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  // The body parser refuses an over-size body with a 413; say so instead of calling it our fault.
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') { res.status(413).json({ error: 'That request is too large. If it is a photo, please try a smaller one.' }); return; }
  if (err instanceof SyntaxError && 'body' in err) { res.status(400).json({ error: 'The request body is not valid JSON.' }); return; }
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
}

export function requireString(value: unknown, field: string, max = 100): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new HttpError(400, `${field} is required.`);
  if (value.trim().length > max) throw new HttpError(400, `${field} must be at most ${max} characters.`);
  return value.trim();
}
