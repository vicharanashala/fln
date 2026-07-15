import React, { useState, useMemo } from 'react';
import { User, UserRole, Announcement } from '../types';
import {
  Menu, X, Search, Bell, Sun, Moon, LogOut, ChevronRight, ChevronLeft, ChevronDown,
  LayoutDashboard, BookOpen, UserCheck, Calendar, ShieldCheck, HelpCircle, Settings, Users,
  School, GraduationCap, MapPin, BarChart3, FileText, ClipboardList, ShieldAlert, KeyRound,   Clock
} from 'lucide-react';

interface NavigationItem {
  name: string;
  view: string;
  icon: any;
  badge?: string;
  subItems?: { name: string; view: string }[];
}

interface LayoutProps {
  currentUser: User;
  onRoleSwitch: (role: UserRole) => void;
  activeView: string;
  onSelectView: (view: string) => void;
  notifications: Announcement[];
  onMarkNotificationRead: (id: string) => void;
  onClearNotifications: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentUser,
  onRoleSwitch,
  activeView,
  onSelectView,
  notifications,
  onMarkNotificationRead,
  onClearNotifications,
  onLogout,
  children
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('fln_sidebar_collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('fln_dark_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem('fln_font_size');
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });
  const [pinnedItems, setPinnedItems] = useState<string[]>(['Dashboard']);

  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(150, Math.max(75, prev + delta));
      document.documentElement.style.fontSize = `${next}%`;
      localStorage.setItem('fln_font_size', String(next));
      return next;
    });
  };

  const resetFontSize = () => {
    setFontSize(100);
    document.documentElement.style.fontSize = '100%';
    localStorage.setItem('fln_font_size', '100');
  };

  React.useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('fln_dark_mode', String(darkMode));
  }, [darkMode]);

  const collapsed = false;

  const toggleSidebar = () => {
    setSidebarCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('fln_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const navigationItems = useMemo<NavigationItem[]>(() => {
    const list: NavigationItem[] = [];

    list.push({ name: 'Dashboard', view: 'workspace', icon: LayoutDashboard });

    switch (currentUser.role) {
      case UserRole.TEACHER:
        list.push({
          name: 'Assessment',
          view: 'assessment',
          icon: BookOpen,
          subItems: [
            { name: 'Diagnostic Test', view: 'diagnostic_test' },
            { name: 'Adaptive Test', view: 'adaptive_test' },
            { name: 'Test History', view: 'test_history' }
          ]
        });
        list.push({
          name: 'Students',
          view: 'students',
          icon: GraduationCap,
          subItems: [
            { name: 'Student List', view: 'student_list' },
            { name: 'Student Profile', view: 'student_profile' },
            { name: 'Performance', view: 'performance' }
          ]
        });
        list.push({ name: 'Worksheets', view: 'worksheets', icon: ClipboardList });
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        break;

      case UserRole.VOLUNTEER:
        list.push({
          name: 'Assessment',
          view: 'assessment',
          icon: BookOpen,
          subItems: [
            { name: 'Diagnostic Test', view: 'diagnostic_test' },
            { name: 'Adaptive Test', view: 'adaptive_test' },
            { name: 'Test History', view: 'test_history' }
          ]
        });
        list.push({
          name: 'Students',
          view: 'students',
          icon: GraduationCap,
          subItems: [
            { name: 'Student List', view: 'student_list' },
            { name: 'Student Profile', view: 'student_profile' },
            { name: 'Performance', view: 'performance' }
          ]
        });
        list.push({ name: 'Worksheets', view: 'worksheets', icon: ClipboardList });
        break;

      case UserRole.SCHOOL:
        list.push({ name: 'Teachers', view: 'teachers', icon: Users });
        list.push({ name: 'Students', view: 'students', icon: GraduationCap });
        list.push({ name: 'Performance', view: 'performance', icon: BarChart3 });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.BLOCK_ADMIN:
        list.push({ name: 'Schools', view: 'schools', icon: School });
        list.push({ name: 'Teachers', view: 'teachers', icon: Users });
        list.push({ name: 'Performance', view: 'performance', icon: BarChart3 });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.DISTRICT_ADMIN:
        list.push({ name: 'Blocks', view: 'blocks', icon: MapPin });
        list.push({ name: 'Schools', view: 'schools', icon: School });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.ADMIN:
        list.push({ name: 'Districts', view: 'districts', icon: MapPin });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.SUPERADMIN:
        list.push({ name: 'Users', view: 'users', icon: Users });
        list.push({ name: 'Schools', view: 'schools', icon: School });
        // Question Bank removed from Superadmin navigation
        list.push({ name: 'Worksheet Templates', view: 'worksheet_templates', icon: ClipboardList });
        list.push({ name: 'Content', view: 'content', icon: BookOpen });
        // Reports intentionally omitted for Superadmin — available to Teacher/School roles
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        // System settings will be available via the common 'Settings' entry below
        list.push({ name: 'Activity Logs', view: 'logbook', icon: ShieldCheck });
        break;
    }

    list.push({ name: 'Notifications', view: 'notifications', icon: Bell, badge: notifications.length > 0 ? String(notifications.length) : undefined });
    list.push({ name: 'Settings', view: 'settings', icon: Settings });

    return list;
  }, [currentUser.role, notifications.length]);

  const filteredNavItems = useMemo(() => {
    if (!searchQuery) return navigationItems;
    return navigationItems.filter(item => {
      const matchParent = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChild = item.subItems?.some(sub => sub.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchParent || matchChild;
    });
  }, [navigationItems, searchQuery]);

  const toggleSubMenu = (name: string) => {
    setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handlePinToggle = (name: string) => {
    setPinnedItems(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const getBreadcrumb = () => {
    const parentNode = navigationItems.find(item => {
      if (item.view === activeView) return true;
      return item.subItems?.some(sub => sub.view === activeView);
    });

    if (!parentNode) return ['Portal', 'Workspace'];
    if (parentNode.view === activeView) return ['Portal', parentNode.name];

    const childNode = parentNode.subItems?.find(sub => sub.view === activeView);
    return ['Portal', parentNode.name, childNode?.name || ''];
  };

  const breadcrumbs = getBreadcrumb();

  return (
    <div className="flex min-h-screen flex-col font-sans bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900 antialiased dark:bg-[linear-gradient(135deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100">

      {/* Accessibility / Top strip */}
      <div className="w-full border-b border-slate-200/70 bg-slate-950/95 px-4 py-2.5 text-[10px] font-semibold text-slate-300 backdrop-blur md:px-6 md:text-xs dark:border-slate-800/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 font-bold text-white">FLN Portal</span>
            <span className="hidden text-slate-400 sm:inline">Foundational Literacy & Numeracy</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <button onClick={() => adjustFontSize(-10)} className="rounded px-1.5 py-0.5 text-slate-300 transition hover:bg-white/10 hover:text-white" title="Decrease font size">A-</button>
              <button onClick={resetFontSize} className="rounded px-1.5 py-0.5 text-slate-300 transition hover:bg-white/10 hover:text-white" title="Reset font size">A</button>
              <button onClick={() => adjustFontSize(10)} className="rounded px-1.5 py-0.5 text-slate-300 transition hover:bg-white/10 hover:text-white" title="Increase font size">A+</button>
            </div>
            <div className="relative">
              <select
                defaultValue="en"
                onChange={(e) => {
                  if (e.target.value === 'hi') alert("हिन्दी भाषा में बदलें");
                }}
                className="cursor-pointer appearance-none rounded-full border border-white/10 bg-white/10 px-3 py-1.5 pr-8 text-[10px] font-semibold text-slate-200 outline-none transition hover:border-white/20 hover:bg-white/15 md:text-xs"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Topbar */}
      <header className="sticky top-0 z-30 flex h-20 w-full shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.38)] ring-1 ring-slate-200/60 backdrop-blur-2xl sm:px-6 dark:border-slate-700/80 dark:bg-slate-900/85 dark:ring-slate-800/70">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ui-button rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 text-slate-600 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 md:hidden dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Toggle sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="ui-button mr-2 hidden rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 text-slate-600 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 md:flex dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Collapse sidebar"
              aria-expanded="true"
              title="Collapse Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 p-1 shadow-[0_12px_24px_-18px_rgba(245,158,11,0.6)] dark:border-amber-800/70 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-amber-900/60">
              <svg className="h-10 w-10 text-amber-800 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A3,3 0 0,0 9,5C9,6.08 9.58,7.03 10.42,7.56C9.03,8.4 8,9.88 8,11.6V13.5H16V11.6C16,9.88 14.97,8.4 13.58,7.56C14.42,7.03 15,6.08 15,5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5A1,1 0 0,1 12,6A1,1 0 0,1 11,5A1,1 0 0,1 12,4M10,15V19H14V15H10M9,20V21H15V20H9Z" />
              </svg>
            </div>
            <div className="min-w-0 border-l border-slate-200/80 pl-3 dark:border-slate-700/80">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-900 dark:text-white md:text-lg">
                  FLN Portal
                </h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  Official Central Grid
                </span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 md:text-xs">
                Foundational Literacy & Numeracy Portal
              </p>
            </div>
          </div>

          <div className="hidden min-w-[220px] max-w-[360px] flex-1 lg:block">
            <label className="group flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:border-indigo-200 hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/80 dark:hover:border-indigo-700 dark:hover:bg-slate-800">
              <Search className="h-4 w-4 text-slate-400 transition group-focus-within:text-indigo-500 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspace..."
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-mono font-bold text-emerald-700 shadow-[0_8px_18px_-14px_rgba(16,185,129,0.7)] md:flex dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider">MongoDB Connected</span>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="ui-button rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-700"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="ui-button relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <Bell className="h-4.5 w-4.5" />
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="ui-dropdown absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] z-50 dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Announcements</span>
                  {notifications.length > 0 && (
                    <button onClick={onClearNotifications} className="text-[10px] font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">
                      Clear All
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">No new announcements</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="cursor-pointer rounded-2xl border border-transparent p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.4)] transition hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/70 dark:hover:bg-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-50 text-sm font-semibold text-indigo-700 shadow-sm ring-2 ring-white dark:from-indigo-950/70 dark:to-violet-950/60 dark:text-indigo-300 dark:ring-slate-800">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</span>
              <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="ui-button rounded-2xl border border-slate-200/80 bg-white/90 p-2 text-slate-400 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-red-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Toggle Button (visible only when sidebar is collapsed on desktop/tablet) */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="ui-button hidden md:flex fixed left-0 top-24 z-40 items-center justify-center bg-white border border-slate-200 border-l-0 rounded-r-lg shadow-md p-2.5 text-slate-650 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 group dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Show sidebar"
          aria-expanded="false"
          title="Show Sidebar"
        >
          <Menu className="h-5 w-5" />

          {/* Tooltip */}
          <div className="absolute left-12 scale-0 transition-all rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:scale-100 z-50 whitespace-nowrap shadow-md pointer-events-none dark:bg-slate-800">
            Show Sidebar
          </div>
        </button>
      )}

      {/* Main Content Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar Left panel */}
        <aside
          className={`ui-sidebar hidden md:flex flex-col shrink-0 bg-white/85 backdrop-blur-xl shadow-[14px_0_44px_-30px_rgba(15,23,42,0.28)] dark:bg-slate-900/85 ${
            sidebarCollapsed
              ? 'w-0 overflow-hidden border-r-0 opacity-0 pointer-events-none'
              : 'w-[292px] border-r border-slate-200/80 opacity-100 dark:border-slate-700/80'
          }`}
          aria-hidden={sidebarCollapsed}
        >
          <div className="flex h-full w-[292px] flex-1 flex-col">
            <div className="border-b border-slate-200/70 p-4 dark:border-slate-800/80">
              <div className="rounded-[24px] bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 p-3.5 text-white shadow-[0_20px_35px_-20px_rgba(79,70,229,0.72)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-100">Workspace</p>
                    <p className="mt-1 text-sm font-semibold">{currentUser.role.replace('_', ' ')}</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-2.5 shadow-inner">
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200/70 p-4 dark:border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search views..."
                    className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/90 py-2 pl-8 pr-2 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:bg-slate-800 dark:focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={toggleSidebar}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 text-slate-500 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.45)] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-700"
                  aria-label="Collapse sidebar"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            <nav className="flex-1 space-y-3 overflow-y-auto p-3">
              <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Primary navigation</span>
                <span className="rounded-full border border-slate-200/70 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-400">{navigationItems.length} items</span>
              </div>

              {!collapsed && pinnedItems.length > 0 && (
                <div className="mb-1 block px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                  📌 Pinned Views
                </div>
              )}

              {filteredNavItems.map(item => {
                const hasSub = !!item.subItems;
                const isExpanded = !!expandedMenus[item.name];
                const isSelected = activeView === item.view || item.subItems?.some(s => s.view === activeView);

                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="group flex items-center justify-between">
                      <button
                        onClick={() => hasSub ? toggleSubMenu(item.name) : onSelectView(item.view)}
                        className={`ui-button relative flex flex-1 items-center gap-3 rounded-[18px] border px-3 py-2.75 text-[12px] font-semibold tracking-[0.01em] transition-all duration-200 overflow-hidden ${
                          isSelected
                            ? 'border-indigo-200/80 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_16px_28px_-18px_rgba(79,70,229,0.72)] ring-1 ring-indigo-200/80 dark:border-indigo-800/60 dark:from-indigo-700 dark:to-violet-700 dark:text-indigo-50 dark:ring-indigo-700/50'
                            : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-[0_10px_20px_-16px_rgba(15,23,42,0.3)] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                        }`}
                      >
                        <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${isSelected ? 'bg-white/90' : 'bg-transparent'}`} />
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400'}`}>
                          <item.icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        </span>
                        {!collapsed && <span className="flex-1 text-left">{item.name}</span>}
                        {!collapsed && item.badge && (
                          <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 font-mono text-[9px] text-white shadow-sm">
                            {item.badge}
                          </span>
                        )}
                        {!collapsed && hasSub && (
                          <ChevronDown className={`ml-auto h-3.5 w-3.5 transition ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>

                      {!collapsed && (
                        <button
                          onClick={() => handlePinToggle(item.name)}
                          className="mr-1 rounded-full p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-indigo-600 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                        >
                          ★
                        </button>
                      )}
                    </div>

                    {!collapsed && hasSub && isExpanded && (
                      <div className="ml-6 space-y-1 border-l border-slate-200/80 py-1 pl-4 dark:border-slate-700/80">
                        {item.subItems?.map(sub => {
                          const isSubSelected = activeView === sub.view;
                          return (
                            <button
                              key={sub.name}
                              onClick={() => onSelectView(sub.view)}
                              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                                isSubSelected
                                  ? 'bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                              <span>{sub.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-slate-200/80 p-4 dark:border-slate-700/80">
              <div className={`flex items-center gap-2 rounded-[18px] border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 text-[10px] font-semibold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-indigo-200 hover:bg-white dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}>
                <HelpCircle className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                {!collapsed && <span>IIT Ropar VLED Labs</span>}
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex bg-slate-900/50 backdrop-blur-sm md:hidden dark:bg-slate-900/70">
            <div className="ui-sidebar flex h-full w-72 flex-col bg-white p-4 shadow-2xl dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Mobile Menu</p>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">Navigation</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-2xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <nav className="flex-1 space-y-2 overflow-y-auto">
                {navigationItems.map(item => {
                  const isSelected = activeView === item.view || item.subItems?.some(s => s.view === activeView);
                  const hasSub = !!item.subItems;

                  return (
                    <div key={item.name} className="space-y-1">
                      <button
                        onClick={() => {
                          if (hasSub) {
                            toggleSubMenu(item.name);
                          } else {
                            onSelectView(item.view);
                            setMobileOpen(false);
                          }
                        }}
                        className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-2.75 text-xs font-semibold transition-all ${
                          isSelected
                            ? 'border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_14px_22px_-16px_rgba(79,70,229,0.7)] dark:border-indigo-800 dark:from-indigo-700 dark:to-violet-700 dark:text-indigo-50'
                            : 'border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isSelected ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800/80'}`}>
                          <item.icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        </span>
                        <span>{item.name}</span>
                        {hasSub && <ChevronDown className="ml-auto h-3 w-3" />}
                      </button>

                      {hasSub && expandedMenus[item.name] && (
                        <div className="ml-6 space-y-1 border-l border-slate-200 py-1 pl-4 dark:border-slate-700">
                          {item.subItems?.map(sub => (
                            <button
                              key={sub.view}
                              onClick={() => {
                                onSelectView(sub.view);
                                setMobileOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                                activeView === sub.view ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <span>{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.08),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] p-4 sm:p-6 md:p-8 dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2.5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur xl:px-5 dark:border-slate-700/70 dark:bg-slate-900/80">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />}
                  <span className={idx === breadcrumbs.length - 1 ? 'font-extrabold text-slate-600 dark:text-slate-300' : ''}>{bc}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.7)] dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Live workspace
            </div>
          </div>

          <div className="space-y-6 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl sm:p-6 dark:border-slate-700/70 dark:bg-slate-900/75">
            {children}
          </div>

          <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 pb-4 pt-6 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-slate-400 dark:border-slate-700/80 dark:text-slate-500 md:flex-row">
            <span>© 2026 National Foundational Literacy Portal</span>
            <span>VLED Labs · Indian Institute of Technology Ropar</span>
          </footer>
        </main>
      </div>
    </div>
  );
};