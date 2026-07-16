import { useState, useRef, useEffect } from "react";
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

const NOTIFICATIONS = [
  { id: "1", title: "New assessment published", message: "FLN Q3 Assessment 2025-26 is now live", time: "2 min ago", unread: true },
  { id: "2", title: "State report ready", message: "Rajasthan FLN performance report is ready", time: "1 hour ago", unread: true },
  { id: "3", title: "Template approved", message: "Numeracy Template v2 has been approved", time: "3 hours ago", unread: false },
];

export default function Topbar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-3 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search states, districts, schools, assessments…"
            className="input pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
          title="Toggle theme"
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Notifications</span>
                {unreadCount > 0 && <span className="chip-blue text-[10px]">{unreadCount} new</span>}
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {NOTIFICATIONS.map((n) => (
                  <div key={n.id} className={`px-4 py-3 hover:bg-slate-50 transition ${n.unread ? "bg-blue-50/40" : ""}`}>
                    <div className="flex items-start gap-2">
                      {n.unread && <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                      <div>
                        <p className="text-xs font-medium text-slate-900">{n.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100">
                <button className="text-xs text-blue-600 font-medium hover:text-blue-700">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white grid place-items-center text-xs font-bold">
              SA
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-slate-900 leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Super Admin</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1">
              <a href="/profile" className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <User className="w-4 h-4 text-slate-400" /> My Profile
              </a>
              <a href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Settings className="w-4 h-4 text-slate-400" /> Settings
              </a>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}