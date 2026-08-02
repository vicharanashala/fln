// Base-path-aware URL helpers.
//
// `import.meta.env.BASE_URL` is Vite's configured base: the domain root in dev
// and at the root deployment, or the subpath (set via VITE_BASE_PATH) otherwise.
// Routing every API/asset URL through these helpers means the same source works
// under any deployment without hardcoding the subpath, and removes the need to
// string-rewrite built files at deploy time.

// Base with any trailing slash removed (empty string at the root deployment).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Prefix an absolute app path (/api/x, /worksheets/y.html) with the base, e.g.
// withBase('/api/stats') returns the base-relative /api/stats path.
export function withBase(path: string): string {
  return `${BASE}${path}`;
}

const DEFAULT_TIMEOUT_MS = 15000;

// Fired when a request comes back 401 (expired/invalid token), so App.tsx can
// react centrally (clear the stored token, drop back to the login view)
// instead of every caller having to notice and handle it individually.
export const UNAUTHORIZED_EVENT = 'fln:unauthorized';

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

// fetch() against a base-relative app path. Drop-in replacement for fetch("/api/...").
// Adds, centrally for every call site:
// - a default request timeout (aborts + rejects instead of hanging forever)
// - the stored auth token, if the caller didn't already set an Authorization header
// - a one-shot 'fln:unauthorized' event on a 401, so session expiry is handled once,
//   not re-implemented at every call site
// Callers may still pass their own `signal` (e.g. an AbortController tied to a
// component's unmount) — it's combined with the internal timeout, so either one
// aborts the request.
export function apiFetch(path: string, init: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, headers, ...rest } = init;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signal = timeoutController.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      timeoutController.abort();
    } else {
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has('Authorization')) {
    const token = localStorage.getItem('fln_token');
    if (token) mergedHeaders.set('Authorization', `Bearer ${token}`);
  }

  return fetch(withBase(path), { ...rest, headers: mergedHeaders, signal })
    .then(res => {
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      return res;
    })
    .catch(err => {
      if (timeoutController.signal.aborted && !callerSignal?.aborted) {
        throw new Error(`Request to ${path} timed out after ${timeoutMs}ms`);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}
