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

// fetch() against a base-relative app path. Drop-in replacement for fetch("/api/...").
// Attaches the stored auth token as a Bearer header unless the caller already set one.
//
// Every call has a default 15-second timeout via AbortController. This guards
// against a hung backend (e.g. Atlas SSL handshake failing) leaving the UI in
// a permanent loading state. Callers can override by passing their own signal
// or by passing `timeoutMs` (per-call) for endpoints known to be slow
// (e.g. Puppeteer-driven PDF generation on /api/diagnostic/single).
export async function apiFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    const token = localStorage.getItem('fln_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  // Default 15s timeout; per-call override via `timeoutMs`; skipped if the
  // caller already provided a signal.
  let controller: AbortController | null = null;
  if (!init.signal) {
    controller = new AbortController();
    setTimeout(() => controller!.abort(), init.timeoutMs ?? 15_000);
  }
  const signal = init.signal ?? controller?.signal;

  const res = await fetch(withBase(path), { ...init, headers, signal });
  if (
    (res.status === 401 || res.status === 403) &&
    !path.includes('/api/auth/login')
  ) {
    localStorage.removeItem('fln_token');
    window.dispatchEvent(new Event('fln_unauthorized'));
  }
  return res;
}
