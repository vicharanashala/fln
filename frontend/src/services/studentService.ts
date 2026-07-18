import api from './api';
import { Student } from '../types';

/**
 * Backend response shape (mirrors coordinatorService.ts pattern):
 *   { success: true, data: Student[] }   → unwrapped to Student[]
 *   Student[]                            → returned as-is
 */
function unwrap<T>(payload: any): T {
  if (payload && Array.isArray(payload.data)) return payload.data as T;
  return payload as T;
}

export interface CreateStudentPayload {
  name: string;
  age: number;
  classGroup: string;
  section: string;
  schoolId: string;
  aadharNumber?: string;
}

export async function fetchStudents(): Promise<Student[]> {
  const res = await api.get('/students');
  return unwrap<Student[]>(res.data);
}

export async function createStudent(payload: CreateStudentPayload): Promise<Student> {
  const res = await api.post('/students', payload);
  return unwrap<Student>(res.data);
}

/**
 * Editable personal-detail fields. Mirrors the service-layer whitelist on
 * the backend (services/student.service.ts → `updateStudent`).
 * Read-only fields (id, schoolId, classGroup, section, currentLevel,
 * targetLevel, streak, levelHistory, aadharMasked, teacherId) are NOT
 * included here; the backend will silently drop them from the patch even
 * if the caller puts them in the payload.
 */
export interface UpdateStudentPayload {
  name?: string;
  age?: number;
  gender?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  disabilityStatus?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  contactNumber?: string | null;
  residentialAddress?: string | null;
  midDayMeal?: boolean | null;
  busRoute?: string | null;
}

/**
 * Patch a single student's editable personal fields. The payload MUST be
 * diff-only — i.e. it should contain only the keys the user actually
 * changed, not the full student object. The backend's whitelist ensures
 * any read-only fields forwarded by mistake are silently dropped, but
 * the caller is still responsible for not sending them.
 *
 * On success returns the freshly-updated student as a plain object with
 * role-based Aadhar masking already applied (superadmin sees the raw
 * value; other roles see `XXXX-XXXX-1234`). The `useUpdateStudent`
 * hook invalidates the `['students']` query so every consumer
 * (Dashboard, Student List, Registration, Student Profile) re-renders
 * with the new values.
 *
 * Throws an `AxiosError` on non-2xx responses (4xx with a backend
 * `{ success: false, message }` envelope, 5xx for upstream failures).
 */
export async function updateStudent(
  id: string,
  payload: UpdateStudentPayload
): Promise<Student> {
  const res = await api.patch(`/students/${id}`, payload);
  return unwrap<Student>(res.data);
}
