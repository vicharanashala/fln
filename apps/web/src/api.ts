import type { Attempt, ClassGroup, Student, Topic, User, Worksheet } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

function readToken(): string | null { try { return localStorage.getItem('fln-token'); } catch { return null; } }
export function saveToken(token: string | null): void {
  try { if (token) localStorage.setItem('fln-token', token); else localStorage.removeItem('fln-token'); } catch { /* storage blocked: stay logged in for this tab only */ }
}
export const hasToken = (): boolean => readToken() !== null;

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch { throw new ApiError(0, 'Could not reach the server. Check your internet and try again.'); }
  const text = await res.text();
  let json: { error?: string } | null = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON: use the generic message below */ }
  if (!res.ok) {
    if (res.status === 401 && token) saveToken(null);
    throw new ApiError(res.status, json?.error ?? 'Something went wrong. Please try again.');
  }
  return json as T;
}

export interface ResultEntry { studentId: string; marks?: boolean[]; answers?: (string | null)[]; source?: 'scan' }

export const api = {
  login: (email: string, password: string) => call<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => call<{ user: User }>('/auth/me'),
  classes: () => call<{ classes: ClassGroup[] }>('/classes'),
  createClass: (className: string, section: string) => call<{ class: ClassGroup }>('/classes', { method: 'POST', body: { className, section } }),
  students: (id: string) => call<{ class: ClassGroup; students: Student[] }>(`/classes/${id}/students`),
  addStudents: (id: string, names: string[]) => call<{ students: Student[] }>(`/classes/${id}/students/bulk`, { method: 'POST', body: { names } }),
  topics: (id: string) => call<{ topics: Topic[] }>(`/classes/${id}/topics`),
  worksheet: (id: string, bankLevel: number, set: number) => call<Worksheet>(`/classes/${id}/worksheet?bankLevel=${bankLevel}&set=${set}`),
  results: (id: string) => call<{ attempts: Attempt[] }>(`/classes/${id}/results`),
  saveResults: (id: string, bankLevel: number, set: number, entries: ResultEntry[]) => call<{ attempts: Attempt[] }>(`/classes/${id}/results`, { method: 'POST', body: { bankLevel, set, entries } }),
  scan: (id: string, bankLevel: number, set: number, imageBase64: string, mimeType: string) =>
    call<{ answers: (string | null)[]; suggestedMarks: boolean[] }>(`/classes/${id}/scan`, { method: 'POST', body: { bankLevel, set, imageBase64, mimeType } }),
};
