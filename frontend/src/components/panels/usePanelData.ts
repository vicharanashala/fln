// ==========================================
// SHARED PANEL DATA HOOK
// ==========================================
// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 1 of
// the panel-split sequence) so every per-panel file can pull the same
// fetched data + aggregation helpers without re-fetching or
// re-declaring them. See the design proposal on #144 for the full usage map
// this hook's return shape is based on.
import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/apiClient';
import { User, UserRole, Student, School, EvaluationReport, Worksheet } from '../../types';
import { DISTRICT_NAMES, BLOCK_NAMES } from '../../constants';

// Panels that render without ever reading the `students` variable — skipping
// the fetch on these avoids an up-to-86,400-record national payload on
// screens that don't display any student data.
const STUDENTS_NOT_NEEDED_PANELS = new Set([
  'aadhaar_reveal',  // Panel does its own paged + debounced-server-search fetch; the up-to-86k-row firehose is unused.
  'users',
  'worksheet_templates',
  'content',
  'system_settings',
]);

export function usePanelData(token: string, currentUser: User, activePanel: string) {
  const [apiStudents, setApiStudents] = useState<Student[]>([]);
  // Distinct from apiStudents.length === 0 — issue #292: that condition is
  // true both "fetch hasn't resolved yet" and "fetch succeeded, roster is
  // genuinely empty" (a brand-new teacher account), and code that can't
  // tell those apart was previously substituting hardcoded demo students
  // for the second case too. studentsLoading lets consumers show a real
  // empty state instead.
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [apiSchools, setApiSchools] = useState<School[]>([]);
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [apiReports, setApiReports] = useState<EvaluationReport[]>([]);
  const [apiWorksheets, setApiWorksheets] = useState<Worksheet[]>([]);
  const [apiTeachers, setApiTeachers] = useState<any[]>([]);

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/api/schools', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiSchools(d); }).catch(() => { });
    apiFetch('/api/admin/coordinators', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiUsers(d); }).catch(() => { });
    apiFetch('/api/evaluation/reports', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiReports(d); }).catch(() => { });
    apiFetch('/api/worksheets', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiWorksheets(d); }).catch(() => { });
    if (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.BLOCK_ADMIN) {
      apiFetch('/api/teachers', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiTeachers(d); }).catch(() => { });
    }
  }, [token, currentUser.role]);

  // GET /api/students returns the caller's whole role-scoped list — up to
  // 86,400 records nationally for Superadmin — so skip it entirely on the
  // handful of Superadmin-only panels that never read `students` at all
  // (verified by grepping for the identifier in each branch below).
  //
  // The backend caps the default response at 1000 rows (see
  // `DEFAULT_LIMIT` in backend/src/routes/students.ts). Any panel that
  // searches / filters the list client-side (e.g. Aadhaar Reveal) needs
  // the full set, otherwise a student outside the first 1000 is invisible
  // to in-browser search. We opt in to the full payload via `?all=1` for
  // roles whose scope can exceed 1000 — i.e. the admin tiers. Teachers,
  // school admins, and volunteers see ≤ their single school / assigned
  // schools and stay on the capped default.
  const wantsAllStudents =
    currentUser.role === UserRole.SUPERADMIN ||
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.DISTRICT_ADMIN ||
    currentUser.role === UserRole.BLOCK_ADMIN;
  const studentsUrl = wantsAllStudents ? '/api/students?all=1' : '/api/students';

  useEffect(() => {
    if (apiStudents.length > 0) return;
    if (STUDENTS_NOT_NEEDED_PANELS.has(activePanel)) { setStudentsLoading(false); return; }
    setStudentsLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch(studentsUrl, { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setApiStudents(d); })
      .catch(() => { })
      .finally(() => setStudentsLoading(false));
  }, [token, activePanel, apiStudents.length, studentsUrl]);

  const students = apiStudents;
  const schools = apiSchools;
  const usersList = apiUsers;
  const reportsList: EvaluationReport[] = apiReports;
  const worksheetsList: Worksheet[] = apiWorksheets;
  const teachersList = apiTeachers;

  // Real per-district / per-block rollups, derived from the already-fetched
  // schools + students (no dedicated aggregation endpoint exists).
  const getDistrictStats = (stateCode: string) => {
    const stateSchools = schools.filter(s => s.stateCode === stateCode);
    const codes: string[] = Array.from(new Set(stateSchools.map(s => s.districtCode)));
    return codes.map(code => {
      const distSchools = stateSchools.filter(s => s.districtCode === code);
      const distStudents = students.filter(st => distSchools.some(s => s.id === st.schoolId));
      const certified = distStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: DISTRICT_NAMES[code] || code,
        state: stateCode,
        schools: distSchools.length,
        students: distStudents.length,
        certifiedRate: distStudents.length > 0 ? Math.round((certified / distStudents.length) * 100) : 0,
      };
    });
  };

  const getBlockStats = (districtCode: string) => {
    const distSchools = schools.filter(s => s.districtCode === districtCode);
    const codes: string[] = Array.from(new Set(distSchools.map(s => s.blockCode)));
    return codes.map(code => {
      const blockSchools = distSchools.filter(s => s.blockCode === code);
      const blockStudents = students.filter(st => blockSchools.some(s => s.id === st.schoolId));
      const certified = blockStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: BLOCK_NAMES[code] || code,
        district: districtCode,
        schools: blockSchools.length,
        students: blockStudents.length,
        certifiedRate: blockStudents.length > 0 ? Math.round((certified / blockStudents.length) * 100) : 0,
      };
    });
  };

  // Named mutator instead of exposing setApiStudents directly — the only
  // shared-data mutation anywhere in PanelViews.tsx (student_profile's
  // saveProfile optimistic update after PATCH /api/students/:id/profile).
  const updateStudentLocally = (studentId: string, patch: Partial<Student>) => {
    setApiStudents(prev => prev.map(st => st.id === studentId ? { ...st, ...patch } : st));
  };

  const refreshStudents = () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch(studentsUrl, { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiStudents(d); }).catch(() => { });
  };

  return {
    students, studentsLoading, schools, usersList, reportsList, worksheetsList, teachersList,
    getDistrictStats, getBlockStats, updateStudentLocally, refreshStudents,
  };
}
