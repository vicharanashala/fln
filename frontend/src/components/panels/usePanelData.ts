// ==========================================
// SHARED PANEL DATA HOOK
// ==========================================
// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 1 of
// the panel-split sequence) so every per-panel file can pull the same
// fetched/fallback data + aggregation helpers without re-fetching or
// re-declaring them. See the design proposal on #144 for the full usage map
// this hook's return shape is based on.
import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/apiClient';
import { User, UserRole, Student, School, EvaluationReport, Worksheet } from '../../types';
import { DISTRICT_NAMES, BLOCK_NAMES } from '../../constants';

// Panels that render without ever reading the `students` variable — skipping
// the fetch on these avoids an up-to-86,400-record national payload on
// screens that don't display any student data.
const STUDENTS_NOT_NEEDED_PANELS = new Set(['users', 'worksheet_templates', 'content', 'system_settings']);

const TEACHERS_MOCK = [
  { id: 't1', name: 'Ritu Sharma', email: 'gps-mt-001.t01@fln.org', schoolId: 'gps-mt-001', classes: ['Class 2-A', 'Class 3-A'], studentsCount: 42, delayedAttempts: 0, status: 'Active' },
  { id: 't2', name: 'Amit Kumar', email: 'gps-mt-001.t02@fln.org', schoolId: 'gps-mt-001', classes: ['Class 1-A'], studentsCount: 28, delayedAttempts: 1, status: 'Active' },
  { id: 't3', name: 'Sunita Devi', email: 'gps-bth-006.t01@fln.org', schoolId: 'gps-bth-006', classes: ['Class 2-B', 'Class 4-A'], studentsCount: 35, delayedAttempts: 3, status: 'Suspended' },
  { id: 't4', name: 'Rajesh Kumar', email: 'gps-pkl-008.t01@fln.org', schoolId: 'gps-pkl-008', classes: ['Class 3-B'], studentsCount: 30, delayedAttempts: 0, status: 'Active' },
];

const SCHOOLS_FALLBACK: School[] = [
  { id: 'gps-mt-001', name: 'GPS Model Town', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'standard', teachersCount: 8, isAccessLocked: false },
  { id: 'gps-vl-002', name: 'GPS Village Lohara', stateCode: 'PB', districtCode: 'MOG', blockCode: 'MOG-01', strength: 'standard', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-amb-003', name: 'GPS Ambala Cantt', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01', strength: 'standard', teachersCount: 6, isAccessLocked: false },
  { id: 'gps-jai-004', name: 'GPS Govind Dev Ji', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-01', strength: 'standard', teachersCount: 7, isAccessLocked: true },
  { id: 'gps-lko-005', name: 'GPS Hazratganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01', strength: 'standard', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-bth-006', name: 'GPS Bathinda City', stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01', strength: 'standard', teachersCount: 4, isAccessLocked: false },
  { id: 'gps-asr-007', name: 'GPS Amritsar', stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01', strength: 'standard', teachersCount: 6, isAccessLocked: false },
  { id: 'gps-pkl-008', name: 'GPS Panchkula', stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01', strength: 'standard', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-jai2-009', name: 'GPS Jaipur Rural', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02', strength: 'standard', teachersCount: 3, isAccessLocked: false },
  { id: 'gps-uda-010', name: 'GPS Udaipur', stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01', strength: 'standard', teachersCount: 3, isAccessLocked: false },
  { id: 'gps-lko2-011', name: 'GPS Aliganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02', strength: 'standard', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-knp-012', name: 'GPS Kanpur', stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01', strength: 'standard', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-pb-ldh2-013', name: 'GPS Gill Village', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02', strength: 'standard', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-hr-amb2-014', name: 'GPS Ambala South', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02', strength: 'standard', teachersCount: 2, isAccessLocked: false },
];

const USERS_FALLBACK = [
  { name: 'Jinal Gupta', email: 'superadmin@fln.org', role: 'Super Admin', scope: 'National', status: 'Active' },
  { name: 'State Coordinator Punjab', email: 'admin.pb@fln.org', role: 'State Admin', scope: 'PB', status: 'Active' },
  { name: 'State Coordinator Haryana', email: 'admin.hr@fln.org', role: 'State Admin', scope: 'HR', status: 'Active' },
  { name: 'Ludhiana District Officer', email: 'district.ldh@fln.org', role: 'District Admin', scope: 'PB-LDH', status: 'Active' },
  { name: 'Ambala District Officer', email: 'district.amb@fln.org', role: 'District Admin', scope: 'HR-AMB', status: 'Active' },
  { name: 'Ludhiana Block Admin 1', email: 'block.ldh-01@fln.org', role: 'Block Admin', scope: 'PB-LDH-LDH-01', status: 'Active' },
  { name: 'GPS Model Town Principal', email: 'gps-mt-001@fln.org', role: 'Principal', scope: 'gps-mt-001', status: 'Active' },
  { name: 'Ritu Sharma', email: 'gps-mt-001.t01@fln.org', role: 'Teacher', scope: 'gps-mt-001', status: 'Active' },
  { name: 'Rahul Kumar', email: 'vol.rahul@fln.org', role: 'Volunteer', scope: 'Moga Villages', status: 'Active' },
];

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
  useEffect(() => {
    if (apiStudents.length > 0) return;
    if (STUDENTS_NOT_NEEDED_PANELS.has(activePanel)) { setStudentsLoading(false); return; }
    setStudentsLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/api/students', { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setApiStudents(d); })
      .catch(() => { })
      .finally(() => setStudentsLoading(false));
  }, [token, activePanel, apiStudents.length]);

  const students = apiStudents;
  const schools = apiSchools.length > 0 ? apiSchools : SCHOOLS_FALLBACK;
  const usersList = apiUsers.length > 0 ? apiUsers : USERS_FALLBACK;
  // No mock fallback here (unlike students/schools/users): a fake report's
  // studentId (e.g. 's1') will never match a real student in `students`,
  // which rendered as a literal "Unknown" name - showing an empty list on
  // fetch failure is honest, a mismatched fake report is not.
  const reportsList: EvaluationReport[] = apiReports;
  const worksheetsList: Worksheet[] = apiWorksheets;
  const teachersList = apiTeachers.length > 0 ? apiTeachers : TEACHERS_MOCK;

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
    apiFetch('/api/students', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiStudents(d); }).catch(() => { });
  };

  return {
    students, studentsLoading, schools, usersList, reportsList, worksheetsList, teachersList,
    getDistrictStats, getBlockStats, updateStudentLocally, refreshStudents,
  };
}
