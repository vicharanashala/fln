/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { User, UserRole, Announcement } from './types';
import CoordinatorRegistration from './pages/CoordinatorRegistration';
import { LandingView } from './components/LandingView';
import { LoginView } from './components/LoginView';
import { Layout } from './components/Layout';
import { 
  SuperadminDashboard, 
  AdminDashboard, 
  SchoolDashboard, 
  TeacherDashboard, 
  VolunteerDashboard 
} from './components/RoleDashboards';
import { LogbookView } from './components/LogbookView';
import { TicketSubmission } from './components/TicketSubmission';
import { AssessmentCalendar } from './components/AssessmentCalendar';
import { PanelViews } from './components/PanelViews';
import { ShieldCheck, Settings, Bell } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('fln_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'login' | 'dashboard'>('home');
  const [activePanel, setActivePanel] = useState<string>('workspace');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Verify token session on load
  useEffect(() => {
    const checkSession = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setCurrentUser(data.user);
          setCurrentView('dashboard');
        } else {
          const activeUrgentAnnouncements = announcements.filter(a => a.isUrgent);

          return (
            <Routes>
              <Route path="/register-coordinator" element={<CoordinatorRegistration />} />
              <Route
                path="*"
                element={
                  <div className="flex min-h-screen flex-col font-sans bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
                    {/* 1. Public Landing view */}
                    {currentView === 'home' && (
                      <LandingView onNavigateToLogin={() => setCurrentView('login')} />
                    )}

                    {/* 2. Login view */}
                    {currentView === 'login' && (
                      <LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => setCurrentView('home')} />
                    )}

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

                        {/* Panels: workspace, notifications, logbook, tickets, calendar, settings */}
                        {activePanel === 'workspace' && renderRoleWorkspace()}

                        {activePanel === 'notifications' && (
                          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-700">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
                              <Bell className="h-6 w-6 text-slate-550 dark:text-slate-400" />
                              <div>
                                <h2 className="text-lg font-bold text-slate-900 font-sans dark:text-white">Announcements Log</h2>
                                <p className="text-xs text-slate-505 dark:text-slate-400">Official notifications escalated by state administrative coordinators.</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {announcements.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 font-mono text-xs dark:text-slate-500">No active broadcasts.</div>
                              ) : (
                                announcements.map(notif => (
                                  <div key={notif.id} className={`p-4 border rounded-xl space-y-2 ${notif.isUrgent ? 'border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-150 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{notif.title}</h4>
                                      <span className="text-[10px] text-slate-400 font-mono font-bold dark:text-slate-500">{new Date(notif.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-650 leading-relaxed font-sans dark:text-slate-300">{notif.message}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {activePanel === 'logbook' && (
                          <LogbookView token={token} user={currentUser} />
                        )}

                        {activePanel === 'tickets' && (
                          <TicketSubmission token={token} userRole={currentUser.role} />
                        )}

                        {activePanel === 'calendar' && (
                          <AssessmentCalendar />
                        )}

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

                        {/* Panel data views for all navigation items across roles */}
                        {!['workspace', 'logbook', 'tickets', 'calendar', 'settings', 'notifications'].includes(activePanel) && (
                          <PanelViews activePanel={activePanel} currentUser={currentUser} token={token} />
                        )}
                      </Layout>
                    )}

                    {/* Floating Action Toast Alerts */}
                    {toast && (
                      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl border border-slate-800 animate-slideIn dark:border-slate-600">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <ShieldCheck className="h-3 w-3" />
                        </div>
                        <span>{toast}</span>
                      </div>
                    )}
                  </div>
                }
              />
            </Routes>
          );
        }
          {/* Dynamic notifications list panel */}
          {activePanel === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-700">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
                <Bell className="h-6 w-6 text-slate-550 dark:text-slate-400" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-sans dark:text-white">Announcements Log</h2>
                  <p className="text-xs text-slate-505 dark:text-slate-400">Official notifications escalated by state administrative coordinators.</p>
                </div>
              </div>
              <div className="space-y-4">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-mono text-xs dark:text-slate-500">No active broadcasts.</div>
                ) : (
                  announcements.map(notif => (
                    <div key={notif.id} className={`p-4 border rounded-xl space-y-2 ${notif.isUrgent ? 'border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-150 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{notif.title}</h4>
                        <span className="text-[10px] text-slate-400 font-mono font-bold dark:text-slate-500">{new Date(notif.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-650 leading-relaxed font-sans dark:text-slate-300">{notif.message}</p>
>>>>>>> upstream/main
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

              {/* Dynamic notifications list panel */}
              {activePanel === 'notifications' && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <Bell className="h-6 w-6 text-slate-550" />
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 font-sans">Announcements Log</h2>
                      <p className="text-xs text-slate-505">Official notifications escalated by state administrative coordinators.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {announcements.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-mono text-xs">No active broadcasts.</div>
                    ) : (
                      announcements.map(notif => (
                        <div key={notif.id} className={`p-4 border rounded-xl space-y-2 ${notif.isUrgent ? 'border-amber-200 bg-amber-50/30' : 'border-slate-150 bg-slate-50/50'}`}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-slate-900">{notif.title}</h4>
                            <span className="text-[10px] text-slate-400 font-mono font-bold">{new Date(notif.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-650 leading-relaxed font-sans">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Panel data views for all navigation items across roles */}
              {!['workspace', 'logbook', 'tickets', 'calendar', 'settings', 'notifications'].includes(activePanel) && (
                <PanelViews activePanel={activePanel} currentUser={currentUser} token={token} />
              )}
            </Layout>
          )}

          {/* Floating Action Toast Alerts */}
          {toast && (
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl border border-slate-800 animate-slideIn">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-650 text-white">
                <ShieldCheck className="h-3 w-3 animate-ping" />
              </div>
              <span>{toast}</span>
            </div>
          )}
<<<<<<< HEAD
=======

          {/* Panel data views for all navigation items across roles */}
          {!['workspace', 'logbook', 'tickets', 'calendar', 'settings', 'notifications'].includes(activePanel) && (
            <PanelViews activePanel={activePanel} currentUser={currentUser} token={token} />
          )}
        </Layout>
      )}

      {/* Floating Action Toast Alerts */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl border border-slate-700 animate-slideIn dark:border-slate-600">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
            <ShieldCheck className="h-3 w-3" />
          </div>
          <span>{toast}</span>
>>>>>>> upstream/main
        </div>
      } />
    </Routes>
  );
}
