import React, { useState, useMemo } from 'react';
import { User, UserRole, Announcement } from '../types';
import {
  Menu, X, Search, Bell, Sun, Moon, LogOut, ChevronRight, ChevronLeft, ChevronDown,
  LayoutDashboard, BookOpen, UserCheck, Calendar, ShieldCheck, HelpCircle, Settings, Users,
  School, GraduationCap, MapPin, BarChart3, FileText, ClipboardList, ShieldAlert, KeyRound, Clock
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [pinnedItems, setPinnedItems] = useState<string[]>(['Dashboard']);

  // Get dynamic navigation nodes depending on user role
  const navigationItems = useMemo<NavigationItem[]>(() => {
    const list: NavigationItem[] = [];

    // Dashboard (Common to all)
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

      case UserRole.SCHOOL: // Principal
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

      case UserRole.ADMIN: // State Admin
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
        break;
    }

    // Common items at bottom
    list.push({ name: 'Notifications', view: 'notifications', icon: Bell, badge: notifications.length > 0 ? String(notifications.length) : undefined });
    list.push({ name: 'Settings', view: 'settings', icon: Settings });

    return list;
  }, [currentUser.role, notifications.length]);

  // Filter items based on search
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
    <div className={`flex min-h-screen flex-col font-sans bg-slate-50 text-slate-900 antialiased ${darkMode ? 'dark bg-slate-950 text-slate-100' : ''}`}>
      
      {/* 1. Official Government Header Accessibility Strip */}
      <div className="w-full bg-[#111827] text-gray-300 text-[10px] md:text-xs font-semibold px-6 py-2 flex justify-between items-center border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-gov-saffron">GOVERNMENT OF INDIA</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300 hidden sm:inline font-mono">MINISTRY OF SCHOOL EDUCATION & LITERACY</span>
          <span className="text-gray-500 hidden sm:inline">|</span>
          <span className="text-gov-green">DEPARTMENT OF SCHOOL EDUCATION</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => alert("Screen Reader Access enabled. Screen reader voice instructions active.")}
            className="hover:text-white transition hover:underline"
          >
            Screen Reader Access
          </button>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-gov-saffron font-bold cursor-pointer">ENGLISH</span>
            <span className="text-gray-600">/</span>
            <span className="hover:text-white cursor-pointer text-gray-400" onClick={() => alert("ਪੰਜਾਬੀ ਭਾਸ਼ਾ ਵਿੱਚ ਬਦਲੋ")}>ਪੰਜਾਬੀ</span>
            <span className="text-gray-600">/</span>
            <span className="hover:text-white cursor-pointer text-gray-400" onClick={() => alert("हिन्दी भाषा में बदलें")}>हिन्दी</span>
          </div>
        </div>
      </div>

      {/* Tricolor Ribbon Segment */}
      <div className="tricolor-ribbon shrink-0 h-1 bg-gradient-to-r from-gov-saffron via-white to-gov-green" />

      {/* 2. Unified Topbar */}
      <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200 bg-white px-6 transition duration-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-650 hover:bg-slate-100 md:hidden"
            aria-label="Toggle sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-amber-50 border border-amber-200 p-1 shadow-sm shrink-0">
              <svg className="h-10 w-10 text-amber-800" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A3,3 0 0,0 9,5C9,6.08 9.58,7.03 10.42,7.56C9.03,8.4 8,9.88 8,11.6V13.5H16V11.6C16,9.88 14.97,8.4 13.58,7.56C14.42,7.03 15,6.08 15,5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5A1,1 0 0,1 12,6A1,1 0 0,1 11,5A1,1 0 0,1 12,4M10,15V19H14V15H10M9,20V21H15V20H9Z" />
              </svg>
            </div>
            <div className="border-l-2 border-slate-200 pl-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-extrabold tracking-tight text-gov-navy md:text-lg uppercase">
                  NATIONAL FLN PORTAL
                </h1>
                <span className="rounded bg-gov-green/10 px-2.5 py-0.5 text-[9px] font-black text-gov-green uppercase tracking-wider">
                  Official Central Grid
                </span>
              </div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wide">
                Foundational Literacy & Numeracy Portal
              </p>
            </div>
          </div>
        </div>

        {/* Topbar Right Section */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-lg p-2 text-slate-505 hover:bg-slate-100 transition"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 text-slate-505 hover:bg-slate-100 transition"
            >
              <Bell className="h-4.5 w-4.5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-bold text-slate-900">Announcements</span>
                  {notifications.length > 0 && (
                    <button onClick={onClearNotifications} className="text-[10px] font-bold text-indigo-650 hover:underline">
                      Clear All
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">No new announcements</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="p-3 rounded-lg border border-transparent transition hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold text-slate-900">{n.title}</span>
                          <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 transition"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar Left panel */}
        <aside className={`hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}>
          
          {/* Menu Search and Collapse Trigger */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
            {!collapsed && (
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search views..."
                  className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-505"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation Items menu */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {/* Pinned shortcuts header */}
            {!collapsed && pinnedItems.length > 0 && (
              <div className="px-3 py-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
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
                          ? 'bg-gov-navy text-white border-gov-gold/30 shadow-sm'
                          : 'text-slate-650 hover:bg-slate-100 border-transparent hover:text-slate-900'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isSelected ? 'text-gov-saffron' : 'text-slate-400'}`} />
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
                        className={`opacity-0 group-hover:opacity-100 p-1 mr-1 text-slate-400 hover:text-indigo-600 transition`}
                      >
                        ★
                      </button>
                    )}
                  </div>

                  {/* Nested Sub Menu */}
                  {!collapsed && hasSub && isExpanded && (
                    <div className="pl-6 space-y-1 border-l border-slate-150 ml-5 py-1">
                      {item.subItems?.map(sub => {
                        const isSubSelected = activeView === sub.view;
                        return (
                          <button
                            key={sub.name}
                            onClick={() => onSelectView(sub.view)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold rounded-md transition ${
                              isSubSelected
                                ? 'text-indigo-700 bg-indigo-50/50'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
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
          <div className="border-t border-slate-200 p-4">
            <div className={`flex items-center gap-2 px-2 text-[10px] font-semibold text-slate-450 ${collapsed ? 'justify-center' : ''}`}>
              <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
              {!collapsed && <span>IIT Ropar VLED Labs</span>}
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden bg-slate-900/50 backdrop-blur-sm">
            <div className="w-72 bg-white flex flex-col h-full shadow-2xl p-4 animate-slideIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <span className="text-xs font-bold text-slate-900 font-mono">Mobile Menu Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5 text-slate-505" />
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
                            ? 'bg-gov-navy text-white border-gov-gold/30 shadow-sm'
                            : 'text-slate-650 hover:bg-slate-100 border-transparent'
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                        {hasSub && <ChevronDown className="ml-auto h-3 w-3" />}
                      </button>
                      
                      {hasSub && expandedMenus[item.name] && (
                        <div className="pl-6 space-y-1.5 py-1 border-l border-slate-200 ml-5">
                          {item.subItems?.map(sub => (
                            <button
                              key={sub.view}
                              onClick={() => {
                                onSelectView(sub.view);
                                setMobileOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                                activeView === sub.view ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'
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
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50/50">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-2 select-none">
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                <span className={idx === breadcrumbs.length - 1 ? 'text-slate-600 font-extrabold' : ''}>{bc}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Unified Page Header & Content viewport */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Unified Footer Branding */}
          <footer className="mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-slate-400 uppercase font-bold tracking-widest pb-4 select-none">
            <span>© 2026 National Foundational Literacy Portal</span>
            <span>VLED Labs · Indian Institute of Technology Ropar</span>
          </footer>
        </main>
      </div>
    </div>
  );
};
