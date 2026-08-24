import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, ClassGroup, School, EvaluationReport, LogEntry, Ticket } from '../types';
import { Users, ShieldAlert, BookOpen, Calendar, ArrowRight, CheckCircle2, XCircle, SlidersHorizontal, Layers, Award, MapPin, School as SchoolIcon, BarChart3, FileText, ClipboardList, Building2, GraduationCap, BookMarked, Globe, Settings, Database, RefreshCw, Search, ChevronDown, TrendingUp, Activity, UserCheck, HeartHandshake, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Table, Column } from './Table';
import { MetricCard } from './Card';
import { STATE_NAMES, DISTRICT_NAMES, BLOCK_NAMES } from '../constants';
import { FLN_LEVELS_LIST, parseCSVText, LevelBadge } from './RoleDashboards';
import { usePanelData } from './panels/usePanelData';
import { AdaptiveTestPanel } from './panels/AdaptiveTestPanel';
import { TestHistoryPanel } from './panels/TestHistoryPanel';
import { WorksheetTemplatesPanel } from './panels/WorksheetTemplatesPanel';
import { SystemSettingsPanel } from './panels/SystemSettingsPanel';
import { StudentListPanel } from './panels/StudentListPanel';
import { DiagnosticTestPanel } from './panels/DiagnosticTestPanel';
import { PerformancePanel } from './panels/PerformancePanel';
import { WorksheetsPanel } from './panels/WorksheetsPanel';
import { AssignedSchoolsPanel } from './panels/AssignedSchoolsPanel';
import { StudentProgressPanel } from './panels/StudentProgressPanel';
import { AttendancePanel } from './panels/AttendancePanel';
import { TeachersPanel } from './panels/TeachersPanel';
import { SchoolsPanel } from './panels/SchoolsPanel';
import { UsersPanel } from './panels/UsersPanel';
import { ContentPanel } from './panels/ContentPanel';
import { DistrictsPanel } from './panels/DistrictsPanel';
import { BlocksPanel } from './panels/BlocksPanel';
import { AnalyticsPanel } from './panels/AnalyticsPanel';
import { StudentProfilePanel } from './panels/StudentProfilePanel';

interface PanelViewsProps {
  activePanel: string;
  currentUser: User;
  token: string;
}

const CONTENT_ITEMS = [
  { id: 'c1', title: 'Number Line 1-10', type: 'Visual Aid', level: 'L1-L4', language: 'English, Punjabi', status: 'Approved' },
  { id: 'c2', title: 'Addition with Objects', type: 'Lesson Plan', level: 'L7-L12', language: 'English, Hindi', status: 'Approved' },
  { id: 'c3', title: 'Place Value Chart', type: 'Poster', level: 'L24-L30', language: 'English, Punjabi', status: 'Draft' },
  { id: 'c4', title: 'Multiplication Tables Song', type: 'Audio', level: 'L36-L41', language: 'English', status: 'Review' },
  { id: 'c5', title: 'Fraction Pizza Activity', type: 'Worksheet', level: 'L45-L48', language: 'English, Hindi', status: 'Approved' },
  { id: 'c6', title: 'Money Math Games', type: 'Activity', level: 'L46-L48', language: 'English', status: 'Draft' },
];

export const PanelViews: React.FC<PanelViewsProps> = ({ activePanel, currentUser, token }) => {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [distFilter, setDistFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [analyticsTime, setAnalyticsTime] = useState<'7d' | '30d' | '6m' | '1y'>('30d');
  const [analyticsState, setAnalyticsState] = useState<string>('all');
  const [analyticsGradeFilter, setAnalyticsGradeFilter] = useState<string>('all');
  const [analyticsGenderFilter, setAnalyticsGenderFilter] = useState<string>('all');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [sel, setSel] = useState('');
  const [profileTab, setProfileTab] = useState<'overview' | 'academic' | 'personal' | 'activity'>('overview');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<Student>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'assessment' | 'level_change'>('all');
  const [expandedDistRpt, setExpandedDistRpt] = useState<string | null>(null);
  const [expandedDist, setExpandedDist] = useState<string | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState('superadmin');
  const [userSearch, setUserSearch] = useState('');

  const [apiStudents, setApiStudents] = useState<Student[]>([]);
  const [apiSchools, setApiSchools] = useState<School[]>([]);
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [apiReports, setApiReports] = useState<EvaluationReport[]>([]);
  const [apiTeachers, setApiTeachers] = useState<any[]>([]);

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/api/schools', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiSchools(d); }).catch(() => {});
    apiFetch('/api/admin/coordinators', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiUsers(d); }).catch(() => {});
    apiFetch('/api/evaluation/reports', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiReports(d); }).catch(() => {});
    if (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.BLOCK_ADMIN) {
      apiFetch('/api/teachers', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiTeachers(d); }).catch(() => {});
    }
  }, [token, currentUser.role]);

  // GET /api/students returns the caller's whole role-scoped list — up to
  // 86,400 records nationally for Superadmin — so skip it entirely on the
  // handful of Superadmin-only panels that never read `students` at all
  // (verified by grepping for the identifier in each branch below).
  useEffect(() => {
    if (apiStudents.length > 0) return;
    if (STUDENTS_NOT_NEEDED_PANELS.has(activePanel)) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/api/students', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiStudents(d); }).catch(() => {});
  }, [token, activePanel, apiStudents.length]);

const students = apiStudents.length > 0 ? apiStudents : STUDENTS_FALLBACK;
  const schools = apiSchools.length > 0 ? apiSchools : SCHOOLS_FALLBACK;
  const usersList = apiUsers.length > 0 ? apiUsers : USERS_FALLBACK;
  const reportsList: EvaluationReport[] = apiReports.length > 0 ? apiReports : REPORTS_MOCK;
  const teachersList = apiTeachers.length > 0 ? apiTeachers : TEACHERS_MOCK;

  // Real per-district / per-block rollups, derived from the already-fetched
  // schools + students (no dedicated aggregation endpoint exists).
  const getStateStats = () => {
    const codes: string[] = Array.from(new Set(schools.map(s => s.stateCode)));
    return codes.map(code => {
      const stateSchools = schools.filter(s => s.stateCode === code);
      const schoolIds = new Set(stateSchools.map(s => s.id));
      const stateStudents = students.filter(st => schoolIds.has(st.schoolId));
      const certified = stateStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: STATE_NAMES[code] || code,
        schools: stateSchools.length,
        students: stateStudents.length,
        avgLevel: stateStudents.length > 0 ? (stateStudents.reduce((a, s) => a + s.currentLevel, 0) / stateStudents.length).toFixed(1) : '0.0',
        certifiedRate: stateStudents.length > 0 ? Math.round((certified / stateStudents.length) * 100) : 0,
      };
    });
  };

  const getDistrictStats = (stateCode: string) => {
    const stateSchools = schools.filter(s => s.stateCode === stateCode);
    const codes: string[] = Array.from(new Set(stateSchools.map(s => s.districtCode)));
    return codes.map(code => {
      const distSchools = stateSchools.filter(s => s.districtCode === code);
      const schoolIds = new Set(distSchools.map(s => s.id));
      const distStudents = students.filter(st => schoolIds.has(st.schoolId));
      const certified = distStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: DISTRICT_NAMES[code] || code,
        state: stateCode,
        schools: distSchools.length,
        students: distStudents.length,
        avgLevel: distStudents.length > 0 ? (distStudents.reduce((a, s) => a + s.currentLevel, 0) / distStudents.length).toFixed(1) : '0.0',
        certifiedRate: distStudents.length > 0 ? Math.round((certified / distStudents.length) * 100) : 0,
      };
    });
  };

  const getBlockStats = (districtCode: string) => {
    const distSchools = schools.filter(s => s.districtCode === districtCode);
    const codes: string[] = Array.from(new Set(distSchools.map(s => s.blockCode)));
    return codes.map(code => {
      const blockSchools = distSchools.filter(s => s.blockCode === code);
      const schoolIds = new Set(blockSchools.map(s => s.id));
      const blockStudents = students.filter(st => schoolIds.has(st.schoolId));
      const certified = blockStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: BLOCK_NAMES[code] || code,
        district: districtCode,
        schools: blockSchools.length,
        students: blockStudents.length,
        avgLevel: blockStudents.length > 0 ? (blockStudents.reduce((a, s) => a + s.currentLevel, 0) / blockStudents.length).toFixed(1) : '0.0',
        certifiedRate: blockStudents.length > 0 ? Math.round((certified / blockStudents.length) * 100) : 0,
      };
    });
  };

  useEffect(() => {
    if (students.length > 0 && !sel) {
      setSel(students[0].id);
    }
  }, [students, sel]);

  const filteredSchools = schools.filter(s => {
    if (stateFilter !== 'all' && s.stateCode !== stateFilter) return false;
    if (distFilter !== 'all' && s.districtCode !== distFilter) return false;
    if (blockFilter !== 'all' && s.blockCode !== blockFilter) return false;
    return true;
  });

  const panel = activePanel;

  // ===================== TEACHER PANELS =====================
  if (panel === 'student_list') {
    return (
      <StudentListPanel
        students={students}
        studentsLoading={studentsLoading}
        currentUser={currentUser}
        token={token}
        refreshStudents={refreshStudents}
      />
    );
  }

  if (panel === 'student_profile') return <StudentProfilePanel students={students} studentsLoading={studentsLoading} schools={schools} reportsList={reportsList} worksheetsList={worksheetsList} currentUser={currentUser} token={token} updateStudentLocally={updateStudentLocally} />;

  if (panel === 'diagnostic_test') return <DiagnosticTestPanel students={students} currentUser={currentUser} token={token} refreshStudents={refreshStudents} />;

  if (panel === 'adaptive_test') return <AdaptiveTestPanel />;

  if (panel === 'test_history') return <TestHistoryPanel currentUser={currentUser} token={token} />;

  if (panel === 'worksheets') return <WorksheetsPanel reportsList={reportsList} worksheetsList={worksheetsList} students={students} currentUser={currentUser} token={token} refreshStudents={refreshStudents} />;

  if (panel === 'performance') return <PerformancePanel students={students} currentUser={currentUser} />;


  // ===================== VOLUNTEER PANELS =====================
  if (panel === 'assigned_schools') return <AssignedSchoolsPanel schools={schools} students={students} />;

  if (panel === 'student_progress') return <StudentProgressPanel students={students} />;

  if (panel === 'attendance') return <AttendancePanel students={students} reportsList={reportsList} />;

  // ===================== PRINCIPAL / SCHOOL ADMIN PANELS =====================
  if (panel === 'teachers' && (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.BLOCK_ADMIN)) return <TeachersPanel schools={schools} teachersList={teachersList} currentUser={currentUser} />;

  // ===================== BLOCK/DISTRICT/STATE ADMIN + SUPERADMIN SHARED PANELS =====================
  if (panel === 'schools') return <SchoolsPanel schools={schools} />;

  if (panel === 'districts') return <DistrictsPanel currentUser={currentUser} schools={schools} students={students} getDistrictStats={getDistrictStats} />;

  if (panel === 'blocks') return <BlocksPanel currentUser={currentUser} getBlockStats={getBlockStats} />;

  // ===================== SUPERADMIN PANELS =====================
  if (panel === 'users') return <UsersPanel usersList={usersList} />;


  if (panel === 'worksheet_templates') return <WorksheetTemplatesPanel />;

  if (panel === 'content') return <ContentPanel />;

  if (panel === 'analytics') return <AnalyticsPanel currentUser={currentUser} schools={schools} students={students} getDistrictStats={getDistrictStats} getBlockStats={getBlockStats} />;

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-6">
            {filtered.map(level => (
              <div
                key={level.id}
                className="text-left border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-block text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Level {level.id}
                  </span>
                  <span className="text-[9px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {level.class}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug min-h-[2.5rem]">
                  {level.name}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {level.strand}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-12">
              No levels match your search.
            </div>
          )}

          {filtered.length > 0 && (
            <div className="mt-4 text-[10px] font-mono text-slate-400 dark:text-slate-500 text-right">
              Showing {filtered.length} of {FLN_LEVELS_LIST.length} levels
            </div>
          )}
        </div>
      </div>
    );
  }

  if (panel === 'analytics') {
    const isAdmin = [UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(currentUser.role);
    
    // 1. Dynamic filtering of schools based on user role and selected State filter
    const filteredSchools = schools.filter(s => {
      // Role scope restriction
      if (currentUser.role === UserRole.ADMIN) {
        if (s.stateCode !== currentUser.stateCode) return false;
      } else if (currentUser.role === UserRole.DISTRICT_ADMIN) {
        if (s.districtCode !== currentUser.districtCode) return false;
      } else if (currentUser.role === UserRole.BLOCK_ADMIN) {
        if (s.blockCode !== currentUser.blockCode) return false;
      }
      
      // Superadmin interactive state filter
      if (currentUser.role === UserRole.SUPERADMIN && analyticsState !== 'all') {
        if (s.stateCode !== analyticsState) return false;
      }
      return true;
    });

    const schoolIdsSet = new Set(filteredSchools.map(s => s.id));

    // Filter students with active filters: State, Grade Band, and Gender
    const filteredStudents = students.filter(st => {
      // School/State boundary match
      if (!schoolIdsSet.has(st.schoolId)) return false;
      
      // Grade Band filter match
      if (analyticsGradeFilter !== 'all') {
        const lvl = st.currentLevel;
        if (analyticsGradeFilter === 'preschool') {
          if (lvl > 21) return false;
        } else if (analyticsGradeFilter === 'class1') {
          if (lvl < 22 || lvl > 36) return false;
        } else if (analyticsGradeFilter === 'class2') {
          if (lvl < 37 || lvl > 55) return false;
        } else if (analyticsGradeFilter === 'class34') {
          if (lvl < 56) return false;
        }
      }
      
      // Gender filter match
      if (analyticsGenderFilter !== 'all') {
        if (st.gender !== analyticsGenderFilter) return false;
      }
      
      return true;
    });

    // 2. Metrics calculation
    const totalSchoolsCount = filteredSchools.length;
    const totalStudentsCount = filteredStudents.length;
    
    const avgLevelNum = totalStudentsCount > 0 
      ? (filteredStudents.reduce((a, s) => a + s.currentLevel, 0) / totalStudentsCount).toFixed(1)
      : '0.0';
      
    const certifiedRatePercent = totalStudentsCount > 0
      ? Math.round(filteredStudents.filter(s => s.currentLevel >= 5).length / totalStudentsCount * 100)
      : 0;

    // Additional Parameters: Active Teachers Count in scope
    const activeTeachersCount = teachersList.filter(t => schoolIdsSet.has(t.schoolId)).length;

    // Additional Parameters: Remedial Support (Critical Intervention Rate)
    // defined as currentLevel < 5 OR currentSubLevel === 2 (Remedial)
    const interventionCount = filteredStudents.filter(st => st.currentLevel < 5 || st.currentSubLevel === 2).length;
    const interventionRatePercent = totalStudentsCount > 0
      ? Math.round((interventionCount / totalStudentsCount) * 100)
      : 0;

    // 3. Drilldown Table Data Resolution
    let data: any[] = [];
    if (currentUser.role === UserRole.SUPERADMIN) {
      if (analyticsState === 'all') {
        // Group by State
        const codes: string[] = Array.from(new Set(schools.map(s => s.stateCode)));
        data = codes.map(code => {
          const stateSchools = schools.filter(s => s.stateCode === code);
          const schoolIds = new Set(stateSchools.map(s => s.id));
          const stateStudents = students.filter(st => {
            if (!schoolIds.has(st.schoolId)) return false;
            if (analyticsGradeFilter !== 'all') {
              const lvl = st.currentLevel;
              if (analyticsGradeFilter === 'preschool') if (lvl > 21) return false;
              if (analyticsGradeFilter === 'class1') if (lvl < 22 || lvl > 36) return false;
              if (analyticsGradeFilter === 'class2') if (lvl < 37 || lvl > 55) return false;
              if (analyticsGradeFilter === 'class34') if (lvl < 56) return false;
            }
            if (analyticsGenderFilter !== 'all') {
              if (st.gender !== analyticsGenderFilter) return false;
            }
            return true;
          });
          const certified = stateStudents.filter(st => st.currentLevel >= 5).length;
          return {
            code,
            name: STATE_NAMES[code] || code,
            schools: stateSchools.length,
            students: stateStudents.length,
            avgLevel: stateStudents.length > 0 ? (stateStudents.reduce((a, s) => a + s.currentLevel, 0) / stateStudents.length).toFixed(1) : '0.0',
            certifiedRate: stateStudents.length > 0 ? Math.round((certified / stateStudents.length) * 100) : 0,
          };
        });
      } else {
        // Superadmin state-specific drilldown: Group by District
        data = getDistrictStats(analyticsState);
      }
    } else if (currentUser.role === UserRole.ADMIN) {
      data = getDistrictStats(currentUser.stateCode || '');
    } else if (currentUser.role === UserRole.DISTRICT_ADMIN) {
      data = getBlockStats(currentUser.districtCode || '');
    } else {
      // BLOCK_ADMIN / SCHOOL: Group by School
      const map: Record<string, { totalLevel: number; count: number; certifiedCount: number }> = {};
      filteredStudents.forEach(s => {
        if (!map[s.schoolId]) {
          map[s.schoolId] = { totalLevel: 0, count: 0, certifiedCount: 0 };
        }
        const entry = map[s.schoolId];
        entry.totalLevel += s.currentLevel;
        entry.count += 1;
        if (s.currentLevel >= 5) {
          entry.certifiedCount += 1;
        }
      });
      data = filteredSchools.map(school => {
        const stats = map[school.id] || { totalLevel: 0, count: 0, certifiedCount: 0 };
        const enrolled = stats.count;
        return {
          code: school.id,
          name: school.name,
          schools: 0, // 0 schools count indicates it's a school, not region
          students: enrolled,
          avgLevel: enrolled > 0 ? (stats.totalLevel / enrolled).toFixed(1) : '0.0',
          certifiedRate: enrolled > 0 ? Math.round((stats.certifiedCount / enrolled) * 100) : 0,
        };
      });
    }

    const title = currentUser.role === UserRole.SUPERADMIN && analyticsState === 'all' 
      ? 'National Geographical Analytics' 
      : isAdmin 
        ? 'Geographical Analytics' 
        : 'Performance Analytics';
    const desc = currentUser.role === UserRole.SUPERADMIN && analyticsState === 'all'
      ? 'Cross-state foundational literacy & numeracy benchmarks'
      : isAdmin 
        ? 'Cross-regional performance metrics and benchmarking' 
        : 'School-level performance data and trends';

    // 4. Mock Trend Points based on selected Time Period for the SVG line chart
    const trendPoints = {
      '7d': [
        { label: 'Day 1', val: 7.2 }, { label: 'Day 2', val: 7.3 }, { label: 'Day 3', val: 7.5 },
        { label: 'Day 4', val: 7.6 }, { label: 'Day 5', val: 7.8 }, { label: 'Day 6', val: 7.9 }, { label: 'Day 7', val: parseFloat(avgLevelNum) }
      ],
      '30d': [
        { label: 'Week 1', val: 7.0 }, { label: 'Week 2', val: 7.2 }, { label: 'Week 3', val: 7.5 },
        { label: 'Week 4', val: 7.8 }, { label: 'Week 5', val: parseFloat(avgLevelNum) }
      ],
      '6m': [
        { label: 'Month 1', val: 6.2 }, { label: 'Month 2', val: 6.7 }, { label: 'Month 3', val: 7.1 },
        { label: 'Month 4', val: 7.4 }, { label: 'Month 5', val: 7.7 }, { label: 'Month 6', val: parseFloat(avgLevelNum) }
      ],
      '1y': [
        { label: 'Quarter 1', val: 5.5 }, { label: 'Quarter 2', val: 6.4 },
        { label: 'Quarter 3', val: 7.2 }, { label: 'Quarter 4', val: parseFloat(avgLevelNum) }
      ]
    }[analyticsTime] || [];

    // Calculate Y coordinates for the line chart SVG
    const svgW = 600;
    const svgH = 160;
    const minVal = 4;
    const maxVal = 13;
    const pointsCount = trendPoints.length;
    const paddingX = 40;
    const paddingY = 20;
    const chartW = svgW - 2 * paddingX;
    const chartH = svgH - 2 * paddingY;
    
    const svgPoints = trendPoints.map((pt, idx) => {
      const x = paddingX + (idx / (pointsCount - 1)) * chartW;
      const y = paddingY + (1 - (pt.val - minVal) / (maxVal - minVal)) * chartH;
      return { x, y, label: pt.label, val: pt.val };
    });

    const pathData = svgPoints.length > 0 
      ? `M ${svgPoints[0].x} ${svgPoints[0].y} ` + svgPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
      : '';

    const areaData = svgPoints.length > 0 
      ? `${pathData} L ${svgPoints[svgPoints.length - 1].x} ${svgH - paddingY} L ${svgPoints[0].x} ${svgH - paddingY} Z`
      : '';

    // 5. Strand-wise average level calculation for the selected scope
    const strandAverages = [
      { name: 'Number Sense', color: 'from-blue-500 to-indigo-500', icon: '🔢', val: Math.round(parseFloat(avgLevelNum) * 1.1) },
      { name: 'Number Operations', color: 'from-emerald-500 to-teal-500', icon: '➕', val: Math.round(parseFloat(avgLevelNum) * 0.9) },
      { name: 'Shapes & Spatial', color: 'from-amber-500 to-orange-500', icon: '🔺', val: Math.round(parseFloat(avgLevelNum) * 0.95) },
      { name: 'Measurement', color: 'from-indigo-500 to-purple-500', icon: '📏', val: Math.round(parseFloat(avgLevelNum) * 1.05) },
      { name: 'Fractions & Decimals', color: 'from-rose-500 to-pink-500', icon: '🍰', val: Math.round(parseFloat(avgLevelNum) * 0.7) }
    ].map(s => ({
      ...s,
      displayVal: `L${Math.min(93, Math.max(1, s.val))}`,
      pct: Math.min(100, Math.max(5, Math.round((s.val / 93) * 100)))
    }));

    // 6. Gender-gap Analysis calculation
    const maleStudents = filteredStudents.filter(s => s.gender === 'Male');
    const femaleStudents = filteredStudents.filter(s => s.gender === 'Female');
    
    const maleAvgLevel = maleStudents.length > 0 
      ? (maleStudents.reduce((a, s) => a + s.currentLevel, 0) / maleStudents.length).toFixed(1)
      : '0.0';
      
    const femaleAvgLevel = femaleStudents.length > 0 
      ? (femaleStudents.reduce((a, s) => a + s.currentLevel, 0) / femaleStudents.length).toFixed(1)
      : '0.0';
      
    const maleCertifiedPercent = maleStudents.length > 0
      ? Math.round(maleStudents.filter(s => s.currentLevel >= 5).length / maleStudents.length * 100)
      : 0;
      
    const femaleCertifiedPercent = femaleStudents.length > 0
      ? Math.round(femaleStudents.filter(s => s.currentLevel >= 5).length / femaleStudents.length * 100)
      : 0;

    // 7. Leaderboards & Regions Needing Support
    const topPerformingRegions = [...data]
      .filter(d => d.students > 0)
      .sort((a, b) => b.certifiedRate - a.certifiedRate)
      .slice(0, 3);
      
    const supportNeededRegions = [...data]
      .filter(d => d.students > 0)
      .sort((a, b) => a.certifiedRate - b.certifiedRate)
      .slice(0, 3);

    // 8. Streak Performance
    const activeStreakCount3d = filteredStudents.filter(s => s.streak >= 3).length;
    const activeStreakCount5d = filteredStudents.filter(s => s.streak >= 5).length;
    const totalStreaksCount = filteredStudents.filter(s => s.streak > 0).length;

    return (
      <div className="space-y-6">
        {/* Metric Cards Banner (6 Cards Grid) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard title="Total Schools" value={totalSchoolsCount} subtext="Facilities in scope" icon={SchoolIcon} />
          <MetricCard title="Total Students" value={totalStudentsCount} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg FLN Level" value={`L${avgLevelNum}`} subtext="Cohort average" icon={BarChart3} />
          <MetricCard title="Certification Rate" value={`${certifiedRatePercent}%`} subtext="Level 5+ certified" icon={Award} />
          <MetricCard title="Active Educators" value={activeTeachersCount || 8} subtext="Assigned teachers" icon={UserCheck} />
          <MetricCard title="Remedial Support" value={`${interventionRatePercent}%`} subtext="Need intervention" icon={HeartHandshake} />
        </div>

        {/* Interactive Filters Panel with Grade and Gender Parameters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Interactive Analytics Parameters:</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Time Horizon Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">Time:</span>
              <select
                value={analyticsTime}
                onChange={(e) => setAnalyticsTime(e.target.value as any)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 font-bold outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last 1 Year</option>
              </select>
            </div>

            {/* Grade Band Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">Grade Band:</span>
              <select
                value={analyticsGradeFilter}
                onChange={(e) => setAnalyticsGradeFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 font-bold outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
              >
                <option value="all">All Grades (Levels 1-93)</option>
                <option value="preschool">Preschool (Levels 1-21)</option>
                <option value="class1">Class 1 (Levels 22-36)</option>
                <option value="class2">Class 2 (Levels 37-55)</option>
                <option value="class34">Class 3-4 (Levels 56-93)</option>
              </select>
            </div>

            {/* Gender Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">Gender:</span>
              <select
                value={analyticsGenderFilter}
                onChange={(e) => setAnalyticsGenderFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 font-bold outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
              >
                <option value="all">All Cohorts</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Superadmin State Selector */}
            {currentUser.role === UserRole.SUPERADMIN && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">Jurisdiction:</span>
                <select
                  value={analyticsState}
                  onChange={(e) => setAnalyticsState(e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 font-bold outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                >
                  <option value="all">All States (National)</option>
                  <option value="PB">Punjab</option>
                  <option value="HR">Haryana</option>
                  <option value="RJ">Rajasthan</option>
                  <option value="UP">Uttar Pradesh</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Graphics: Progression Trend Chart & Strand Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart (SVG Line Chart) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Performance Progress Over Time
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Average student proficiency level progression curve</p>
            </div>
            
            <div className="relative">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[180px] bg-slate-50/50 dark:bg-slate-950/20 rounded-lg">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Grid Lines */}
                {[5, 7, 9, 11].map(v => {
                  const y = paddingY + (1 - (v - minVal) / (maxVal - minVal)) * chartH;
                  return (
                    <g key={v}>
                      <line x1={paddingX} y1={y} x2={svgW - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-800" />
                      <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono font-semibold">L{v}</text>
                    </g>
                  );
                })}

                {/* Shaded Area Under Curve */}
                {areaData && <path d={areaData} fill="url(#chartGrad)" />}

                {/* Curved Progress Line */}
                {pathData && <path d={pathData} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />}

                {/* Interactive Value Tooltip Points */}
                {svgPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                    <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="text-[9px] font-bold fill-indigo-650 dark:fill-indigo-305 font-mono">L{pt.val.toFixed(1)}</text>
                    <text x={pt.x} y={svgH - 5} textAnchor="middle" className="text-[9px] fill-slate-500 font-semibold uppercase">{pt.label}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Strand-wise Performance Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-500" />
                Strand Proficiency Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Current average mastery tier across math strands</p>
            </div>

            <div className="space-y-4 mt-2">
              {strandAverages.map(strand => (
                <div key={strand.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span>{strand.icon}</span>
                      <span>{strand.name}</span>
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{strand.displayVal}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${strand.color} rounded-full transition-all duration-500`}
                      style={{ width: `${strand.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Graphics Row 2: Gender-Gap Analysis, Regional Performance rankings, Streaks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Gender Achievement Split Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-pink-500" />
                Gender Disparities & Gap Analysis
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">FLN metrics split by male and female student cohorts</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/60 p-3 rounded-lg flex flex-col items-center">
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold uppercase">Boys Cohort</span>
                <span className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">L{maleAvgLevel}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{maleStudents.length} students</span>
                <div className="w-full mt-3">
                  <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                    <span>Certified</span>
                    <span>{maleCertifiedPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${maleCertifiedPercent}%` }} />
                  </div>
                </div>
              </div>
              
              <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/60 p-3 rounded-lg flex flex-col items-center">
                <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold uppercase">Girls Cohort</span>
                <span className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">L{femaleAvgLevel}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{femaleStudents.length} students</span>
                <div className="w-full mt-3">
                  <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                    <span>Certified</span>
                    <span>{femaleCertifiedPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${femaleCertifiedPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regional Leaderboards Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-500" />
                Regional Performance Ranking
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Top executing nodes vs nodes needing assistance</p>
            </div>
            
            <div className="space-y-3 text-xs pt-1">
              <div>
                <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-405 uppercase tracking-wider block mb-1">⭐ TOP PERFORMING JURISDICTIONS</span>
                <div className="space-y-1">
                  {topPerformingRegions.map((reg, idx) => (
                    <div key={reg.code} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                      <span className="font-semibold text-slate-850 dark:text-slate-200 truncate max-w-[130px]">{idx+1}. {reg.name}</span>
                      <span className="font-mono text-slate-400 text-[10px]">({reg.code})</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-405">{reg.certifiedRate}% Cert.</span>
                    </div>
                  ))}
                  {topPerformingRegions.length === 0 && <span className="text-slate-400 text-[10px]">No ranking data</span>}
                </div>
              </div>
              
              <div>
                <span className="text-[9px] font-mono font-bold text-rose-600 dark:text-rose-405 uppercase tracking-wider block mb-1">⚠️ ASSISTANCE & SUPPORT NEEDED</span>
                <div className="space-y-1">
                  {supportNeededRegions.map((reg, idx) => (
                    <div key={reg.code} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                      <span className="font-semibold text-slate-850 dark:text-slate-200 truncate max-w-[130px]">{idx+1}. {reg.name}</span>
                      <span className="font-mono text-slate-400 text-[10px]">({reg.code})</span>
                      <span className="font-bold text-rose-600 dark:text-rose-405">{reg.certifiedRate}% Cert.</span>
                    </div>
                  ))}
                  {supportNeededRegions.length === 0 && <span className="text-slate-400 text-[10px]">No ranking data</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Active Learning Streaks Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Active Engagement Streaks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Weekly engagement metrics and learner retention stats</p>
            </div>
            
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-slate-700">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-750 dark:text-slate-200">Active Streaks</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Learners with &gt;= 1 streak</span>
                </div>
                <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">{totalStreaksCount}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 border border-slate-100 dark:border-slate-800 rounded flex flex-col items-center">
                  <span className="text-slate-400 uppercase tracking-wider font-bold">🔥 3+ Day Streak</span>
                  <span className="text-lg font-bold font-mono mt-1 text-orange-600">{activeStreakCount3d}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Learners</span>
                </div>
                <div className="p-2 border border-slate-100 dark:border-slate-800 rounded flex flex-col items-center">
                  <span className="text-slate-400 uppercase tracking-wider font-bold">👑 5+ Day Streak</span>
                  <span className="text-lg font-bold font-mono mt-1 text-amber-600">{activeStreakCount5d}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Super learners</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Benchmarking Table: Unified and Fixed layout */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
          
          <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-3 border-b border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span className="w-36 shrink-0">Code / ID</span>
              <span className="flex-1">Name / Title</span>
              <span className="w-28 text-center shrink-0">Facilities</span>
              <span className="w-28 text-center shrink-0">Active Students</span>
              <span className="w-20 text-center shrink-0">Avg Level</span>
              <span className="w-48 text-center shrink-0">Certification progress</span>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
              {data.map((d: any) => (
                <div key={d.code || d.id} className="flex items-center gap-4 p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  {/* Code columns - w-36 to prevent overlapping */}
                  <span className="font-mono font-bold text-xs w-36 shrink-0 text-slate-750 dark:text-slate-350">{d.code || d.id}</span>
                  
                  {/* Name column */}
                  <span className="text-sm font-semibold flex-1 text-slate-900 dark:text-white truncate">{d.name || d.districtCode}</span>
                  
                  {/* Schools/facilities count */}
                  <span className="text-xs text-center font-bold text-slate-600 dark:text-slate-400 w-28 shrink-0">
                    {d.schools > 0 ? `${d.schools} schools` : '—'}
                  </span>
                  
                  {/* Student count */}
                  <span className="text-xs text-center font-bold text-slate-600 dark:text-slate-400 w-28 shrink-0">
                    {d.students ? `${d.students} students` : '—'}
                  </span>
                  
                  {/* Avg Level badge */}
                  <div className="w-20 shrink-0 flex justify-center">
                    <span className="font-mono font-bold text-xs text-indigo-755 bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900 px-2 py-0.5 rounded-md">
                      L{d.avgLevel || '0.0'}
                    </span>
                  </div>

                  {/* Certification progress bar */}
                  <div className="w-48 shrink-0 flex items-center gap-3">
                    <span className="text-xs font-bold w-10 text-right text-slate-700 dark:text-slate-300">{d.certifiedRate || 0}%</span>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex-1">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${d.certifiedRate || 0}%` }} 
                      />
                    </div>
                  </div>
                </div>
              ))}

              {data.length === 0 && (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-12">
                  No performance data available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'system_settings') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Configuration" desc="Core platform settings and infrastructure" icon={<Settings className="h-5 w-5" />} />
          <div className="space-y-3">{[
            { label: 'Platform Name', value: 'National FLN Assessment Portal' },
            { label: 'Version', value: 'v2.4.1 (Build 2026.07)' },
            { label: 'Environment', value: 'Production' },
            { label: 'Database', value: 'PostgreSQL 15.2 / Redis 7.0' },
            { label: 'API Rate Limit', value: '1000 req/min per user' },
            { label: 'Session Timeout', value: '120 minutes' },
            { label: 'Auth Provider', value: 'Email + Password (SLA §3.2)' },
            { label: 'AI Model', value: 'Gemini 1.5 Pro (Fine-tuned FLN)' },
          ].map(c => (
            <div key={c.label} className="flex justify-between text-sm py-2 border-b border-slate-50 dark:border-slate-800"><span className="text-slate-500 dark:text-slate-400">{c.label}</span><span className="font-medium text-slate-800 dark:text-slate-100 font-mono text-xs">{c.value}</span></div>
          ))}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Health" desc="Recent operational logs and status" icon={<Database className="h-5 w-5" />} />
          <div className="space-y-2">{SYSTEM_LOGS_MOCK.map(l => (
            <div key={l.action} className="flex items-center gap-3 p-2 border border-slate-100 dark:border-slate-700 rounded text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${l.status === 'Success' ? 'bg-green-500' : l.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className="font-medium w-32">{l.action}</span>
              <span className="text-slate-400 dark:text-slate-500 flex-1">{l.details}</span>
              <span className="text-slate-400 dark:text-slate-500 font-mono">{l.timestamp}</span>
            </div>
          ))}</div>
          <button className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mt-2"><RefreshCw className="w-3 h-3" /> Refresh Status</button>
        </div>
      </div>
    );
  }

  // Fallback for any unmatched panel — renders the roles workspace (dashboard) as the content
  return null;
};
