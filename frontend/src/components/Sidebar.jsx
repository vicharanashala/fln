import { LayoutDashboard, FileText, Users, BarChart3 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/superadmin", label: "Overview", icon: LayoutDashboard },
  { to: "/superadmin/assessments", label: "Assessments", icon: FileText },
  { to: "/superadmin/users", label: "Users", icon: Users },
  { to: "/superadmin/reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
      <div className="h-14 flex items-center px-5 border-b border-slate-200">
        <span className="font-semibold text-slate-900">FLN Platform</span>
      </div>
      <nav className="p-3 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}