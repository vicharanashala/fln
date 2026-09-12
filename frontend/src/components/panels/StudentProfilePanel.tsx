// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 8).
// The final panel in the split — 539 lines, the largest in the codebase.
// Owns saveProfile(), the only call site of usePanelData's
// updateStudentLocally mutator (built in PR 1 for exactly this purpose).
import { apiFetch } from '../../services/apiClient';
import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, School, EvaluationReport, Worksheet } from '../../types';
import { handleDownloadPDF } from './pdfReportGenerator';
import { Users, BookOpen, Calendar, Award, BarChart3, FileText, Search, ChevronDown, GitCompareArrows } from 'lucide-react';

// Issue #200: canonical cycle order for the comparison view — matches
// db.ts's CYCLE_NAMES (Worksheet.cycle already uses these exact strings
// since #179/#191's standardization).
const CYCLE_ORDER = ['Baseline', 'Mid-year', 'End-of-year'] as const;

export const StudentProfilePanel: React.FC<{
  students: Student[];
  studentsLoading?: boolean;
  schools: School[];
  reportsList: EvaluationReport[];
  worksheetsList: Worksheet[];
  currentUser: User;
  token: string;
  updateStudentLocally: (studentId: string, patch: Partial<Student>) => void;
}> = ({ students, studentsLoading, schools, reportsList, worksheetsList, currentUser, token, updateStudentLocally }) => {
  const [sel, setSel] = useState('');
  const [profileTab, setProfileTab] = useState<'overview' | 'academic' | 'personal' | 'activity'>('overview');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<Student>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'assessment' | 'level_change'>('all');
  // Issue #174: expand one report at a time to show its full per-question
  // exam-history breakdown (question, given answer, correct answer, verdict).
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useEffect(() => {
    if (students.length > 0 && !sel) {
      setSel(students[0].id);
    }
  }, [students, sel]);

  // Issue #292: `students[0]` used to always exist because a hardcoded
  // demo-student fallback guaranteed a non-empty list. With that fallback
  // removed, a teacher who genuinely has zero students yet — a brand-new
  // account, the exact case this bug was found on — would otherwise hit
  // `s.schoolId`, `s.levelHistory[0]`, etc. on `undefined` below and crash.
  if (studentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono">Loading student records...</p>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400 dark:text-slate-500">
        <Users className="h-8 w-8 mb-3" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No students registered yet.</p>
        <p className="text-xs mt-1">Register a student from the Students section to see their profile here.</p>
      </div>
    );
  }

    const s = students.find(x => x.id === sel) || students[0];

    const filteredStudents = students.filter(x =>
      x.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      x.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const reports = reportsList.filter(r => r.studentId === s.id);

    // Issue #200: Baseline / Mid-year / End-of-year side by side, so a
    // teacher can see this student's trajectory across the 3-cycle model
    // in one place instead of scrolling through the activity log. A
    // report doesn't carry its own cycle — it's looked up via its
    // worksheetId (Worksheet.cycle, standardized by #179/#191). If a
    // cycle has more than one report, the most recent one represents it.
    const worksheetCycleById = new Map(worksheetsList.map(w => [w.id, w.cycle]));
    const cycleComparison = CYCLE_ORDER.map(cycle => {
      const cycleReports = reports
        .filter(r => worksheetCycleById.get(r.worksheetId) === cycle)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const report = cycleReports[0] ?? null;
      return {
        cycle,
        report,
        scorePercent: report ? Math.round((report.score / report.totalQuestions) * 100) : null,
      };
    });
    const hasCycleData = cycleComparison.some(c => c.report !== null);

    const studentSchool = schools.find(sch => sch.id === s.schoolId);
    // No attendance data model exists on the backend yet (no dedicated
    // collection or endpoint) - showing `null` here surfaces the existing
    // 'N/A'/'-' fallbacks honestly instead of matching real students against
    // a fabricated 7-name list.
    const att: { percentage: number; present: number; total: number } | null = null;
    const enrollmentDate = s.levelHistory[0]?.date;
    const daysSinceEnroll = enrollmentDate ? Math.floor((Date.now() - new Date(enrollmentDate).getTime()) / 86400000) : null;
    const canEditProfile = (() => {
      switch (currentUser.role) {
        case UserRole.SUPERADMIN:
        case UserRole.ADMIN:
        case UserRole.DISTRICT_ADMIN:
        case UserRole.BLOCK_ADMIN:
          return true;
        case UserRole.SCHOOL:
        case UserRole.TEACHER:
          return s.schoolId === currentUser.schoolId;
        case UserRole.VOLUNTEER:
          return currentUser.assignedSchools?.includes(s.schoolId) ?? false;
        default:
          return false;
      }
    })();
    // Mirrors the backend's redaction in GET /api/students — admins/volunteers
    // never receive guardianContact/address at all, so those fields are
    // indistinguishable from "not set" unless we check role here too.
    const canSeeGuardianPII = currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.TEACHER;
    const startEditingProfile = () => {
      setProfileDraft({
        gender: s.gender, dob: s.dob, guardianName: s.guardianName, guardianRelation: s.guardianRelation,
        guardianContact: s.guardianContact, address: s.address, bloodGroup: s.bloodGroup,
        disabilityStatus: s.disabilityStatus, midDayMealBeneficiary: s.midDayMealBeneficiary,
        busRoute: s.busRoute, siblingsInSchool: s.siblingsInSchool, teacherNotes: s.teacherNotes,
      });
      setEditingProfile(true);
    };
    const saveProfile = async () => {
      setSavingProfile(true);
      try {
        const res = await apiFetch(`/api/students/${s.id}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(profileDraft),
        });
        if (res.ok) {
          updateStudentLocally(s.id, profileDraft);
          setEditingProfile(false);
        }
      } finally {
        setSavingProfile(false);
      }
    };
    const classStudents = students.filter(st => st.classGroup === s.classGroup);
    const classAvg = Math.round(classStudents.reduce((a, st) => a + st.currentLevel, 0) / Math.max(1, classStudents.length));
    const avgScore = reports.length > 0 ? Math.round(reports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / reports.length) : 0;
    const allSkills = new Map<string, { mastery: string; date: string }[]>();
    reports.forEach(r => Object.entries(r.conceptMastery).forEach(([topic, mastery]: [string, string]) => {
      if (!allSkills.has(topic)) allSkills.set(topic, []);
      allSkills.get(topic)!.push({ mastery, date: r.timestamp });
    }));
    const latestSkills = reports.length > 0 ? Object.entries(reports[0].conceptMastery) : [];
    const weakAreas = latestSkills.filter(([_, m]) => m !== 'Strong').map(([t]) => t);
    const recentActivity = [
      ...reports.map(r => ({ type: 'assessment' as const, label: `${r.score}/${r.totalQuestions} on ${r.worksheetId}`, date: r.timestamp, detail: `Score ${Math.round(r.score / r.totalQuestions * 100)}%` })),
      ...s.levelHistory.map(lh => ({ type: 'level_change' as const, label: `Level changed to L${lh.level}`, date: lh.date, detail: lh.reason })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filteredActivity = activityFilter === 'all' ? recentActivity : recentActivity.filter(a => a.type === activityFilter);

    const tabs = [
      { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
      { key: 'academic' as const, label: 'Academic Record', icon: BookOpen },
      { key: 'personal' as const, label: 'Personal Details', icon: Users },
      { key: 'activity' as const, label: 'Activity Log', icon: Calendar },
    ];

    return (
      <div className="space-y-6">
        {/* Student selector header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">{s.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{s.name}</h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">ID: {s.displayId || s.id}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.levelHistory.length > 0 ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{s.levelHistory.length > 0 ? 'Active' : 'Pending Diagnostic'}</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate"><strong>{studentSchool?.name || 'N/A'}</strong> · {s.classGroup} - {s.section}{daysSinceEnroll !== null && ` · Enrolled ${daysSinceEnroll} days ago`}</p>
            </div>
            {/* Searchable student selector */}
            <div className="relative shrink-0">
              <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 min-w-[180px] text-left">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="flex-1 truncate">{s.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..." className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No students found</p>
                      ) : filteredStudents.map(x => {
                        const isSelected = x.id === sel;
                        return (
                          <button key={x.id} onClick={() => { setSel(x.id); setProfileTab('overview'); setShowDropdown(false); setSearchQuery(''); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{x.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{x.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                                <span>{x.classGroup}-{x.section}</span>
                                <span className="font-mono font-bold">L{x.currentLevel}</span>
                              </div>
                            </div>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-center"><div className="text-lg font-bold text-slate-900 dark:text-white">{reports.length}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Assessments</div></div>
            <div className="text-center"><div className={`text-lg font-bold ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{avgScore > 0 ? `${avgScore}%` : '—'}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Avg Score</div></div>
            <div className="text-center"><div className="text-lg font-bold text-amber-600">L{s.currentLevel}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Current Level</div></div>
            <div className="text-center"><div className={`text-lg font-bold ${att ? (att.percentage >= 85 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}`}>{att ? `${att.percentage}%` : '—'}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Attendance</div></div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setProfileTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${profileTab === t.key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {profileTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              {/* Status Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 shadow-lg text-white space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">{s.name.charAt(0)}</div>
                  <div><div className="font-bold text-lg">{s.name}</div><div className="text-xs text-slate-400">{s.classGroup} - {s.section}</div></div>
                </div>
                <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/10">
                  <div className="text-center"><div className="text-2xl font-bold text-emerald-400">L{s.currentLevel}</div><div className="text-[9px] text-slate-400 uppercase font-mono">Current Level</div></div>
                </div>
                <div className="pt-1"><div className="flex justify-between text-xs text-slate-400 mb-1"><span>Progress to L{s.targetLevel}</span><span>{Math.round((s.currentLevel / s.targetLevel) * 100)}%</span></div><div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (s.currentLevel / s.targetLevel) * 100)}%` }} /></div></div>
              </div>

              {/* Class Comparison */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Class Comparison</h3>
                <div className="space-y-3">
                  <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-500 dark:text-slate-400">This Student</span><span className="font-bold text-indigo-600">L{s.currentLevel}</span></div><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(s.currentLevel / 93) * 100}%` }} /></div></div>
                  <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-500 dark:text-slate-400">Class Average ({classStudents.length} students)</span><span className="font-bold text-slate-700 dark:text-slate-200">L{classAvg}</span></div><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-slate-500 rounded-full transition-all" style={{ width: `${(classAvg / 93) * 100}%` }} /></div></div>
                  <div className={`p-2 rounded-lg text-xs font-medium text-center ${s.currentLevel > classAvg ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : s.currentLevel === classAvg ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}`}>
                    {s.currentLevel > classAvg ? `↑ ${s.currentLevel - classAvg} levels above class average` : s.currentLevel === classAvg ? 'At class average' : `↓ ${classAvg - s.currentLevel} levels below class average`}
                  </div>
                </div>
                {/* Class rank */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Class Rank</span><span className="font-bold font-mono text-slate-800 dark:text-slate-100">#{classStudents.sort((a, b) => b.currentLevel - a.currentLevel).findIndex(x => x.id === s.id) + 1} / {classStudents.length}</span></div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Quick Info</h3>
                {[['Age', `${s.age} yrs`], ['Class & Section', `${s.classGroup} - ${s.section}`], ['Current Level', `L${s.currentLevel}`], ['Attendance', att ? `${att.present}/${att.total} (${att.percentage}%)` : 'N/A']].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100">{v || 'N/A'}</span></div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {/* Score Trend Chart */}
              {reports.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Score Trend</h3>
                  <div className="relative">
                    <div className="flex items-end gap-3 h-40 border-b border-l border-slate-200 dark:border-slate-700 ml-8 pb-2 pl-2">
                      {reports.map((r, i) => {
                        const pct = Math.round((r.score / r.totalQuestions) * 100);
                        const barH = Math.max(pct * 0.8, 10);
                        const isUp = i === 0 || pct >= Math.round((reports[i - 1].score / reports[i - 1].totalQuestions) * 100);
                        return (
                          <div key={r.id} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                            <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8">
                              <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded whitespace-nowrap">{pct}%</span>
                              <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">{pct}%</span>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative overflow-hidden flex-1 self-stretch" style={{ height: `${barH}px` }}>
                              <div className={`absolute bottom-0 inset-x-0 rounded-t-lg transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                              <span className={`text-[8px] ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>{isUp ? '↑' : '↓'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {reports.length >= 2 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Trend: <strong className={avgScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{avgScore}% avg</strong></span>
                        <span>Best: <strong className="text-emerald-600">{Math.max(...reports.map(r => Math.round((r.score / r.totalQuestions) * 100)))}%</strong></span>
                        <span>Last: <strong>{Math.round((reports[reports.length - 1].score / reports[reports.length - 1].totalQuestions) * 100)}%</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Issue #200: Baseline / Mid-year / End-of-year side by side —
                  distinct from Score Trend above, which is every report in
                  chronological order regardless of cycle. This is
                  specifically the 3-cycle model the assessment design is
                  built around. */}
              {hasCycleData && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <GitCompareArrows className="h-3.5 w-3.5" /> Cycle Comparison
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {cycleComparison.map(({ cycle, report, scorePercent }) => (
                      <div key={cycle} className="text-center space-y-2">
                        <div className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">{cycle}</div>
                        {report ? (
                          <>
                            <div className="h-24 flex items-end justify-center">
                              <div
                                className={`w-10 rounded-t-lg ${scorePercent! >= 80 ? 'bg-emerald-500' : scorePercent! >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ height: `${Math.max(scorePercent! * 0.9, 8)}px` }}
                              />
                            </div>
                            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">{scorePercent}%</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">L{report.recommendedLevel}.{report.recommendedSubLevel ?? 0}</div>
                            <div className="text-[9px] text-slate-400 dark:text-slate-500">{new Date(report.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          </>
                        ) : (
                          <div className="h-24 flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600 font-mono">Not yet taken</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Level Journey */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Level Journey</h3>
                {s.levelHistory.length > 0 ? (
                  <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                    {[...s.levelHistory].reverse().map((lh, i) => (
                      <div key={i} className="flex gap-4 pb-4 relative pl-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow mt-1 shrink-0 z-10" />
                        <div className="flex-1"><div className="flex justify-between"><div><span className="font-bold text-sm text-slate-900 dark:text-white">Level {lh.level}{lh.subLevel !== undefined ? `.${lh.subLevel}` : ''}</span><p className="text-xs text-slate-500 dark:text-slate-400">{lh.reason}</p></div><span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">{lh.date}</span></div></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-6"><p className="text-xs text-slate-400 dark:text-slate-500">No level history yet.</p></div>}
                {s.levelHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Next Targets</h4>
                    <div className="flex items-center gap-1 text-[10px] font-mono flex-wrap">
                      {Array.from({ length: Math.min(5, s.targetLevel - s.currentLevel + 1) }, (_, i) => s.currentLevel + i).map((lvl, i) => (
                        <React.Fragment key={lvl}>{i > 0 && <span className="text-slate-300 dark:text-slate-600">→</span>}<span className={`px-2 py-0.5 rounded border ${lvl <= s.currentLevel ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'}`}>L{lvl}</span></React.Fragment>
                      ))}
                      {s.targetLevel > s.currentLevel + 5 && <span className="text-slate-300 dark:text-slate-600">… → L{s.targetLevel}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Skills Grid */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Skill Proficiency</h3>
                {latestSkills.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {latestSkills.map(([topic, mastery]) => {
                      const pct = mastery === 'Strong' ? 90 : mastery === 'Satisfactory' ? 60 : 30;
                      const history = allSkills.get(topic) || [];
                      const improving = history.length >= 2 && history[0].mastery !== history[history.length - 1].mastery;
                      return (
                        <div key={topic} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{topic}</span>
                            <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${mastery === 'Strong' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : mastery === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                              {mastery}
                              {improving && <span className="text-emerald-500">↑</span>}
                            </span>
                          </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${mastery === 'Strong' ? 'bg-emerald-500' : mastery === 'Satisfactory' ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          {history.length >= 2 && (
                            <div className="flex gap-1 mt-1.5">
                              {history.map((h, hi) => (
                                <span key={hi} className={`text-[7px] font-mono px-1 py-0.5 rounded ${h.mastery === 'Strong' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : h.mastery === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'}`}>
                                  {h.mastery === 'Strong' ? 'S' : h.mastery === 'Satisfactory' ? 'Sat' : 'NP'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="text-center py-6"><p className="text-xs text-slate-400 dark:text-slate-500">No skill data yet.</p></div>}
              </div>

              {/* Recommended Focus */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-2"><Award className="w-3.5 h-3.5" /> Recommended Focus Areas</h3>
                <div className="space-y-2">
                  {weakAreas.length > 0 ? weakAreas.map(topic => (
                    <div key={topic} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />Additional practice recommended for <strong>{topic}</strong></div>
                  )) : reports.length > 0 ? <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />All skills at expected level — no focus areas needed</div> : <div className="text-sm text-slate-500 dark:text-slate-400">Complete a diagnostic assessment to generate recommendations.</div>}
                  {s.currentLevel < 93 && <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-800"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />Next milestone: <strong>Level {Math.min(93, s.currentLevel + 1)}</strong></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ACADEMIC TAB ===== */}
        {profileTab === 'academic' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Academic Summary</h3>
                <div className="space-y-2.5 text-sm">
                  {[['Total Assessments', String(reports.length)], ['Avg Score', reports.length > 0 ? `${avgScore}%` : 'N/A'], ['Current Level', `L${s.currentLevel}.${s.currentSubLevel ?? 0}`], ['Target Level', `L${s.targetLevel}`], ['Sub-Level Status', s.currentSubLevel === 0 ? 'Mastery' : s.currentSubLevel === 1 ? 'Easier' : 'Remedial'], ['Attendance', att ? `${att.percentage}% (${att.present}/${att.total} days)` : 'N/A']].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100">{v}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Curriculum Coverage</h3>
                <div className="space-y-2">
                  {['Number Sense', 'Number Operations', 'Shapes & Geometry', 'Measurement', 'Patterns & Algebra', 'Data Handling'].map(strand => {
                    const lvlForStrand = ['Number Sense', 'Number Operations'].includes(strand) ? s.currentLevel : Math.max(0, s.currentLevel - 5);
                    const covered = lvlForStrand > 15;
                    const partial = lvlForStrand > 8;
                    return <div key={strand} className="flex items-center justify-between gap-2 text-sm py-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`${covered ? 'text-emerald-600' : partial ? 'text-amber-500' : 'text-slate-300'}`}>{covered ? '✓' : partial ? '◐' : '○'}</span>
                        <span className={covered ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-500'}>{strand}</span>
                      </div>
                      <span className={`text-[9px] font-mono ${covered ? 'text-emerald-600' : partial ? 'text-amber-500' : 'text-slate-300'}`}>{covered ? 'Covered' : partial ? 'Partial' : 'Not Started'}</span>
                    </div>;
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Award className="w-3.5 h-3.5" /> Progress Highlights</h3>
                <div className="space-y-2 text-sm">
                  {reports.length > 0 && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Best Score</span><span className="font-bold text-emerald-600">{Math.max(...reports.map(r => Math.round((r.score / r.totalQuestions) * 100)))}%</span></div>}
                  {reports.length > 0 && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Recent Score</span><span className="font-bold text-slate-800 dark:text-slate-100">{Math.round((reports[reports.length - 1].score / reports[reports.length - 1].totalQuestions) * 100)}%</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Levels Gained</span><span className="font-bold text-slate-800 dark:text-slate-100">{s.levelHistory.length > 0 ? s.currentLevel - s.levelHistory[0].level : 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Strong Skills</span><span className="font-bold text-slate-800 dark:text-slate-100">{latestSkills.filter(([_, m]) => m === 'Strong').length}/{latestSkills.length}</span></div>
                  {s.levelHistory.length > 0 && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Since</span><span className="font-mono text-xs text-slate-600 dark:text-slate-300">{s.levelHistory[0].date}</span></div>}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">All Assessment Reports</h3>
                {reports.length > 0 ? <div className="space-y-4">{reports.map(r => {
                  const scorePct = Math.round((r.score / r.totalQuestions) * 100);
                  return (
                    <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${scorePct >= 80 ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : scorePct >= 60 ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>{scorePct}%</div>
                          <div><span className="text-sm font-semibold text-slate-900 dark:text-white">{r.worksheetId}</span><div className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${scorePct >= 80 ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : scorePct >= 60 ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>{r.score}/{r.totalQuestions}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{r.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">{Object.entries(r.conceptMastery).map(([t, m]) => (
                        <span key={t} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${m === 'Strong' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : m === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>{t}: {m}</span>
                      ))}</div>
                      
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        {r.questionResults && r.questionResults.length > 0 ? (
                          <button
                            onClick={() => setExpandedReportId(expandedReportId === r.id ? null : r.id)}
                            className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {expandedReportId === r.id ? '▲ Hide' : '▼ Show'} per-question detail ({r.questionResults.length} questions)
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Per-question answer detail not available for this report</span>
                        )}
                        <button onClick={() => handleDownloadPDF(s, r)} className="text-xs font-semibold text-emerald-650 hover:text-emerald-800 flex items-center gap-1">
                          📥 Download PDF Report
                        </button>
                      </div>

                      {expandedReportId === r.id && r.questionResults && (
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono uppercase">
                                <th className="p-2"># Question</th>
                                <th className="p-2 text-center">Correct Answer</th>
                                <th className="p-2">Given Answer</th>
                                <th className="p-2 text-center">Result</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {r.questionResults.map((q, idx) => (
                                <tr key={q.questionId}>
                                  <td className="p-2 font-medium text-slate-900 dark:text-white">
                                    <span className="font-mono text-[10px] font-bold text-slate-400 mr-1.5">Q{idx + 1}.</span>
                                    {q.question || q.questionId}
                                  </td>
                                  <td className="p-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{q.correctAnswer ?? '—'}</td>
                                  <td className="p-2 font-mono">{q.submittedAnswer || '—'}</td>
                                  <td className="p-2 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      q.isCorrect
                                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                    }`}>
                                      {q.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}</div> : <div className="text-center py-8"><p className="text-xs text-slate-400 dark:text-slate-500">No assessment reports yet.</p></div>}
              </div>
            </div>
          </div>
        )}

        {/* ===== PERSONAL TAB ===== */}
        {profileTab === 'personal' && (
          <div className="space-y-6">
            {canEditProfile && (
              <div className="flex justify-end">
                {editingProfile ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingProfile(false)} disabled={savingProfile} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                    <button onClick={saveProfile} disabled={savingProfile} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{savingProfile ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                ) : (
                  <button onClick={startEditingProfile} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Edit Profile</button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Personal Information</h3>
                <div className="space-y-2.5 text-sm">{[
                  ['Full Name', s.name], ['Age', `${s.age} years`], ['Aadhar Number', s.aadharMasked], ['Class & Section', `${s.classGroup} - ${s.section}`], ['School', studentSchool?.name || 'N/A'], ['School ID', s.schoolId], ['Current Level', `L${s.currentLevel}`],
                ].map(([l, v]) => (<div key={l as string} className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100 text-right max-w-[55%]">{v}</span></div>))}</div>
                {editingProfile ? (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-xs text-slate-500 dark:text-slate-400">Gender
                      <select value={profileDraft.gender || ''} onChange={e => setProfileDraft(d => ({ ...d, gender: e.target.value as Student['gender'] }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950">
                        <option value="">Not set</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                      </select>
                    </label>
                    <label className="block text-xs text-slate-500 dark:text-slate-400">Date of Birth
                      <input type="date" value={profileDraft.dob || ''} onChange={e => setProfileDraft(d => ({ ...d, dob: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                    </label>
                    <label className="block text-xs text-slate-500 dark:text-slate-400">Blood Group
                      <input type="text" placeholder="e.g. B+" value={profileDraft.bloodGroup || ''} onChange={e => setProfileDraft(d => ({ ...d, bloodGroup: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                    </label>
                    <label className="block text-xs text-slate-500 dark:text-slate-400">Disability Status
                      <input type="text" placeholder="e.g. None" value={profileDraft.disabilityStatus || ''} onChange={e => setProfileDraft(d => ({ ...d, disabilityStatus: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-sm pt-2 border-t border-slate-100 dark:border-slate-800">{[
                    ['Gender', s.gender || 'N/A'], ['Date of Birth', s.dob || 'N/A'], ['Blood Group', s.bloodGroup || 'N/A'], ['Disability Status', s.disabilityStatus || 'None recorded'],
                  ].map(([l, v]) => (<div key={l as string} className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100 text-right max-w-[55%]">{v}</span></div>))}</div>
                )}
              </div>
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Guardian & Contact</h3>
                  {editingProfile ? (
                    <div className="space-y-2.5">
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Guardian Name
                        <input type="text" value={profileDraft.guardianName || ''} onChange={e => setProfileDraft(d => ({ ...d, guardianName: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                      </label>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Relation
                        <input type="text" placeholder="e.g. Father, Mother" value={profileDraft.guardianRelation || ''} onChange={e => setProfileDraft(d => ({ ...d, guardianRelation: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                      </label>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Contact Number
                        <input type="tel" value={profileDraft.guardianContact || ''} onChange={e => setProfileDraft(d => ({ ...d, guardianContact: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                      </label>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Residential Address
                        <textarea value={profileDraft.address || ''} onChange={e => setProfileDraft(d => ({ ...d, address: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" rows={2} />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-sm">{[
                      ['Guardian Name', s.guardianName || 'N/A'], ['Relation', s.guardianRelation || 'N/A'],
                      ['Contact Number', s.guardianContact || (canSeeGuardianPII ? 'N/A' : 'Not visible to your role')],
                      ['Residential Address', s.address || (canSeeGuardianPII ? 'N/A' : 'Not visible to your role')],
                    ].map(([l, v]) => (<div key={l as string} className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100 text-right max-w-[55%]">{v}</span></div>))}</div>
                  )}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Logistics & Notes</h3>
                  {editingProfile ? (
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <input type="checkbox" checked={!!profileDraft.midDayMealBeneficiary} onChange={e => setProfileDraft(d => ({ ...d, midDayMealBeneficiary: e.target.checked }))} /> Mid-Day Meal Beneficiary
                      </label>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Bus Route
                        <input type="text" value={profileDraft.busRoute || ''} onChange={e => setProfileDraft(d => ({ ...d, busRoute: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                      </label>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Siblings in School
                        <input type="text" value={profileDraft.siblingsInSchool || ''} onChange={e => setProfileDraft(d => ({ ...d, siblingsInSchool: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" />
                      </label>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">Teacher Notes
                        <textarea value={profileDraft.teacherNotes || ''} onChange={e => setProfileDraft(d => ({ ...d, teacherNotes: e.target.value }))} className="mt-1 w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950" rows={3} />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-sm">
                      {[['Mid-Day Meal', s.midDayMealBeneficiary === undefined ? 'N/A' : s.midDayMealBeneficiary ? 'Yes' : 'No'], ['Bus Route', s.busRoute || 'N/A'], ['Siblings in School', s.siblingsInSchool || 'N/A']]
                        .map(([l, v]) => (<div key={l as string} className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100">{v}</span></div>))}
                      <div className="pt-1"><span className="text-slate-500 dark:text-slate-400 block mb-1">Teacher Notes</span><p className="text-slate-800 dark:text-slate-100 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 leading-relaxed">{s.teacherNotes || 'No notes recorded.'}</p></div>
                    </div>
                  )}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Attendance Record</h3>
                  {att ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Overall Attendance</span>
                        <span className={`text-lg font-bold ${att.percentage >= 85 ? 'text-emerald-600' : att.percentage >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{att.percentage}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${att.percentage >= 85 ? 'bg-emerald-500' : att.percentage >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${att.percentage}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Present: {att.present} days</span>
                        <span>Total: {att.total} days</span>
                        <span>Absent: {att.total - att.present} days</span>
                      </div>
                    </div>
                  ) : <p className="text-xs text-slate-400 dark:text-slate-500">No attendance data available.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {profileTab === 'activity' && (
          <div className="max-w-2xl">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recent Activity</h3>
                <div className="flex gap-1">
                  {(['all', 'assessment', 'level_change'] as const).map(f => (
                    <button key={f} onClick={() => setActivityFilter(f)} className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${activityFilter === f ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                      {f === 'all' ? 'All' : f === 'assessment' ? 'Assessments' : 'Level Changes'}
                    </button>
                  ))}
                </div>
              </div>
              {filteredActivity.length > 0 ? (
                <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {filteredActivity.map((act, i) => (
                    <div key={i} className="flex gap-4 pb-5 relative pl-2">
                      <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow mt-1 shrink-0 z-10 ${act.type === 'assessment' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <div className="flex-1"><div className="flex justify-between"><div><span className="font-semibold text-sm text-slate-900 dark:text-white">{act.label}</span><p className="text-xs text-slate-500 dark:text-slate-400">{act.detail}</p></div><span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">{new Date(act.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8"><p className="text-xs text-slate-400 dark:text-slate-500">{activityFilter === 'all' ? 'No activity recorded yet.' : `No ${activityFilter === 'assessment' ? 'assessment' : 'level change'} activity found.`}</p></div>}
            </div>
          </div>
        )}
      </div>
    );
};
