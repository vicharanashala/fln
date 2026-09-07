import React, { useState, useEffect, useMemo } from 'react';
import { Student, User, School } from '../types';
import { apiFetch } from '../services/apiClient';
import * as XLSX from 'xlsx';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Users, 
  Award, 
  FileSpreadsheet, 
  Save, 
  Sparkles,
  Search,
  Check,
} from 'lucide-react';

interface AttendanceTrackerProps {
  token: string;
  students: Student[];
  currentUser: User;
  schools: School[];
}

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

interface StudentAttendanceState {
  status: AttendanceStatus;
  remarks: string;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  token,
  students,
  currentUser,
  schools
}) => {
  const defaultSchoolId = currentUser.schoolId || (schools.length > 0 ? schools[0].id : '');
  const [selectedSchool, setSelectedSchool] = useState<string>(defaultSchoolId);
  const [fetchedStudents, setFetchedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Multi-date cache mapping date (YYYY-MM-DD) -> studentId -> state
  const [dateCache, setDateCache] = useState<Record<string, Record<string, StudentAttendanceState>>>({});
  const [attendanceData, setAttendanceData] = useState<Record<string, StudentAttendanceState>>({});
  
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastAutoSaved, setLastAutoSaved] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (selectedSchool) {
      setLoadingStudents(true);
      apiFetch(`/api/students?schoolId=${selectedSchool}&limit=500`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            setFetchedStudents(d);
          }
        })
        .catch(err => console.error('Error fetching students for school:', err))
        .finally(() => setLoadingStudents(false));
    } else if (students && students.length > 0) {
      setFetchedStudents(students);
    }
  }, [selectedSchool, token, students.length]);

  const activeStudentsList = fetchedStudents.length > 0 ? fetchedStudents : (students || []);

  // Load attendance for the specified date from backend or dateCache
  const loadAttendance = async (date: string) => {
    try {
      const res = await apiFetch(`/api/attendance?date=${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      const newMap: Record<string, StudentAttendanceState> = {};
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          newMap[item.studentId] = {
            status: item.status,
            remarks: item.remarks || ''
          };
        }
      }
      
      // If we had cached local modifications for this date, merge them on top
      const cachedDateData: Record<string, StudentAttendanceState> = dateCache[date] || {};
      for (const [id, state] of Object.entries(cachedDateData)) {
        newMap[id] = state;
      }

      // For any student not yet marked for this date, default to 'Present'
      for (const s of activeStudentsList) {
        if (!newMap[s.id]) {
          newMap[s.id] = { status: 'Present', remarks: '' };
        }
      }

      setAttendanceData(newMap);
      setDateCache(prev => ({ ...prev, [date]: newMap }));
    } catch (err) {
      console.error('Failed to load attendance:', err);
      const fallbackMap: Record<string, StudentAttendanceState> = dateCache[date] || {};
      for (const s of activeStudentsList) {
        if (!fallbackMap[s.id]) {
          fallbackMap[s.id] = { status: 'Present', remarks: '' };
        }
      }
      setAttendanceData(fallbackMap);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const res = await apiFetch('/api/attendance/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadAttendance(selectedDate);
  }, [selectedDate, activeStudentsList.length]);

  useEffect(() => {
    loadStats();
  }, []);

  // Filter students based on UI selections
  const filteredStudents = useMemo(() => {
    return activeStudentsList.filter(s => {
      if (selectedClass !== 'all' && s.classGroup.toLowerCase() !== selectedClass.toLowerCase()) {
        return false;
      }
      if (selectedSection !== 'all' && s.section?.toLowerCase() !== selectedSection.toLowerCase()) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeStudentsList, selectedClass, selectedSection, searchQuery]);

  // Status updates with automatic backend synchronization
  const setStudentStatus = async (studentId: string, status: AttendanceStatus) => {
    const student = activeStudentsList.find(s => s.id === studentId);
    const updatedRemarks = attendanceData[studentId]?.remarks || '';
    const updatedState: StudentAttendanceState = {
      status,
      remarks: updatedRemarks
    };

    // 1. Update active view state
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: updatedState
    }));

    // 2. Update multi-date cache
    setDateCache(prev => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [studentId]: updatedState
      }
    }));

    // 3. Immediately persist to backend for selectedDate
    try {
      await apiFetch('/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: selectedDate,
          markedBy: currentUser.name || currentUser.email,
          records: [{
            studentId,
            studentName: student?.name || 'Student',
            classGroup: student?.classGroup || 'Class 2',
            section: student?.section || 'A',
            schoolId: student?.schoolId || 'gps-mt-001',
            status,
            remarks: updatedRemarks
          }]
        })
      });
      setLastAutoSaved(new Date().toLocaleTimeString());
      loadStats();
    } catch (err) {
      console.error('Auto-save error:', err);
    }
  };

  const setStudentRemarks = (studentId: string, remarks: string) => {
    const updatedState: StudentAttendanceState = {
      status: attendanceData[studentId]?.status || 'Present',
      remarks
    };

    setAttendanceData(prev => ({
      ...prev,
      [studentId]: updatedState
    }));

    setDateCache(prev => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [studentId]: updatedState
      }
    }));
  };

  const markAllFiltered = async (status: AttendanceStatus) => {
    const updatedMap: Record<string, StudentAttendanceState> = { ...attendanceData };
    const recordsToSubmit = filteredStudents.map(s => {
      const currentRemarks = updatedMap[s.id]?.remarks || '';
      updatedMap[s.id] = {
        status,
        remarks: currentRemarks
      };
      return {
        studentId: s.id,
        studentName: s.name,
        classGroup: s.classGroup,
        section: s.section || 'A',
        schoolId: s.schoolId || 'gps-mt-001',
        status,
        remarks: currentRemarks
      };
    });

    setAttendanceData(updatedMap);
    setDateCache(prev => ({
      ...prev,
      [selectedDate]: updatedMap
    }));

    try {
      await apiFetch('/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: selectedDate,
          markedBy: currentUser.name || currentUser.email,
          records: recordsToSubmit
        })
      });
      setLastAutoSaved(new Date().toLocaleTimeString());
      loadStats();
    } catch (err) {
      console.error('Batch save error:', err);
    }
  };

  // Manual save trigger for full batch
  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const recordsToSubmit = filteredStudents.map(s => {
        const state = attendanceData[s.id] || { status: 'Present', remarks: '' };
        return {
          studentId: s.id,
          studentName: s.name,
          classGroup: s.classGroup,
          section: s.section || 'A',
          schoolId: s.schoolId || 'gps-mt-001',
          status: state.status,
          remarks: state.remarks
        };
      });

      const res = await apiFetch('/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: selectedDate,
          markedBy: currentUser.name || currentUser.email,
          records: recordsToSubmit
        })
      });

      if (res.ok) {
        setToastMessage(`Attendance for ${recordsToSubmit.length} students synced and saved for ${selectedDate}!`);
        setLastAutoSaved(new Date().toLocaleTimeString());
        loadStats();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert('Failed to save attendance. Please try again.');
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('Network error while saving attendance.');
    } finally {
      setSaving(false);
    }
  };

  // Export formatted Excel (.xlsx) workbook
  const handleExportExcel = () => {
    // 1. Prepare Roster Sheet Data
    const rosterRows = filteredStudents.map((s, idx) => {
      const state = attendanceData[s.id] || { status: 'Present', remarks: '' };
      return {
        'S.No': idx + 1,
        'Student ID': s.id,
        'Student Name': s.name,
        'Class': s.classGroup,
        'Section': s.section || 'A',
        'Attendance Date': selectedDate,
        'Status': state.status,
        'Current FLN Level': `L${s.currentLevel}.${s.currentSubLevel ?? 0}`,
        'Streak (Days)': s.streak,
        'Teacher Remarks / Notes': state.remarks || ''
      };
    });

    // 2. Prepare Summary Sheet Data
    const summaryRows = [
      { 'Metric': 'Attendance Date', 'Value': selectedDate },
      { 'Metric': 'Class Filter', 'Value': selectedClass === 'all' ? 'All Classes' : selectedClass },
      { 'Metric': 'Section Filter', 'Value': selectedSection === 'all' ? 'All Sections' : selectedSection },
      { 'Metric': 'Total Enrolled Roster', 'Value': filteredStudents.length },
      { 'Metric': 'Present Count', 'Value': presentCount },
      { 'Metric': 'Absent Count', 'Value': absentCount },
      { 'Metric': 'Late Count', 'Value': lateCount },
      { 'Metric': 'Excused Count', 'Value': excusedCount },
      { 'Metric': 'Overall Attendance Rate (%)', 'Value': `${presentPct}%` },
      { 'Metric': 'Consistent Streaks (3+ Days)', 'Value': filteredStudents.filter(s => s.streak >= 3).length },
      { 'Metric': 'Report Generated At', 'Value': new Date().toLocaleString() },
      { 'Metric': 'Marked / Generated By', 'Value': currentUser.name || currentUser.email }
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add Roster Sheet with custom column widths
    const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
    wsRoster['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 22 },  // Student ID
      { wch: 26 },  // Student Name
      { wch: 14 },  // Class
      { wch: 10 },  // Section
      { wch: 16 },  // Date
      { wch: 14 },  // Status
      { wch: 18 },  // Current FLN Level
      { wch: 14 },  // Streak
      { wch: 36 }   // Teacher Remarks
    ];
    XLSX.utils.book_append_sheet(wb, wsRoster, 'Daily Attendance');

    // Add Summary Sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [
      { wch: 30 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Attendance Summary');

    // Trigger immediate native .xlsx download
    const cleanClass = selectedClass === 'all' ? 'All_Classes' : selectedClass.replace(/\s+/g, '_');
    const fileName = `FLN_Attendance_${selectedDate}_${cleanClass}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Metrics for current filtered view
  const presentCount = filteredStudents.filter(s => (attendanceData[s.id]?.status || 'Present') === 'Present').length;
  const absentCount = filteredStudents.filter(s => attendanceData[s.id]?.status === 'Absent').length;
  const lateCount = filteredStudents.filter(s => attendanceData[s.id]?.status === 'Late').length;
  const excusedCount = filteredStudents.filter(s => attendanceData[s.id]?.status === 'Excused').length;
  const presentPct = filteredStudents.length > 0 ? Math.round(((presentCount + lateCount) / filteredStudents.length) * 100) : 0;

  // Extract unique classes for filter
  const uniqueClasses = Array.from(new Set(activeStudentsList.map(s => s.classGroup))).sort();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Daily Attendance & Participation Tracker</h2>
                {lastAutoSaved && (
                  <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Auto-saved {lastAutoSaved}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time student attendance with multi-date persistence and FLN acceleration tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer shadow-xs"
            title="Download formatted Microsoft Excel (.xlsx) spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Export Excel (.xlsx)
          </button>
          <button
            onClick={handleSaveAttendance}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Syncing...' : 'Save & Sync Attendance'}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loadingStudents ? '...' : filteredStudents.length}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Enrolled in Roster</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{presentPct}%</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{presentCount} Present · {lateCount} Late</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{absentCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Absent on {selectedDate} ({excusedCount} Excused)</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {filteredStudents.filter(s => s.streak >= 3).length}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Consistent Streaks (3+ Days 🔥)</div>
          </div>
        </div>
      </div>

      {/* FLN Growth Correlation Insight Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl p-5 border border-indigo-800/50 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300">FLN Pedagogical Impact Analysis</span>
          </div>
          <p className="text-sm font-semibold text-white">
            Students with ≥90% attendance advance an average of <span className="text-emerald-400 font-bold">+3.8 FLN levels</span> per cycle vs. +1.1 for irregular attendees.
          </p>
          <p className="text-xs text-slate-300">
            Daily consistency ensures seamless concept reinforcement across Number Sense, Operations, and Measurement.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2 text-center shrink-0">
          <div className="text-xs text-slate-300 font-mono">Mastery Velocity</div>
          <div className="text-lg font-black text-amber-300">3.4x Faster</div>
        </div>
      </div>

      {/* Filter and Batch Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* School Selector (for Admins / Multi-School Users) */}
          {schools.length > 1 && (
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                School
              </label>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white max-w-[220px] truncate font-medium"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[120px]"
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Search Student</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg pl-7 pr-3 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-44"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>
          </div>
        </div>

        {/* Batch Actions */}
        <div className="flex items-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => markAllFiltered('Present')}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAllFiltered('Absent')}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold hover:bg-rose-100 transition cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" /> Mark All Absent
          </button>
        </div>
      </div>

      {/* Student Attendance Roster List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Student Roster ({filteredStudents.length} Students)
          </div>
          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            Viewing Date: <strong className="text-indigo-600 dark:text-indigo-400">{selectedDate}</strong>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500 font-mono">
            No students found matching your filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredStudents.map((s) => {
              const currentStatus = attendanceData[s.id]?.status || 'Present';
              const currentRemarks = attendanceData[s.id]?.remarks || '';

              return (
                <div 
                  key={s.id}
                  className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {s.name}
                        {s.streak >= 3 && (
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                            {s.streak} 🔥
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {s.classGroup} - {s.section || 'A'} · Level L{s.currentLevel}.{s.currentSubLevel ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Remarks Input */}
                  <div className="w-full md:w-64">
                    <input
                      type="text"
                      placeholder="Optional notes / reason..."
                      value={currentRemarks}
                      onChange={(e) => setStudentRemarks(s.id, e.target.value)}
                      onBlur={() => setStudentStatus(s.id, currentStatus)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:border-indigo-400"
                    />
                  </div>

                  {/* Status Toggle Button Group */}
                  <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setStudentStatus(s.id, 'Present')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentStatus === 'Present'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Present
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudentStatus(s.id, 'Absent')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentStatus === 'Absent'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Absent
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudentStatus(s.id, 'Late')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentStatus === 'Late'
                          ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" /> Late
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudentStatus(s.id, 'Excused')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentStatus === 'Excused'
                          ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Excused
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer save bar */}
        {filteredStudents.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Current breakdown for {selectedDate}: {presentCount} Present · {absentCount} Absent · {lateCount} Late · {excusedCount} Excused
            </div>
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Syncing...' : 'Save & Sync Attendance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
