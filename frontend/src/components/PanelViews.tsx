import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, ClassGroup, School, Worksheet, LogEntry, Ticket } from '../types';
import { Users, BookOpen, Calendar, ArrowRight, SlidersHorizontal, Layers, Award, MapPin, School as SchoolIcon, BarChart3, FileText, Building2, BookMarked, Globe, Settings, Database, RefreshCw, Search, ChevronDown } from 'lucide-react';
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
import { QuestionBankPanel } from './panels/QuestionBankPanel';

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
  const {
    students, studentsLoading, schools, usersList, reportsList, worksheetsList, teachersList,
    getDistrictStats, getBlockStats, updateStudentLocally, refreshStudents,
  } = usePanelData(token, currentUser, activePanel);

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

  if (panel === 'system_settings') return <SystemSettingsPanel />;
  if (panel === 'question_bank') return <QuestionBankPanel currentUser={currentUser} token={token} />;

  // Fallback for any unmatched panel — renders the roles workspace (dashboard) as the content
  return null;
};
