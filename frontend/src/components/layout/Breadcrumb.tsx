import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const BREADCRUMBS: Record<string, string> = {
  dashboard: "Dashboard",
  states: "States",
  districts: "Districts",
  schools: "Schools",
  teachers: "Teachers",
  students: "Students",
  assessments: "Assessments",
  "assessment-template-generator": "AI Assessment Template Generator",
  reports: "Reports & Analytics",
  users: "User Management",
  "audit-logs": "Audit Logs",
  settings: "System Settings",
  profile: "My Profile",
};

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0 || (parts.length === 1 && parts[0] === "dashboard")) {
    return <span className="text-xs text-slate-500">Dashboard</span>;
  }

  return (
    <nav className="flex items-center gap-1 text-xs">
      <Link to="/dashboard" className="text-slate-400 hover:text-slate-700">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {parts.map((part, i) => {
        const label = BREADCRUMBS[part] ?? part.replace(/-/g, " ");
        const to = "/" + parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;
        return (
          <span key={to} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-slate-300" />
            {isLast ? (
              <span className="font-medium text-slate-900 capitalize">{label}</span>
            ) : (
              <Link to={to} className="text-slate-500 hover:text-slate-700 capitalize">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}