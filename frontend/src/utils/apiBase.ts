export const API_BASE = ((): string => {
  // In development, the backend runs on :3000 while Vite serves the frontend on :5173.
  // Use the backend host when in dev to bypass the in-browser mock interceptor.
  // Vite exposes import.meta.env.DEV at build time; fallback to empty string for prod.
  try {
    // @ts-ignore - Vite env typing
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      return 'http://localhost:3000';
    }
  } catch (e) {
    // ignore
  }
  return '';
})();

export function buildUrl(path: string) {
  if (!path) return API_BASE + path;
  // Ensure single slash
  if (API_BASE.endsWith('/') && path.startsWith('/')) return API_BASE + path.slice(1);
  if (!API_BASE && path.startsWith('/')) return path;
  return API_BASE + path;
}
