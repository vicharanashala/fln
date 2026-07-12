import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminOverview from "./pages/superadmin/SuperAdminOverview";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/superadmin"
        element={
          <RequireAuth role="superadmin">
            <SuperAdminDashboard />
          </RequireAuth>
        }
      >
        <Route index element={<SuperAdminOverview />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}