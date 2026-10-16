// ---------------------------------------------------------------------------
// Input Sanitization Middleware
// ---------------------------------------------------------------------------
// Closes the MongoDB operator injection loophole:
//
// User-supplied request bodies can contain $-prefixed keys ($where, $regex,
// $gt, etc.) that, when passed straight into dbStore queries, mutate query
// semantics. We recursively strip any object key that starts with '$' from
// user input before it reaches the route handlers / dbStore.
//
// NOTE: HTML escaping is intentionally NOT done here. HTML entities should
// be applied at output/render time (React's JSX escapes text content
// automatically), not at input storage time. Escaping on write corrupts
// legitimate content (e.g. "x > 5" becomes "x &gt; 5" in the database) and
// is the wrong layer for XSS defense.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';

// Keys that begin with '$' are MongoDB query operators. Stripping them from
// user input neutralizes operator-injection payloads such as
//   { "aadharMasked": { "$regex": ".*" } }
//   { "$where": "function() { return true }" }
const MONGO_OPERATOR_PREFIX = '$';

/**
 * Recursively walks a value and removes any object key whose first character
 * is '$' (MongoDB query operators). Arrays are walked element-wise.
 * Primitives other than strings pass through unchanged. `null`/`undefined`
 * pass through unchanged.
 */
export function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Drop MongoDB operator keys entirely.
      if (key.startsWith(MONGO_OPERATOR_PREFIX)) continue;
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  return value;
}

/**
 * Express middleware: sanitizes req.body and req.query in place so route
 * handlers and dbStore never see raw, potentially hostile input.
 *
 * Safe to mount globally before route registration. Idempotent — running it
 * twice yields the same result as once.
 */
export function sanitizeInput(_req: Request, _res: Response, next: NextFunction): void {
  if (_req.body && typeof _req.body === 'object' && !Array.isArray(_req.body)) {
    // Replace the body entirely with the sanitized version so that
    // $-prefixed MongoDB operator keys are actually removed, not just
    // shadowed by non-operator keys copied on top.
    _req.body = sanitizeValue(_req.body) as Record<string, unknown>;
  }
  if (_req.query && typeof _req.query === 'object') {
    // req.query is ParsedQs; cast through unknown to replace it safely.
    _req.query = sanitizeValue(_req.query) as any;
  }
  next();
}
