/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { Announcement, User, UserRole } from './types';
import CoordinatorRegistration from './pages/CoordinatorRegistration';
import { LandingView } from './components/LandingView';
import { LoginView } from './components/LoginView';
import { Layout } from './components/Layout';
import {
  SuperadminDashboard,
  AdminDashboard,
  SchoolDashboard,
  TeacherDashboard,
  VolunteerDashboard,
} from './components/RoleDashboards';
import { LogbookView } from './components/LogbookView';
import { TicketSubmission } from './components/TicketSubmission';
import { AssessmentCalendar } from './components/AssessmentCalendar';
import { PanelViews } from './components/PanelViews';
import { Bell, Settings, ShieldCheck } from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(localStorage.getItem('fln_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'login' | 'dashboard'>('home');
  const [activePanel, setActivePanel] = useState<string>('workspace');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!token) return;

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setToken(null);
          localStorage.removeItem('fln_token');
          setCurrentView('home');
          return;
        }

        const data = await res.json();
        setCurrentUser(data.user);
        setCurrentView('dashboard');
      } catch {
        setToken(null);
        localStorage.removeItem('fln_token');
        setCurrentView('home');
      }
    };

    checkSession();
  }, [token]);

  const handleLoginSuccess = (newToken: string, user: User) => {
    setToken(newToken);
    localStorage.setItem('fln_token', newToken);
    setCurrentUser(user);
    setCurrentView('dashboard');
    navigate('/');
  };

  const handleRoleSwitch = (role: UserRole) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, role });
    triggerToast('Role switched');
  };

  const handleMarkNotificationRead = (id: string) => {
    setAnnouncements(prev => prev.map(a => (a.id === id ? { ...a, read: true } : a)));
  };

  const handleClearNotifications = () => setAnnouncements([]);

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('fln_token');
    setCurrentView('home');
    navigate('/');
  };

  const renderRoleWorkspace = () => {
    if (!currentUser || !token) return null;

    switch (currentUser.role) {
      case 'superadmin':
        return <SuperadminDashboard user={currentUser} token={token} />;
      case 'admin':
        return <AdminDashboard user={currentUser} token={token} />;
      case 'district_admin':
        return <AdminDashboard user={currentUser} token={token} />;
      case 'block_admin':
        return <AdminDashboard user={currentUser} token={token} />;
      case 'school':
        return <SchoolDashboard user={currentUser} token={token} />;
      case 'teacher':
        return <TeacherDashboard user={currentUser} token={token} />;
      case 'volunteer':
        return <VolunteerDashboard user={currentUser} token={token} />;
      default:
        return <div />;
    }
  };

  const activeUrgentAnnouncements = announcements.filter(a => a.isUrgent);

  return (
    <Routes>
      <Route path="/register-coordinator" element={<CoordinatorRegistration />} />
      <Route
        path="*"
        element={
          <div className="flex min-h-screen flex-col font-sans bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
            {currentView === 'home' && <LandingView onNavigateToLogin={() => setCurrentView('login')} />}
            {currentView === 'login' && <LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => setCurrentView('home')} />}

            {currentView === 'dashboard' && currentUser && token && (
              <Layout
                currentUser={currentUser}
                onRoleSwitch={handleRoleSwitch}
                activeView={activePanel}
                onSelectView={setActivePanel}
                notifications={announcements}
                onMarkNotificationRead={handleMarkNotificationRead}
                onClearNotifications={handleClearNotifications}
                onLogout={handleLogout}
              >
                {activeUrgentAnnouncements.length > 0 && (
                  <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-700 bg-amber-600 px-6 py-2.5 text-xs font-medium text-white shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">⚠️ CRITICAL ALERT:</span>
                      <span>{activeUrgentAnnouncements[0].message}</span>
                    </div>
                    <span className="rounded bg-amber-800/40 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-200">Escalated</span>
                  </div>
                )}

                {activePanel === 'workspace' && renderRoleWorkspace()}

                {activePanel === 'notifications' && (
                  <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
                      <Bell className="h-6 w-6 text-slate-550 dark:text-slate-400" />
                      <div>
                        <h2 className="font-sans text-lg font-bold text-slate-900 dark:text-white">Announcements Log</h2>
                        <p className="text-xs text-slate-505 dark:text-slate-400">Official notifications escalated by state administrative coordinators.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {announcements.length === 0 ? (
                        <div className="p-8 text-center font-mono text-xs text-slate-400 dark:text-slate-500">No active broadcasts.</div>
                      ) : (
                        announcements.map(notif => (
                          <div
                            key={notif.id}
                            className={`space-y-2 rounded-xl border p-4 ${
                              notif.isUrgent
                                ? 'border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/30'
                                : 'border-slate-150 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{notif.title}</h4>
                              <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                {new Date(notif.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="font-sans text-xs leading-relaxed text-slate-650 dark:text-slate-300">{notif.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activePanel === 'logbook' && <LogbookView token={token} user={currentUser} />}
                {activePanel === 'tickets' && <TicketSubmission token={token} userRole={currentUser.role} />}
                {activePanel === 'calendar' && <AssessmentCalendar />}

                {activePanel === 'settings' && (
                  <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <Settings className="h-6 w-6 text-slate-500" />
                      <div>
                        <h2 className="font-sans text-lg font-bold text-slate-900">Portal Preferences & Account Settings</h2>
                        <p className="text-xs text-slate-505">Configure user settings, localization preferences, and SSO authorization status.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 text-sm font-sans md:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="font-mono text-xs font-bold uppercase text-slate-800">User Profile Details</h3>
                        <div className="space-y-2 rounded-lg border border-slate-150 bg-slate-50 p-4">
                          <div><span className="text-xs font-semibold text-slate-450">Full Name:</span> <strong className="text-slate-800">{currentUser.name}</strong></div>
                          <div><span className="text-xs font-semibold text-slate-450">Email ID:</span> <strong className="font-mono text-slate-850">{currentUser.email}</strong></div>
                          <div><span className="text-xs font-semibold text-slate-450">Assigned Scope:</span> <strong className="font-mono text-slate-800">{currentUser.schoolId || currentUser.districtCode || currentUser.stateCode || 'National Oversight'}</strong></div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="font-mono text-xs font-bold uppercase text-slate-800">Accessibility Configuration</h3>
                        <div className="space-y-3 rounded-lg border border-slate-150 bg-slate-50 p-4">
                          <label className="flex items-center gap-2 font-medium">
                            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-indigo-650" />
                            <span>Enable High-Contrast Border Outlines</span>
                          </label>
                          <label className="flex items-center gap-2 font-medium">
                            <input type="checkbox" className="rounded border-slate-300 text-indigo-650" />
                            <span>Audio voice narration on hover (SLA §2.3)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!['workspace', 'logbook', 'tickets', 'calendar', 'settings', 'notifications'].includes(activePanel) && (
                  <PanelViews activePanel={activePanel} currentUser={currentUser} token={token} />
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
            )}
          </div>
        }
      />
    </Routes>
  );
}
