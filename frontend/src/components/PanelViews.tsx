import React from 'react';
import { User, UserRole } from '../types';
import { usePanelData } from './panels/usePanelData';
import { AdaptiveTestPanel } from './panels/AdaptiveTestPanel';
import { TestHistoryPanel } from './panels/TestHistoryPanel';
import { WorksheetTemplatesPanel } from './panels/WorksheetTemplatesPanel';
import { SystemSettingsPanel } from './panels/SystemSettingsPanel';
import { StudentListPanel } from './panels/StudentListPanel';
import { AadhaarRevealPanel } from './panels/AadhaarRevealPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { DiagnosticTestPanel } from './panels/DiagnosticTestPanel';
import { PerformancePanel } from './panels/PerformancePanel';
import { WorksheetsPanel } from './panels/WorksheetsPanel';
import { AssignedSchoolsPanel } from './panels/AssignedSchoolsPanel';
import { StudentProgressPanel } from './panels/StudentProgressPanel';
import { TeachersPanel } from './panels/TeachersPanel';
import { SchoolsPanel } from './panels/SchoolsPanel';
import { UsersPanel } from './panels/UsersPanel';
import { ContentPanel } from './panels/ContentPanel';
import { DistrictsPanel } from './panels/DistrictsPanel';
import { BlocksPanel } from './panels/BlocksPanel';
import { AnalyticsPanel } from './panels/AnalyticsPanel';
import { StudentProfilePanel } from './panels/StudentProfilePanel';
import { AttendanceTracker } from './AttendanceTracker';

interface PanelViewsProps {
  activePanel: string;
  currentUser: User;
  token: string;
  /**
   * Routes the admin to a different panel (e.g. `security`) when
   * a sub-flow needs to hand off. The Aadhaar reveal dialog uses
   * this to send admins to the Security panel when they don't have
   * an enrolled authenticator yet. Optional so other entry points
   * (where the sub-flow is never reached) don't need to thread it.
   */
  onSelectView?: (view: string) => void;
}

export const PanelViews: React.FC<PanelViewsProps> = ({ activePanel, currentUser, token, onSelectView }) => {
  const {
    students, studentsLoading, schools, usersList, reportsList, worksheetsList, teachersList,
    getDistrictStats, getBlockStats, updateStudentLocally, refreshStudents,
  } = usePanelData(token, currentUser, activePanel);

  const panel = activePanel;

  // ===================== TEACHER PANELS =====================
  if (panel === 'student_list' || panel === 'students') {
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

  if (panel === 'student_profile') {
    return (
      <StudentProfilePanel
        students={students}
        studentsLoading={studentsLoading}
        schools={schools}
        reportsList={reportsList}
        worksheetsList={worksheetsList}
        currentUser={currentUser}
        token={token}
        updateStudentLocally={updateStudentLocally}
      />
    );
  }

  if (panel === 'diagnostic_test') {
    return (
      <DiagnosticTestPanel
        students={students}
        currentUser={currentUser}
        token={token}
        refreshStudents={refreshStudents}
      />
    );
  }

  if (panel === 'adaptive_test') return <AdaptiveTestPanel />;

  if (panel === 'test_history') return <TestHistoryPanel currentUser={currentUser} token={token} />;

  if (panel === 'worksheets') return <WorksheetsPanel reportsList={reportsList} worksheetsList={worksheetsList} students={students} currentUser={currentUser} token={token} refreshStudents={refreshStudents} />;

  if (panel === 'performance') return <PerformancePanel students={students} currentUser={currentUser} />;


  // ===================== VOLUNTEER & TEACHER ATTENDANCE PANELS =====================
  if (panel === 'assigned_schools') return <AssignedSchoolsPanel schools={schools} students={students} />;

  if (panel === 'student_progress') return <StudentProgressPanel students={students} />;

  if (panel === 'attendance') {
    return (
      <AttendanceTracker
        token={token}
        students={students}
        currentUser={currentUser}
        schools={schools}
      />
    );
  }

  // ===================== PRINCIPAL / SCHOOL ADMIN PANELS =====================
  if (panel === 'teachers' && (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.BLOCK_ADMIN)) {
    return <TeachersPanel schools={schools} teachersList={teachersList} currentUser={currentUser} />;
  }

  // Fix #446: Principal Students navigation (view='students') had no matching
  // panel handler, so PanelViews returned null and rendered nothing.
  // Reuse StudentListPanel — the same component used by teachers for
  // 'student_list'. StudentListPanel already gates the Register/CSV-import
  // actions behind isTeacherOrVolunteer, so the principal gets a read-only
  // roster view without any code duplication.
  if (panel === 'students' && currentUser.role === UserRole.SCHOOL) {
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

  // Admin-only Step-Up Aadhaar Reveal (see backend/src/routes/aadhaarDetokenize.ts).
  // The panel itself enforces role gating as a defence-in-depth; the menu
  // also gates visibility to admin roles in Layout.tsx.
  if (panel === 'aadhaar_reveal') {
    return (
      <AadhaarRevealPanel
        students={students}
        currentUser={currentUser}
        token={token}
        onSelectView={onSelectView}
      />
    );
  }

  // Account-level Authenticator enrollment (admin roles only — see
  // Layout.tsx). The SecurityPanel is the ONLY place a QR is rendered;
  // the per-student reveal dialog never renders a QR or calls the
  // enroll endpoint. See CLAUDE.md "Hard invariant" on TOTP factors.
  if (panel === 'security') {
    return <SecurityPanel currentUser={currentUser} token={token} />;
  }

  // Fallback for any unmatched panel — renders the roles workspace (dashboard) as the content
  return null;
};
