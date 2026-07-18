import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchStudents,
  createStudent,
  updateStudent,
  CreateStudentPayload,
  UpdateStudentPayload,
} from '../services/studentService';
import { Student } from '../types';

/**
 * Single source of truth for the students collection.
 *
 * Reuses the project's existing TanStack Query architecture
 * (see hooks/useCoordinator.ts + main.tsx QueryClientProvider).
 *
 * The bearer token is injected automatically by the axios interceptor in
 * services/api.ts — no need to thread `token` through this hook.
 *
 * Both TeacherDashboard and PanelViews call this hook with the same
 * queryKey `['students']`, so React Query returns a single cached array
 * to both. `useCreateStudent` invalidates `['students']` on success, so
 * every consumer re-renders with the freshly registered student.
 */
export function useStudents() {
  return useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: fetchStudents,
    staleTime: 30 * 1000,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudentPayload) => createStudent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

/**
 * Phase 3 (Edit Personal Details): PATCH a student's editable personal
 * fields. Invalidates the `['students']` query on success so the
 * Dashboard, Student List, Registration, and Student Profile all
 * re-render with the freshly-updated values.
 *
 * Caller is responsible for sending a diff-only payload (only the keys
 * the user actually changed). The backend's whitelist silently drops
 * read-only fields if any slip through.
 *
 * The mutation returns the updated student (already Aadhar-masked by
 * the controller) so callers can do optimistic updates if desired. The
 * default `onSuccess` invalidates the cache; a 200 response means the
 * cache will refetch on the next read.
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStudentPayload }) =>
      updateStudent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

/**
 * Manual refresh of the students query cache.
 * Used by workflows (diagnostic, baseline, bulk, ICR, worksheet) that mutate
 * student state on the server side and need the roster to re-render without
 * a full reload.
 */
export function useRefreshStudents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['students'] });
}
