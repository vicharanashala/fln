import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  Building2,
  School,
  Users,
  GraduationCap,
  ClipboardCheck,
  Wand,
  BarChart3,
  UserCog,
  ScrollText,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const NAV = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "States", to: "/states", icon: Map },
  { label: "Districts", to: "/districts", icon: Building2 },
  { label: "Schools", to: "/schools", icon: School },
  { label: "Teachers", to: "/teachers", icon: Users },
  { label: "Students", to: "/students", icon: GraduationCap },
  { label: "Assessments", to: "/assessments", icon: ClipboardCheck },
  {
    label: "AI Assessment Template",
    to: "/assessment-template-generator",
    icon: Wand,
  },
  { label: "Reports & Analytics", to: "/reports", icon: BarChart3 },
  {
    label: "User Management",
    icon: UserCog,
    children: [
      { label: "All Users", to: "/users" },
      { label: "State Admins", to: "/users?role=state_admin" },
      { label: "District Admins", to: "/users?role=district_admin" },
      { label: "School Admins", to: "/users?role=school" },
      { label: "Teachers", to: "/users?role=teacher" },
    ],
  },
  { label: "Audit Logs", to: "/audit-logs", icon: ScrollText },
  { label: "System Settings", to: "/settings", icon: Settings },
  { label: "Profile", to: "/profile" },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["User Management"]));

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function isActive(to: string) {
    if (to === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(to);
  }

  return (
    <aside className="w-60 h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="h-14 flex items-center px-4 border-b border-slate-200 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 grid place-items-center mr-2.5">
          <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4"><path d="M8 1 2 4.5 8 8l6-3.5L8 1Zm0 7 6 3.5L8 15 2 11.5 8 8Z"/></svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">FLN Platform</p>
          <p className="text-[10px] text-slate-500">National Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map((item) => {
          if (item.children) {
            const open = openGroups.has(item.label);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                    isActive(item.to ?? "")
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {open && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `block px-3 py-1.5 rounded-md text-xs transition ${
                            isActive ? "text-blue-600 font-medium" : "text-slate-500 hover:text-slate-800"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          if (item.to === "/profile") {
            return (
              <NavLink
                key={item.label}
                to={item.to!}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                    isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-600">SA</span>
                </div>
                <span className="text-xs">Super Admin</span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to!}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {item.icon && <item.icon className="w-4 h-4 flex-shrink-0" />}
              <span className="text-xs">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          onClick={() => {
            localStorage.removeItem("fln_token");
            localStorage.removeItem("fln_user");
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition mt-2"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs">Logout</span>
        </button>
      </nav>

      <div className="p-3 border-t border-slate-100 flex-shrink-0">
        <p className="text-[10px] text-slate-400 text-center">FLN v1.0 · Super Admin</p>
      </div>
    </aside>
  );
}