import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import Breadcrumb from "../components/layout/Breadcrumb";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
          <Breadcrumb />
        </div>
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}