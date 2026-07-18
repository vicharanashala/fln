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
    if (!currentUser) return null;

    switch (currentUser.role) {
      case 'superadmin':
        return <SuperadminDashboard user={currentUser} />;
      case 'admin':
        return <AdminDashboard user={currentUser} />;
      case 'school':
        return <SchoolDashboard user={currentUser} />;
      case 'teacher':
        return <TeacherDashboard user={currentUser} />;
      case 'volunteer':
        return <VolunteerDashboard user={currentUser} />;
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

      {/* 3. Authorized Dashboard Portal */}
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
          {/* Urgent Announcements Strip inside Layout Content */}
          {activeUrgentAnnouncements.length > 0 && (
            <div className="bg-amber-600 text-white font-medium text-xs py-2.5 px-6 flex items-center justify-between shadow-sm border border-amber-700 rounded-xl mb-6">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">⚠️ CRITICAL ALERT:</span>
                <span>{activeUrgentAnnouncements[0].message}</span>
              </div>
              <span className="text-[10px] font-mono text-amber-200 bg-amber-800/40 px-2 py-0.5 rounded uppercase">
                Escalated
              </span>
            </div>
          )}

          {/* Router switch panel */}
          {activePanel === 'workspace' && renderRoleWorkspace()}
          
          {activePanel === 'logbook' && (
            <LogbookView token={token} user={currentUser} />
          )}
          
          {activePanel === 'tickets' && (
            <TicketSubmission token={token} userRole={currentUser.role} />
          )}
          
          {activePanel === 'calendar' && (
            <AssessmentCalendar />
          )}

          {/* Unified fallback settings panel */}
          {activePanel === 'settings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Settings className="h-6 w-6 text-slate-500" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-sans">Portal Preferences & Account Settings</h2>
                  <p className="text-xs text-slate-505">Configure user settings, localization preferences, and SSO authorization status.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-sans">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 text-xs uppercase font-mono">User Profile Details</h3>
                  <div className="p-4 bg-slate-50 rounded-lg space-y-2 border border-slate-150">
                    <div><span className="text-slate-450 font-semibold text-xs">Full Name:</span> <strong className="text-slate-800">{currentUser.name}</strong></div>
                    <div><span className="text-slate-450 font-semibold text-xs">Email ID:</span> <strong className="text-slate-850 font-mono">{currentUser.email}</strong></div>
                    <div><span className="text-slate-450 font-semibold text-xs">Assigned Scope:</span> <strong className="text-slate-800 font-mono">{currentUser.schoolId || currentUser.districtCode || currentUser.stateCode || 'National Oversight'}</strong></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 text-xs uppercase font-mono">Accessibility Configuration</h3>
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3 border border-slate-150">
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
