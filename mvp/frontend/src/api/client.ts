import type { BaselineStatusSummary, EvaluationReport, Student, User } from '../types';

const TOKEN_KEY = 'fln_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Thin fetch wrapper: injects auth header + parses JSON / errors uniformly. */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),

  // superadmin
  listTeachers: () => request<User[]>('/auth/teachers'),
  createTeacher: (payload: Record<string, unknown>) =>
    request<User>('/auth/teachers', { method: 'POST', body: JSON.stringify(payload) }),

  // students
  listStudents: () => request<Student[]>('/students'),
  createStudent: (payload: Record<string, unknown>) =>
    request<Student>('/students', { method: 'POST', body: JSON.stringify(payload) }),
  updateStudent: (id: string, payload: Record<string, unknown>) =>
    request<Student>(`/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteStudent: (id: string) => request<void>(`/students/${id}`, { method: 'DELETE' }),

  // baseline
  baselineStatus: () => request<BaselineStatusSummary>('/baseline/status'),
  generateBaseline: () => request<{ generated: number }>('/baseline/generate', { method: 'POST' }),
  evaluate: (studentId: string, answers: Record<string, string>) =>
    request<EvaluationReport>(`/baseline/evaluate/${studentId}`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  /** Download the ZIP of baseline PDFs (auth header → fetch + blob). */
  async downloadBaselineZip(): Promise<void> {
    const token = tokenStore.get();
    const res = await fetch('/api/baseline/download', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(JSON.parse(text || '{}')?.error ?? 'Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseline-tests-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
