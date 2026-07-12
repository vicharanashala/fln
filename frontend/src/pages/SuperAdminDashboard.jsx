import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function SuperAdminDashboard() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Super Admin" />
        <main className="p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}