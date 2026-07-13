import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/Login/LoginPage";
import DashboardOverview from "./pages/Dashboard/DashboardOverview";
import StatesPage from "./pages/States/StatesPage";
import DistrictsPage from "./pages/Districts/DistrictsPage";
import SchoolsPage from "./pages/Schools/SchoolsPage";
import TeachersPage from "./pages/Teachers/TeachersPage";
import StudentsPage from "./pages/Students/StudentsPage";
import AssessmentsPage from "./pages/Assessments/AssessmentsPage";
import AssessmentsListPage from "./pages/AssessmentTemplateGenerator/AssessmentsListPage";
import TemplateReviewPage from "./pages/AssessmentTemplateGenerator/TemplateReviewPage";
import ReportsPage from "./pages/Reports/ReportsPage";
import UsersPage from "./pages/Users/UsersPage";
import AuditLogsPage from "./pages/AuditLogs/AuditLogsPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import ProfilePage from "./pages/Profile/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardOverview />} />
        <Route path="states" element={<StatesPage />} />
        <Route path="districts" element={<DistrictsPage />} />
        <Route path="schools" element={<SchoolsPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="assessments" element={<AssessmentsPage />} />
        <Route path="assessment-template-generator" element={<AssessmentsListPage />} />
        <Route path="assessment-template-generator/:id/review" element={<TemplateReviewPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}