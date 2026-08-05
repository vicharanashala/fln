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
// Auto-attaches the `Authorization: Bearer <token>` header from localStorage so
// authenticated endpoints don't need to remember to add it.
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('fln_token');
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) || {}),
  };
  if (token && !headers['Authorization'] && !path.includes('/api/auth/login')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(withBase(path), { ...init, headers });
  if (res.status === 401 && !path.includes('/api/auth/login')) {
    localStorage.removeItem('fln_token');
    window.dispatchEvent(new Event('fln_unauthorized'));
  }
  return res;
}
