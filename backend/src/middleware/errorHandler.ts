// ---------------------------------------------------------------------------
// Standardized Error Handler Middleware
// ---------------------------------------------------------------------------
// Centralizes error responses so that:
//
//   1. Clients always receive a predictable JSON shape:
//        { error: 'error_code', message: 'human readable', details?: any }
//   2. Stack traces and internal details are NEVER leaked to clients.
//   3. HTTP status codes are mapped sensibly from known error types.
//
// Mount LAST (after all routes) as Express's error-handling middleware
// (4-arg signature). Routes can throw `ApiError` instances to signal a
// specific status code and error code:
//   throw new ApiError(403, 'forbidden', 'You cannot do that');
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details?: unknown;

  constructor(statusCode: number, errorCode: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

function isJsonSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    'status' in (err as any) &&
    (err as any).status === 400 &&
    'body' in (err as any)
  );
}

/**
 * Express error-handling middleware (4-arg signature). Must be registered
 * after all routes. Converts thrown errors into standardized JSON responses
 * without leaking stack traces, file paths, or internal state to clients.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let statusCode = 500;
  let errorCode = 'internal_server_error';
  let message = 'An unexpected error occurred.';
  let details: unknown = undefined;

  // Known structured error.
  if (isApiError(err)) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  }
  // Malformed JSON body (Express 4.x json() parser throws SyntaxError w/ status 400).
  else if (isJsonSyntaxError(err)) {
    statusCode = 400;
    errorCode = 'invalid_json';
    message = 'Request body is not valid JSON.';
  }
  // MongoDB driver / unexpected errors: generic 500, no leak.
  else {
    // In development, log the full error server-side only.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[errorHandler] Unexpected error:', err);
    }
    message = 'An unexpected error occurred.';
  }

  const body: ErrorResponse = { error: errorCode, message };
  if (details !== undefined) body.details = details;

  res.status(statusCode).json(body);
}

/**
 * Convenience helper for route handlers to throw typed errors.
 */
export function throwApiError(
  statusCode: number,
  errorCode: string,
  message: string,
  details?: unknown,
): never {
  throw new ApiError(statusCode, errorCode, message, details);
}
