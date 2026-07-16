import { NavLink } from "react-router-dom";
import { LayoutDashboard, KeyRound, LogOut } from "lucide-react";

const NAV = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Answer Key", to: "/answer-key-generator", icon: KeyRound },
];

export default function Sidebar() {
  return (
    <aside className="w-60 h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 grid place-items-center mr-2.5">
          <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4">
            <path d="M8 1 2 4.5 8 8l6-3.5L8 1Zm0 7 6 3.5L8 15 2 11.5 8 8Z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">FLN Platform</p>
          <p className="text-[10px] text-slate-500">National Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}

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