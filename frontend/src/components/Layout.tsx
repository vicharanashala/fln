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
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        break;

      case UserRole.SCHOOL:
        list.push({ name: 'Teachers', view: 'teachers', icon: Users });
        list.push({ name: 'Students', view: 'students', icon: GraduationCap });
        list.push({ name: 'Performance', view: 'performance', icon: BarChart3 });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        break;

      case UserRole.BLOCK_ADMIN:
        list.push({ name: 'Schools', view: 'schools', icon: School });
        list.push({ name: 'Teachers', view: 'teachers', icon: Users });
        list.push({ name: 'Performance', view: 'performance', icon: BarChart3 });
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.DISTRICT_ADMIN:
        list.push({ name: 'Blocks', view: 'blocks', icon: MapPin });
        list.push({ name: 'Schools', view: 'schools', icon: School });
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.ADMIN:
        list.push({ name: 'Districts', view: 'districts', icon: MapPin });
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        break;

      case UserRole.SUPERADMIN:
        list.push({ name: 'Users', view: 'users', icon: Users });
        list.push({ name: 'Schools', view: 'schools', icon: School });
        list.push({ name: 'Question Bank', view: 'question_bank', icon: BookOpen });
        list.push({ name: 'Worksheet Templates', view: 'worksheet_templates', icon: ClipboardList });
        list.push({ name: 'Content', view: 'content', icon: BookOpen });
        list.push({ name: 'Reports', view: 'reports', icon: FileText });
        list.push({ name: 'Analytics', view: 'analytics', icon: BarChart3 });
        list.push({ name: 'System Settings', view: 'system_settings', icon: Settings });
        list.push({ name: 'Audit Logs', view: 'logbook', icon: ShieldCheck });
        list.push({ name: 'Answer Key', view: 'answer_key', icon: KeyRound });
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
    <div className="flex min-h-screen flex-col font-sans bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">

      {/* Accessibility / Top strip */}
      <div className="w-full bg-[#111827] text-gray-300 text-[10px] md:text-xs font-semibold px-6 py-2 flex justify-between items-center border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white dark:text-gray-200">FLN Portal</span>
          <span className="text-gray-500 dark:text-gray-600">|</span>
          <span className="text-gray-300 dark:text-gray-400 hidden sm:inline font-mono">Foundational Literacy & Numeracy</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold">
            <button onClick={() => adjustFontSize(-10)} className="hover:text-white transition px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500" title="Decrease font size">A-</button>
            <button onClick={resetFontSize} className="hover:text-white transition px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500" title="Reset font size">A</button>
            <button onClick={() => adjustFontSize(10)} className="hover:text-white transition px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500" title="Increase font size">A+</button>
          </div>
          <span className="text-gray-700 dark:text-gray-500">|</span>
          <select
            defaultValue="en"
            onChange={(e) => {
              if (e.target.value === 'hi') alert("हिन्दी भाषा में बदलें");
              if (e.target.value === 'pa') alert("ਪੰਜਾਬੀ ਭਾਸ਼ਾ ਵਿੱਚ ਬਦਲੋ");
            }}
            className="bg-gray-800 text-gray-300 text-[10px] md:text-xs font-bold border border-gray-700 rounded px-2 py-1 outline-none hover:border-gray-500 cursor-pointer"
          >
            <option value="en">English</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </div>

      {/* Unified Topbar */}
      <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200 bg-white px-6 transition duration-200 shrink-0 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-650 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Toggle sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop/Tablet Collapse Button */}
          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="hidden md:flex rounded-lg p-2 text-slate-650 hover:bg-slate-100 transition-colors duration-200 mr-2 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Collapse sidebar"
              aria-expanded="true"
              title="Collapse Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-amber-50 border border-amber-200 p-1 shadow-sm shrink-0 dark:bg-amber-950/40 dark:border-amber-800">
              <svg className="h-10 w-10 text-amber-800 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A3,3 0 0,0 9,5C9,6.08 9.58,7.03 10.42,7.56C9.03,8.4 8,9.88 8,11.6V13.5H16V11.6C16,9.88 14.97,8.4 13.58,7.56C14.42,7.03 15,6.08 15,5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5A1,1 0 0,1 12,6A1,1 0 0,1 11,5A1,1 0 0,1 12,4M10,15V19H14V15H10M9,20V21H15V20H9Z" />
              </svg>
            </div>
            <div className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-extrabold tracking-tight text-slate-900 md:text-lg uppercase dark:text-white">
                  FLN Portal
                </h1>
                <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-[9px] font-black text-emerald-700 uppercase tracking-wider dark:bg-emerald-950/40 dark:text-emerald-400">
                  Official Central Grid
                </span>
              </div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wide dark:text-slate-400">
                Foundational Literacy & Numeracy Portal
              </p>
            </div>
          </div>
        </div>

        {/* Topbar Right Section */}
        <div className="flex items-center gap-4">
          {/* Database Storage Status (MongoDB Only) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-mono font-bold shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-emerald-700 text-[10px] uppercase tracking-wider">MongoDB Connected</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-lg p-2 text-slate-505 hover:bg-slate-100 transition dark:text-slate-400 dark:hover:bg-slate-800"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 text-slate-505 hover:bg-slate-100 transition dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Bell className="h-4.5 w-4.5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white dark:bg-rose-600">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Announcements</span>
                  {notifications.length > 0 && (
                    <button onClick={onClearNotifications} className="text-[10px] font-bold text-indigo-650 hover:underline dark:text-indigo-400">
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
                        className="p-3 rounded-lg border border-transparent transition hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-800"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600 leading-relaxed dark:text-slate-300">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 dark:border-slate-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              {(currentUser.name ?? currentUser.firstName ?? '?').charAt(0)}
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name ?? currentUser.firstName}</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide dark:text-slate-500">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 transition dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
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
          className="hidden md:flex fixed left-0 top-24 z-40 items-center justify-center bg-white border border-slate-200 border-l-0 rounded-r-lg shadow-md p-2.5 text-slate-650 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 group dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
          className={`hidden md:flex flex-col bg-white transition-all duration-300 ease-in-out shrink-0 dark:bg-slate-900 ${
            sidebarCollapsed
              ? 'w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none'
              : 'w-[280px] opacity-100 border-r border-slate-200 dark:border-r dark:border-slate-700'
          }`}
          aria-hidden={sidebarCollapsed}
        >
          <div className="w-[280px] flex flex-col h-full flex-1">
            {/* Menu Search and Collapse Trigger */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 dark:border-slate-800">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search views..."
                  className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:bg-slate-800 dark:focus:border-indigo-500"
                />
              </div>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-505 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-400"
                aria-label="Collapse sidebar"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

          {/* Navigation Items menu */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {/* Pinned shortcuts header */}
            {!collapsed && pinnedItems.length > 0 && (
              <div className="px-3 py-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1 dark:text-slate-500">
                📌 Pinned Views
              </div>
            )}

            {filteredNavItems.map(item => {
              const hasSub = !!item.subItems;
              const isExpanded = !!expandedMenus[item.name];
              const isSelected = activeView === item.view || item.subItems?.some(s => s.view === activeView);

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between group">
                    <button
                      onClick={() => hasSub ? toggleSubMenu(item.name) : onSelectView(item.view)}
                      className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150 border ${
                        isSelected
                          ? 'bg-indigo-700 text-white border-indigo-300 shadow-sm dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800'
                          : 'text-slate-650 hover:bg-slate-100 border-transparent hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:border-transparent'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isSelected ? 'text-indigo-200 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      {!collapsed && <span>{item.name}</span>}
                      {!collapsed && item.badge && (
                        <span className="ml-auto bg-rose-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {!collapsed && hasSub && (
                        <ChevronDown className={`ml-auto h-3 w-3 transition ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {/* Pin button */}
                    {!collapsed && (
                      <button
                        onClick={() => handlePinToggle(item.name)}
                        className={`opacity-0 group-hover:opacity-100 p-1 mr-1 text-slate-400 hover:text-indigo-600 transition dark:text-slate-500 dark:hover:text-indigo-400`}
                      >
                        ★
                      </button>
                    )}
                  </div>

                  {/* Nested Sub Menu */}
                  {!collapsed && hasSub && isExpanded && (
                    <div className="pl-6 space-y-1 border-l border-slate-150 ml-5 py-1 dark:border-slate-700">
                      {item.subItems?.map(sub => {
                        const isSubSelected = activeView === sub.view;
                        return (
                          <button
                            key={sub.name}
                            onClick={() => onSelectView(sub.view)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold rounded-md transition ${
                              isSubSelected
                                ? 'text-indigo-700 bg-indigo-50/50 dark:text-indigo-400 dark:bg-indigo-950/40'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
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

          {/* Support Branding Footer */}
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <div className={`flex items-center gap-2 px-2 text-[10px] font-semibold text-slate-450 ${collapsed ? 'justify-center' : ''} dark:text-slate-500`}>
              <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 dark:text-slate-500" />
              {!collapsed && <span>IIT Ropar VLED Labs</span>}
            </div>
          </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden bg-slate-900/50 backdrop-blur-sm dark:bg-slate-900/70">
            <div className="w-72 bg-white flex flex-col h-full shadow-2xl p-4 animate-slideIn dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 font-mono dark:text-white">Mobile Menu Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5 text-slate-505 dark:text-slate-400" />
                </button>
              </div>

              <nav className="flex-1 space-y-1.5 overflow-y-auto">
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
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold border transition ${
                          isSelected
                            ? 'bg-primary-navy text-white border-accent-gold/30 shadow-sm dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800'
                            : 'text-slate-650 hover:bg-slate-100 border-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:border-transparent'
                        }`}
                      >
                        <item.icon className="h-4 w-4 dark:text-slate-500" />
                        <span>{item.name}</span>
                        {hasSub && <ChevronDown className="ml-auto h-3 w-3" />}
                      </button>

                      {hasSub && expandedMenus[item.name] && (
                        <div className="pl-6 space-y-1.5 py-1 border-l border-slate-200 ml-5 dark:border-slate-700">
                          {item.subItems?.map(sub => (
                            <button
                              key={sub.view}
                              onClick={() => {
                                onSelectView(sub.view);
                                setMobileOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                                activeView === sub.view ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40' : 'text-slate-500 dark:text-slate-400'
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

        {/* Central main display viewport */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-2 select-none dark:text-slate-500">
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />}
                <span className={idx === breadcrumbs.length - 1 ? 'text-slate-600 font-extrabold dark:text-slate-300' : ''}>{bc}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Unified Page Header & Content viewport */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Unified Footer Branding */}
          <footer className="mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-slate-400 uppercase font-bold tracking-widest pb-4 select-none dark:border-slate-700 dark:text-slate-500">
            <span>© 2026 National Foundational Literacy Portal</span>
            <span>VLED Labs · Indian Institute of Technology Ropar</span>
          </footer>
        </main>
      </div>
    </div>
  );
};