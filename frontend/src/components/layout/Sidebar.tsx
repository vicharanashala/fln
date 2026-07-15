import { NavLink, useLocation } from "react-router-dom";
import { Wand, Sparkles, LayoutDashboard } from "lucide-react";

const NAV = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Answer Key",
    to: "/answer-key-generator",
    icon: Wand,
    highlight: true,
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  function isActive(to: string) {
    return pathname.startsWith(to);
  }

  return (
    <aside className="w-64 h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
      {/* Logo header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-700/60 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center mr-3 shadow-lg shadow-blue-500/30">
          <svg viewBox="0 0 16 16" fill="white" className="w-5 h-5">
            <path d="M8 1 2 4.5 8 8l6-3.5L8 1Zm0 7 6 3.5L8 15 2 11.5 8 8Z" />
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-bold text-white tracking-tight">FLN Platform</p>
          <p className="text-[11px] text-slate-400 font-medium">National Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Main Menu
        </p>

        {NAV.map((item) => {
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white border border-violet-400/30 shadow-lg shadow-violet-500/10"
                    : "text-violet-200 hover:bg-violet-500/10 border border-violet-500/20"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                      isActive ? "text-violet-300" : "text-violet-400 group-hover:text-violet-300"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.highlight && <Sparkles className="w-3.5 h-3.5 text-violet-300" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800/60">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white font-bold text-xs shadow-md">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">Super Admin</p>
            <p className="text-[10px] text-slate-400 truncate">admin@fln.org</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-3 font-medium">
          FLN v1.0 · 2025
        </p>
      </div>
    </aside>
  );
}
