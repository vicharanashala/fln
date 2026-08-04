import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, ShieldCheck } from 'lucide-react';
import { apiFetch, UNAUTHORIZED_EVENT } from './services/apiClient';
import { Announcement, User, UserRole } from './types';
import { LoginView } from './components/LoginView';
import { Layout } from './components/Layout';
import * as RoleDashboards from './components/RoleDashboards';
import { LogbookView } from './components/LogbookView';
import { TicketSubmission } from './components/TicketSubmission';
import { AssessmentCalendar } from './components/AssessmentCalendar';
import { PanelViews } from './components/PanelViews';

const getStoredValue = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const savedUser = getStoredValue('user');
    return savedUser ? (JSON.parse(savedUser) as User) : null;
  } catch {
    return null;
  }
};

const AppFallback = ({ message }: { message: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-700">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      <h2 className="text-lg font-semibold text-slate-900">Preparing your workspace</h2>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
    </div>
  </div>
);

export default function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'coordinator' | 'geo' | 'tracking'>('overview');
  const [token, setToken] = useState<string | null>(() => getStoredValue('token') || getStoredValue('fln_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [currentView, setCurrentView] = useState<'home' | 'login' | 'dashboard'>(() => {
    const saved = getStoredValue('currentView');
    return (saved as 'home' | 'login' | 'dashboard') || 'home';
  });
  const [authReady, setAuthReady] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string>('workspace');

  const activeUrgentAnnouncements = useMemo(
    () => announcements.filter((announcement) => announcement.isUrgent),
    [announcements]
  );

  useEffect(() => {
    let cancelled = false;

    const clearSession = () => {
      if (!cancelled) {
        setToken(null);
        setCurrentUser(null);
        setCurrentView('login');
        localStorage.removeItem('fln_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.setItem('currentView', 'login');
      }
    };

    const activeToken = token ?? localStorage.getItem('fln_token') ?? localStorage.getItem('token');

    if (!activeToken) {
      clearSession();
      setAuthReady(true);
      return;
    }

    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          clearSession();
          setAuthReady(true);
          return;
        }

        if (!res.ok) {
          setCurrentView('login');
          localStorage.setItem('currentView', 'login');
          setAuthReady(true);
          return;
        }

        const data = await res.json();
        const authUser = data?.data?.teacher ?? data?.data?.user ?? data?.teacher ?? data?.user ?? data;

        if (authUser) {
          const normalizedUser = {
            ...(authUser as Partial<User>),
            id: authUser.id || authUser.email || 'guest',
            email: authUser.email || 'user@fln.org',
            name: authUser.name || 'FLN User',
            role: authUser.role || 'superadmin',
          } as User;

          if (!cancelled) {
            setCurrentUser(normalizedUser);
            setToken(activeToken);
            setCurrentView('dashboard');
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            localStorage.setItem('currentView', 'dashboard');
          }
        }

        if (!cancelled) {
          setAuthReady(true);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (!cancelled) {
          clearSession();
          setAuthReady(true);
        }
      }
    };

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const triggerToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setCurrentView('home');
    localStorage.removeItem('fln_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.setItem('currentView', 'home');
    navigate('/');
  };

  const handleLoginSuccess = (newToken: string, user: User) => {
    const normalizedUser = {
      ...user,
      id: user.id || user.email || 'guest',
      email: user.email || 'user@fln.org',
      name: user.name || 'FLN User',
      role: user.role || 'superadmin',
    } as User;

    setToken(newToken);
    setCurrentUser(normalizedUser);
    setCurrentView('dashboard');
    localStorage.setItem('fln_token', newToken);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('currentView', 'dashboard');
  };

  const handleRoleSwitch = (role: UserRole) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, role });
    triggerToast('Role switched');
  };

  const markAnnouncementAsRead = async (id: string) => {
    if (!id) return;

    try {
      const authToken = localStorage.getItem('fln_token') || token;
      await fetch('/api/announcements/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          announcementId: id,
          userId: currentUser?.id,
          userEmail: currentUser?.email,
        }),
      });
    } catch (error) {
      console.error('Failed to persist read receipt:', error);
    }
  };

  const handleMarkNotificationRead = (id: string) => {
    setAnnouncements((prev) => prev.map((announcement) => (announcement.id === id ? { ...announcement, readByMe: true } : announcement)));
    void markAnnouncementAsRead(id);
  };

  const handleClearNotifications = () => {
    const unread = announcements.filter((announcement) => !announcement.readByMe);
    unread.forEach((announcement) => {
      void markAnnouncementAsRead(announcement.id);
    });

    const ids = announcements.map((announcement) => announcement.id);
    const cleared = JSON.parse(localStorage.getItem('fln_cleared_notifications') || '[]') as string[];
    const merged = [...new Set([...cleared, ...ids])];
    localStorage.setItem('fln_cleared_notifications', JSON.stringify(merged));
    setAnnouncements([]);
  };

  const renderRoleWorkspace = () => {
    const role = (currentUser?.role || 'superadmin').toString().toLowerCase().trim();
    const RegionalAnalytics = (RoleDashboards as any).RegionalAnalyticsView;
    const AnnouncementCompliance = (RoleDashboards as any).AnnouncementComplianceView;

    return (
      <div className="flex w-full max-w-[1600px] flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{role === 'superadmin' ? 'National Oversight Center' : 'FLN Workspace'}</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {role === 'superadmin' ? 'IIT Ropar / Vicharanashala Lab • Global Curriculum Master Controls' : 'Your role-based dashboard is ready.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`rounded-lg px-4 py-2 ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/40 hover:text-slate-900'}`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('coordinator')}
              className={`rounded-lg px-4 py-2 ${activeTab === 'coordinator' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/40 hover:text-slate-900'}`}
            >
              Coordinator Management
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('geo')}
              className={`rounded-lg px-4 py-2 ${activeTab === 'geo' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/40 hover:text-slate-900'}`}
            >
              Geographical Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tracking')}
              className={`rounded-lg px-4 py-2 ${activeTab === 'tracking' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white/40 hover:text-slate-900'}`}
            >
              Announcement Read Tracking
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            {activeTab === 'overview' && RegionalAnalytics ? (
              <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <RegionalAnalytics user={currentUser || {}} token={token} />
              </div>
            ) : null}

            {activeTab === 'coordinator' && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                Coordinator Management tables load here.
              </div>
            )}

            {activeTab === 'geo' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Geographical Analytics</h2>
                <p className="mt-2 text-sm text-slate-500">The analytics view is available once the dashboard components load correctly.</p>
              </div>
            )}

            {activeTab === 'tracking' && AnnouncementCompliance ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Announcement Read Tracking</h2>
                <div className="mt-4 overflow-x-auto">
                  <AnnouncementCompliance token={token} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">Portal Status</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-800">Signed in as</div>
                <div>{currentUser?.name || 'FLN User'}</div>
                <div className="text-xs text-slate-500">{currentUser?.email || 'No email available'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-800">Current role</div>
                <div>{role}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const safeActivePanel = activePanel || 'workspace';
  const AnnouncementComplianceView = (RoleDashboards as any).AnnouncementComplianceView;
  const safeCurrentView = currentView || 'home';
  const hasSession = Boolean(token) && Boolean(currentUser);

  try {
    if (!authReady && Boolean(token)) {
      return <AppFallback message="Checking your session and loading the workspace." />;
    }

    if (!hasSession || safeCurrentView === 'login') {
      return <LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => setCurrentView('home')} />;
    }

    return (
      <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <Layout
          currentUser={currentUser!}
          onRoleSwitch={handleRoleSwitch}
          activeView={safeActivePanel}
          onSelectView={setActivePanel}
          notifications={announcements}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearNotifications={handleClearNotifications}
          onLogout={handleLogout}
        >
        {activeUrgentAnnouncements.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-amber-300/80 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">⚠️ CRITICAL ALERT:</span>
              <span>{activeUrgentAnnouncements[0].message}</span>
            </div>
            <span className="rounded bg-amber-800/40 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-200">Escalated</span>
          </div>
        )}

        {safeActivePanel === 'workspace' && renderRoleWorkspace()}

        {safeActivePanel === 'announcement-tracking' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 pb-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Announcement Read Tracking</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Direct access to announcement delivery, read receipts, and engagement tracking.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              {AnnouncementComplianceView ? (
                <AnnouncementComplianceView token={token} />
              ) : null}
            </div>
          </div>
        )}

        {safeActivePanel === 'notifications' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
              <Bell className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Announcements Log</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Official notifications escalated by state administrative coordinators.</p>
              </div>
            </div>
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">No active broadcasts.</div>
              ) : (
                announcements.map((notif) => (
                  <div
                    key={notif.id}
                    className={`space-y-2 rounded-xl border p-4 ${
                      notif.isUrgent
                        ? 'border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/30'
                        : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{notif.title}</h4>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {new Date(notif.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {safeActivePanel === 'logbook' && <LogbookView token={token || ''} user={currentUser} />}
        {safeActivePanel === 'tickets' && <TicketSubmission token={token || ''} userRole={currentUser?.role ?? UserRole.TEACHER} />}
        {safeActivePanel === 'calendar' && <AssessmentCalendar />}

        {safeActivePanel === 'settings' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <Settings className="h-6 w-6 text-slate-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Portal Preferences & Account Settings</h2>
                <p className="text-xs text-slate-500">Configure user settings, localization preferences, and SSO authorization status.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-800">User Profile Details</h3>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div><span className="text-xs font-semibold text-slate-500">Full Name:</span> <strong className="text-slate-800">{currentUser?.name}</strong></div>
                  <div><span className="text-xs font-semibold text-slate-500">Email ID:</span> <strong className="font-mono text-slate-800">{currentUser?.email}</strong></div>
                  <div><span className="text-xs font-semibold text-slate-500">Assigned Scope:</span> <strong className="font-mono text-slate-800">{currentUser?.schoolId || currentUser?.districtCode || currentUser?.stateCode || 'National Oversight'}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!['workspace', 'logbook', 'tickets', 'calendar', 'settings', 'notifications'].includes(safeActivePanel) && currentUser && (
          <PanelViews activePanel={safeActivePanel} currentUser={currentUser} token={token || ''} />
        )}

          {toast && (
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl dark:border-slate-600">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                <ShieldCheck className="h-3 w-3" />
              </div>
              <span>{toast}</span>
            </div>
          )}
        </Layout>
      </div>
    );
  } catch (error) {
    console.error('App render failed:', error);
    return <LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => setCurrentView('home')} />;
  }
}
