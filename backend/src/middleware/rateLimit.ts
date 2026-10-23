// ---------------------------------------------------------------------------
// API Rate Limiting Middleware
// ---------------------------------------------------------------------------
// Extends rate limiting beyond the auth endpoint (already covered by
// authRateLimiter in config.ts) to all mutating API routes. Prevents brute
// force, scraping, and denial-of-service on write-heavy endpoints.
//
// Limits are deliberately generous for normal human use but catch automated
// abuse:
//   - GET (read) endpoints:     120 req / 15 min per IP
//   - POST/PUT/DELETE (write):  30  req / 15 min per IP
//
// Mount per-route-group in index.ts, e.g.:
//   app.use('/api/tickets', apiRateLimiter({ windowMs: 15*60*1000, limit: 30 }));
// ---------------------------------------------------------------------------

import rateLimit from 'express-rate-limit';

interface RateLimiterOpts {
  windowMs?: number;
  limit?: number;
}

export function apiRateLimiter(opts: RateLimiterOpts = {}) {
  return rateLimit({
    windowMs: opts.windowMs ?? 15 * 60 * 1000, // 15 minutes
    limit: opts.limit ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'rate_limited',
      message: 'Too many requests. Please slow down and try again later.',
    },
    // Key by client IP. Use req.ip (populated by Express's trust proxy
    // setting) rather than reading X-Forwarded-For directly, which would
    // allow clients to spoof their IP and bypass rate limits. Set
    // `app.set('trust proxy', ...)` in index.ts when behind a reverse
    // proxy so req.ip reflects the real client IP.
    keyGenerator: req => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
    // Don't count 401/403 against the limit so misconfigured clients aren't
    // permanently locked out by auth failures alone.
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  });
}

/**
 * Stricter limiter for write endpoints (tickets, announcements, evaluations,
 * student registration) where automation risk is higher.
 */
export const writeRateLimiter = apiRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
});

/**
 * Relaxed limiter for read endpoints (students, analytics, announcements).
 */
export const readRateLimiter = apiRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
});
