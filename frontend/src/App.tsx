import { apiFetch } from './services/apiClient';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Announcement, User, UserRole } from './types';
import { LandingView } from './components/LandingView';
import { LoginView } from './components/LoginView';
import { Layout } from './components/Layout';
import * as RoleDashboards from './components/RoleDashboards';
import { LogbookView } from './components/LogbookView';
import { TicketSubmission } from './components/TicketSubmission';
import { AssessmentCalendar } from './components/AssessmentCalendar';
import { PanelViews } from './components/PanelViews';
import { Bell, Settings, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'coordinator' | 'geo' | 'tracking'>('overview');
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token') || localStorage.getItem('fln_token'));
  const [currentUser, setCurrentUser] = useState<any>({
    id: 'u1',
    email: 'superadmin@fln.org',
    name: 'Super Admin',
    role: 'superadmin',
  });

  const [currentView, setCurrentView] = useState<'home' | 'login' | 'dashboard'>(() => {
    if (typeof window === 'undefined') return 'dashboard';

    const savedView = window.localStorage.getItem('currentView');
    return savedView === 'home' || savedView === 'login' || savedView === 'dashboard'
      ? savedView
      : 'dashboard';
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string>('workspace');

  const activeUrgentAnnouncements = announcements.filter((announcement) => announcement.isUrgent);

useEffect(() => {
  let cancelled = false;

  const checkSession = async () => {
    const activeToken =
      token ??
      localStorage.getItem('fln_token') ??
      localStorage.getItem('token');

    if (!activeToken) {
      if (!cancelled) {
        setToken(null);
        setCurrentUser(null);
        setCurrentView((prev) => (prev === 'dashboard' ? 'login' : prev));
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (cancelled) return;
      try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (cancelled) return;

      if (res.status === 401 || res.status === 403) {
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem('fln_token');
        localStorage.removeItem('token');
        setCurrentView((prev) => (prev === 'dashboard' ? 'login' : prev));
        return;
      }

      // 🚀 NEW CODE HERE: Fetch the live announcements if user is authenticated!
      if (res.ok) {
        const userData = await res.json();
        setCurrentUser(userData.user || userData); // Set user session
        
        const annRes = await fetch('/api/announcements', {
          headers: { Authorization: `Bearer ${activeToken}` }
        });
        if (annRes.ok) {
          const annData = await annRes.json();
          setAnnouncements(annData);
        }
      }

    } catch (err) {
      console.error("Session verification failed:", err);
    }

      if (res.status === 401 || res.status === 403) {
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem('fln_token');
        localStorage.removeItem('token');
        setCurrentView((prev) => (prev === 'dashboard' ? 'login' : prev));
        return;
      }

      if (!res.ok) {
        setCurrentView((prev) => (prev === 'dashboard' ? 'login' : prev));
        return;
      }

     // 🌟 FULLY DYNAMIC BYPASS FOR ALL DEMO ROLES
    if (activeToken && activeToken.includes('mock-token')) {
      try {
        // Try parsing the user data from localStorage if saved by LoginView
        const mockUserStr = localStorage.getItem('user') || localStorage.getItem('mockUser');
        if (mockUserStr) {
          setCurrentUser(JSON.parse(mockUserStr));
          return;
        }
      } catch (e) {
        console.error("Failed parsing mock user session", e);
      }
      
      // Fallback matching your exact login string logic if object string isn't found
      const isTeacher = activeToken.includes('teacher');
      const isDistrict = activeToken.includes('district');
      const isBlock = activeToken.includes('block');
      
     // Match exact roles expected by the rendering dashboard engine
      let finalRole = 'admin';
      if (isTeacher) finalRole = 'teacher';
      else if (isDistrict) finalRole = 'district';
      else if (isBlock) finalRole = 'block';

      setCurrentUser({
        email: activeToken.split('-')[2] || 'demo@fln.com',
        role: finalRole, // Lowercase matches standard routing checks
        name: isTeacher ? 'Demo Teacher' : isBlock ? 'Ludhiana Block' : isDistrict ? 'District Coordinator' : 'Haryana Admin',
        stateCode: 'PB',
        districtCode: 'LDH',
        blockCode: 'LDH-1'
      });
      return;
    }


      const data = await res.json();
      const authUser =
        data?.data?.teacher ??
        data?.data?.user ??
        data?.teacher ??
        data?.user ??
        data;

      if (!cancelled) {
        setCurrentUser((prev: any) => ({
          ...(prev || {}),
          ...(authUser || {}),
          role: authUser?.role || prev?.role || 'superadmin',
        }));

        setToken(activeToken);
        setCurrentView('dashboard');
      }
    } catch (err) {
      console.error('Auth check failed:', err);

      if (!cancelled) {
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem('fln_token');
        localStorage.removeItem('token');
        setCurrentView((prev) => (prev === 'dashboard' ? 'login' : prev));
      }
    }
  };

  checkSession();

  return () => {
    cancelled = true;
  };
}, [token]);



  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('fln_token');
    setCurrentView('home');
    localStorage.setItem('currentView', 'home');
    navigate('/');
  };

  const renderRoleWorkspace = () => {
    const role = (currentUser?.role || 'superadmin').toString().toLowerCase().trim();

if (role === 'superadmin') {
  const RegionalAnalytics = (RoleDashboards as any).RegionalAnalyticsView;
  const AnnouncementCompliance = (RoleDashboards as any).AnnouncementComplianceView;

  return (
    <div className="p-6 w-full max-w-[1600px] mx-auto flex flex-col gap-6 select-none">
      
      {/* Header & Sub-Navigation Menu */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">National Oversight Center</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            IIT Ropar / Vicharanashala Lab • Global Curriculum Master Controls
          </p>
        </div>
        
        {/* Fully Interactive Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-semibold text-slate-600 self-start lg:self-center">
          <button 
            type="button" 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900 hover:bg-white/40'}`}
          >
            Overview
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab('coordinator')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'coordinator' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900 hover:bg-white/40'}`}
          >
            Coordinator Management
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab('geo')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'geo' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900 hover:bg-white/40'}`}
          >
            Geographical Analytics
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab('tracking')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'tracking' ? 'bg-slate-900 text-white shadow-sm' : 'hover:text-slate-900 hover:bg-white/40'}`}
          >
            Announcement Read Tracking
          </button>
          
<button 
  type="button" 
  onClick={async () => {
    try {
      const res = await fetch('/api/auth/reset-database', { method: 'POST' });
      if (res.ok) {
        alert("Database seeded successfully! Try logging in now.");
        window.location.reload();
      } else {
        alert("Reset failed. Let's try checking the endpoint.");
      }
    } catch (err) {
      console.error(err);
    }
  }}
  className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50/60 font-medium"
>
  Reset Database
</button>

        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Area Content */}
        <div className="xl:col-span-2 flex flex-col gap-6 w-full min-w-0 overflow-hidden">
          
          {/* VIEW 1 & 3: Overview & Geo View show standard regional stats */}
          {(activeTab === 'overview' || activeTab === 'geo') && RegionalAnalytics && (
            <div className="w-full">
              <RegionalAnalytics user={currentUser} token={token} />
            </div>
          )}

          {/* VIEW 2: Coordinator Management placeholder */}
          {activeTab === 'coordinator' && (
            <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-sm text-slate-500 shadow-sm">
              Coordinator Management tables load here.
            </div>
          )}

          {/* VIEW 4: Announcement Read Tracking feature */}
          {activeTab === 'tracking' && AnnouncementCompliance && (
            <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm w-full">
              <div className="border-b border-slate-100 pb-3 mb-5">
                <h2 className="text-lg font-bold text-slate-800">Announcement Read Tracking Dashboard</h2>
                <p className="text-xs text-slate-400 mt-0.5">Real-time receipt confirmation and system delivery logs.</p>
              </div>
              
              <div className="w-full max-w-full overflow-x-auto">
                <AnnouncementCompliance token={token} />
              </div>
            </div>
          )}
        </div>

        {/* Right Area Layout: Post Global Announcement Form */}
        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm sticky top-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Post Global Announcement</h3>
          <form 
  onSubmit={async (e) => {
    e.preventDefault();
    
    // 1. Get the values directly from the input fields
    const titleInput = document.querySelector('input[placeholder="Announcement title..."]') as HTMLInputElement;
    const messageInput = document.querySelector('textarea[placeholder="Details of the broadcast..."]') as HTMLTextAreaElement;
    
    if (!titleInput?.value || !messageInput?.value) {
      alert("Please fill out both fields!");
      return;
    }

    try {
      // 2. Fire the network request straight to your backend
      const response = await fetch('/api/announcements/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: titleInput.value,
          message: messageInput.value,
          isUrgent: false
        })
      });

      if (response.ok) {
        alert("Broadcast sent successfully!");
        titleInput.value = '';
        messageInput.value = '';
        window.location.reload(); // Refresh to show the new data on your dashboard
      } else {
        alert("Server returned an error.");
      }
    } catch (err) {
      console.error("Failed to send broadcast:", err);
    }
  }} 
  className="flex flex-col gap-4"
>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Title</label>
              <input 
                type="text" 
                placeholder="Announcement title..." 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Message Content</label>
              <textarea 
                rows={4} 
                placeholder="Details of the broadcast..." 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-red-600 cursor-pointer select-none">
              <input type="checkbox" className="rounded text-red-600 focus:ring-red-500 border-slate-300" />
              FLAG URGENT & EMAIL ESCALATE
            </label>

            <button 
              type="submit" 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-lg tracking-wide shadow-sm"
            >
              Broadcast Message
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
      
// 🌟 LIVE DEMO INJECTION: Mounts the correct working layout view component
const RegionalDashboardComponent = (RoleDashboards as any).RegionalAnalyticsView;
  if (RegionalDashboardComponent) {
    return <RegionalDashboardComponent user={currentUser || {}} token={token} />;
  }

  return <div className="p-6 text-sm text-slate-500">Loading Dashboard Context...</div>;
  };
  const triggerToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!token) return;

      try {
        const res = await apiFetch('/api/auth/me', {
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
    setCurrentUser({ ...user, role: 'superadmin' });
    setCurrentView('dashboard');
    localStorage.setItem('currentView', 'dashboard');
  };

  const handleRoleSwitch = (role: UserRole) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, role });
    triggerToast('Role switched');
  };
// ✅ REPLACE WITH THIS:
const markAnnouncementAsRead = async (id: string) => {
  if (!id) return;

  try {
    const token = localStorage.getItem('fln_token');

    await fetch(`/api/announcements/${id}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      // 🟢 SEND THE CURRENT USER ID HERE:
      body: JSON.stringify({ 
        userId: currentUser?.id, 
        userEmail: currentUser?.email 
      })
    });
  } catch (err) {
    console.error('Failed to persist read receipt:', err);
  }
};

  const handleMarkNotificationRead = (id: string) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, readByMe: true } : a)));
    void markAnnouncementAsRead(id);
  };

  const handleClearNotifications = () => {
    const unread = announcements.filter((a) => !a.readByMe);
    unread.forEach((a) => {
      void markAnnouncementAsRead(a.id);
    });

    const ids = announcements.map((a) => a.id);
    const cleared = JSON.parse(localStorage.getItem('fln_cleared_notifications') || '[]') as string[];
    const merged = [...new Set([...cleared, ...ids])];
    localStorage.setItem('fln_cleared_notifications', JSON.stringify(merged));
    setAnnouncements([]);
  };

  return (
    <div className="flex min-h-screen flex-col font-sans bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
      {currentView === 'home' ? (
        <LandingView onNavigateToLogin={() => setCurrentView('login')} />
      ) : currentView === 'login' ? (
        <LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => setCurrentView('home')} />
      ) : (
        <Layout
          currentUser={currentUser}
          activeView={activePanel}
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
                  announcements.map((notif) => (
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
  );
}