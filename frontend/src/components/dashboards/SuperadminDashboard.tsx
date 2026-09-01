// ==========================================
// 1. SUPERADMIN (NATIONAL) DASHBOARD
// ==========================================
//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../services/apiClient';
import { User, UserRole, School, DashboardProps } from '../../types';
import { UserCheck, CheckCircle2, XCircle } from 'lucide-react';
import { Table, Column } from '../Table';
import { SuperAdminExecutiveDashboard } from '../SuperAdminExecutiveDashboard';
import { RegionalAnalyticsView } from './RegionalAnalyticsView';
import { QuestionInterventionPanel } from '../panels/QuestionInterventionPanel';
import { CurriculumLevelsPanel } from '../panels/CurriculumLevelsPanel';
import { QuestionReviewPanel } from '../panels/QuestionReviewPanel';

export type { DashboardProps };


export const SuperadminDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'coordinators' | 'analytics' | 'intervention' | 'curriculum' | 'qreview'>('overview');
  
  // Overview data
  const [schools, setSchools] = useState<School[]>([]);
  const [stats, setStats] = useState<{ totalStudents: number; certifiedCount: number; certifiedPercent: number; avgFlnLevel: number; [key: string]: any } | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Coordinator creation state
  const [coordName, setCoordName] = useState('');
  const [coordEmail, setCoordEmail] = useState('');
  const [coordPass, setCoordPass] = useState('');
  const [coordRole, setCoordRole] = useState<UserRole>(UserRole.ADMIN);
  const [coordState, setCoordState] = useState('PB');
  const [coordDistrict, setCoordDistrict] = useState('');
  const [coordBlock, setCoordBlock] = useState('');
  const [coordSchoolId, setCoordSchoolId] = useState('');
  const [coordAssignedSchoolsStr, setCoordAssignedSchoolsStr] = useState('');
  const [coordSuccess, setCoordSuccess] = useState('');
  const [coordError, setCoordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coordinatorsList, setCoordinatorsList] = useState<User[]>([]);

  // School onboarding state
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolState, setNewSchoolState] = useState('PB');
  const [newSchoolDistrict, setNewSchoolDistrict] = useState('');
  const [newSchoolBlock, setNewSchoolBlock] = useState('');
  const [newSchoolStrength, setNewSchoolStrength] = useState<'high' | 'low'>('low');
  const [schoolSuccess, setSchoolSuccess] = useState('');
  const [schoolError, setSchoolError] = useState('');

  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');

  const stateFilterOptions = useMemo(() => {
    return Array.from(new Set(coordinatorsList.map(c => c.stateCode).filter(Boolean)))
      .sort();
  }, [coordinatorsList]);

  const districtFilterOptions = useMemo(() => {
    return Array.from(new Set(
      coordinatorsList
        .filter(c => !stateFilter || c.stateCode === stateFilter)
        .map(c => c.districtCode)
        .filter(Boolean)
    )).sort();
  }, [coordinatorsList, stateFilter]);

  const schoolFilterOptions = useMemo(() => {
    return Array.from(new Set(
      coordinatorsList
        .filter(c => (!stateFilter || c.stateCode === stateFilter) && (!districtFilter || c.districtCode === districtFilter))
        .map(c => c.schoolId)
        .filter(Boolean)
    )).sort();
  }, [coordinatorsList, stateFilter, districtFilter]);

  const filteredCoordinators = useMemo(() => {
    return coordinatorsList.filter(c => {
      if (stateFilter && c.stateCode !== stateFilter) return false;
      if (districtFilter && c.districtCode !== districtFilter) return false;
      if (schoolFilter && c.schoolId !== schoolFilter) return false;
      return true;
    });
  }, [coordinatorsList, stateFilter, districtFilter, schoolFilter]);

  const schoolNameById = useMemo(() => {
    return schools.reduce<Record<string, string>>((map, school) => {
      map[school.id] = school.name;
      return map;
    }, {});
  }, [schools]);

  const resetCoordinatorFilters = () => {
    setStateFilter('');
    setDistrictFilter('');
    setSchoolFilter('');
  };

  const fetchGlobalData = async () => {
    try {
      const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
      const schData = await schRes.json();
      if (Array.isArray(schData)) setSchools(schData);

      const statsRes = await apiFetch('/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCoordinators = async () => {
    try {
      const res = await apiFetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setCoordinatorsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchGlobalData();
    fetchCoordinators();
  }, [token]);

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle || !announcementMsg) return;
    try {
      const res = await apiFetch('/api/announcements/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: announcementTitle, message: announcementMsg, isUrgent })
      });
      if (res.ok) {
        setSuccessMsg('Announcement broadcasted and escalated to email channels successfully!');
        setAnnouncementTitle('');
        setAnnouncementMsg('');
        setIsUrgent(false);
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (_) {}
  };

  const handleCreateCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError('');
    setCoordSuccess('');
    setLoading(true);

    const assignedSchools = coordAssignedSchoolsStr
      ? coordAssignedSchoolsStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : undefined;

    try {
      const res = await apiFetch('/api/admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: coordName,
          email: coordEmail,
          password: coordPass,
          role: coordRole,
          stateCode: coordState,
          districtCode: coordDistrict,
          blockCode: coordBlock,
          schoolId: [UserRole.SCHOOL, UserRole.TEACHER].includes(coordRole) ? coordSchoolId : undefined,
          assignedSchools: coordRole === UserRole.VOLUNTEER ? assignedSchools : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCoordSuccess(`Successfully created account: ${coordName} (${coordRole})`);
        setCoordName('');
        setCoordEmail('');
        setCoordPass('');
        setCoordDistrict('');
        setCoordBlock('');
        setCoordSchoolId('');
        setCoordAssignedSchoolsStr('');
        await fetchCoordinators();
        
        // Refresh school data
        const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
        const schData = await schRes.json();
        if (Array.isArray(schData)) setSchools(schData);

        setTimeout(() => setCoordSuccess(''), 6000);
      } else {
        setCoordError(data.error || 'Failed to register account.');
      }
    } catch (err) {
      setCoordError('Network error. Check connection settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchoolError('');
    setSchoolSuccess('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: newSchoolId,
          name: newSchoolName,
          stateCode: newSchoolState,
          districtCode: newSchoolDistrict,
          blockCode: newSchoolBlock,
          strength: newSchoolStrength
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSchoolSuccess(`Successfully onboarded school: ${newSchoolName} (${newSchoolId.toUpperCase()})`);
        setNewSchoolId('');
        setNewSchoolName('');
        setNewSchoolDistrict('');
        setNewSchoolBlock('');
        // Refresh school list
        const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
        const schData = await schRes.json();
        if (Array.isArray(schData)) setSchools(schData);
        setTimeout(() => setSchoolSuccess(''), 6000);
      } else {
        setSchoolError(data.error || 'Failed to onboard school.');
      }
    } catch (err) {
      setSchoolError('Network error. Check connection settings.');
    } finally {
      setLoading(false);
    }
  };

  // Password complexity live checks
  const isPassLengthValid = coordPass.length >= 8;
  const isPassUppercaseValid = /[A-Z]/.test(coordPass);
  const isPassNumberValid = /[0-9]/.test(coordPass);
  const isPassSpecialValid = /[!@#$%^&*(),.?":{}|<>]/.test(coordPass);

  return (
    <div className="space-y-6" id="superadmin-dashboard">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">National Oversight Center</h1>
          <p className="text-zinc-505 dark:text-zinc-400 text-sm mt-0.5">IIT Ropar / Vicharanashala Lab · Global Curriculum Master Controls</p>
        </div>

        {/* Dashboard Tabs Selector */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit self-start">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'overview' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📋 Overview
          </button>
          <button
            onClick={() => setActiveTab('coordinators')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'coordinators' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            👤 Coordinator Management
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'analytics' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📊 Geographical Analytics
          </button>
          <button
            onClick={() => setActiveTab('intervention')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'intervention' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            ❓ Question Intervention
          </button>
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'curriculum' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            🎯 Curriculum Levels
          </button>
          <button
            onClick={() => setActiveTab('qreview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'qreview' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📝 Question Review
          </button>
        </div>

      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <SuperAdminExecutiveDashboard user={user} token={token} />

          {/* Global Announcement Drawer */}
          <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <span>📣 Post Global Announcement & Email Escalate</span>
            </h3>
            <form onSubmit={postAnnouncement} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Announcement title..."
                  className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Message Content</label>
                <input
                  type="text"
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  placeholder="Broadcast message details..."
                  className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="md:col-span-1 flex flex-col justify-end gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-[11px] text-red-600 font-bold uppercase font-mono">Urgent Email</span>
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs py-2.5 px-4 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Broadcast
                </button>
              </div>
            </form>
            {successMsg && <div className="mt-3 p-2 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-xl border border-green-200">{successMsg}</div>}
          </div>
        </div>
      )}


      {activeTab === 'coordinators' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Admin registration form */}
          <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-xl p-5 shadow-sm h-fit space-y-4">
            <h3 className="text-lg font-display font-medium text-zinc-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-zinc-500" />
              <span>Register New Coordinator</span>
            </h3>

            {coordSuccess && <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 rounded border border-green-200 dark:border-green-800">{coordSuccess}</div>}
            {coordError && <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-850 dark:text-red-200 rounded border border-red-200 dark:border-red-800">{coordError}</div>}

            <form onSubmit={handleCreateCoordinator} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={coordName}
                  onChange={e => setCoordName(e.target.value)}
                  placeholder="e.g. Dr. Satnam Singh"
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 outline-none focus:bg-white dark:focus:bg-zinc-700 focus:border-zinc-500 font-medium text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Email Identifier</label>
                <input
                  type="email"
                  value={coordEmail}
                  onChange={e => setCoordEmail(e.target.value)}
                  placeholder="e.g. s.singh@pb.fln.org"
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 outline-none focus:bg-white dark:focus:bg-zinc-700 focus:border-zinc-500 font-medium text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Account Password</label>
                <input
                  type="password"
                  value={coordPass}
                  onChange={e => setCoordPass(e.target.value)}
                  placeholder="Create complex password..."
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 outline-none focus:bg-white dark:focus:bg-zinc-700 focus:border-zinc-500 font-medium text-zinc-900 dark:text-white"
                />
                
                {/* Real-time complexity checklist (§3.2 A-3) */}
                <div className="mt-2.5 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-1.5">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold block">Password SLA Checks</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <span className="flex items-center gap-1">
                      {isPassLengthValid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-zinc-300" />}
                      <span className={isPassLengthValid ? 'text-green-700' : 'text-zinc-550'}>&gt;= 8 Characters</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {isPassUppercaseValid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-zinc-300" />}
                      <span className={isPassUppercaseValid ? 'text-green-700' : 'text-zinc-550'}>1 Uppercase</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {isPassNumberValid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-zinc-300" />}
                      <span className={isPassNumberValid ? 'text-green-700' : 'text-zinc-550'}>1 Numeric Digit</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {isPassSpecialValid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-zinc-300" />}
                      <span className={isPassSpecialValid ? 'text-green-700' : 'text-zinc-550'}>1 Symbol (!@#...)</span>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Administrative Role Tier</label>
                <select
                  value={coordRole}
                  onChange={e => {
                    const selectedRole = e.target.value as UserRole;
                    setCoordRole(selectedRole);
                    if (selectedRole === UserRole.ADMIN) {
                      setCoordDistrict('');
                      setCoordBlock('');
                    } else if (selectedRole === UserRole.DISTRICT_ADMIN) {
                      setCoordBlock('');
                    }
                  }}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 outline-none focus:bg-white dark:focus:bg-zinc-700 font-medium text-zinc-850 dark:text-zinc-100"
                >
                  <option value={UserRole.ADMIN}>State Admin / Coordinator</option>
                  <option value={UserRole.DISTRICT_ADMIN}>District Admin / Officer</option>
                  <option value={UserRole.BLOCK_ADMIN}>Block Admin / Supervisor</option>
                  <option value={UserRole.SCHOOL}>School Principal</option>
                  <option value={UserRole.TEACHER}>Teacher</option>
                  <option value={UserRole.VOLUNTEER}>Volunteer</option>
                </select>
              </div>

              {/* Scope nodes triggers dynamically depending on role */}
              {![UserRole.SCHOOL, UserRole.TEACHER, UserRole.VOLUNTEER].includes(coordRole) && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-0.5">State Code</label>
                    <input
                       type="text"
                       value={coordState}
                       onChange={e => setCoordState(e.target.value.toUpperCase())}
                       placeholder="e.g. PB"
                       required
                       className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-200"
                     />
                   </div>
                   
                   {coordRole !== UserRole.ADMIN && (
                     <div>
                       <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-0.5">District Code</label>
                       <input
                         type="text"
                         value={coordDistrict}
                         onChange={e => setCoordDistrict(e.target.value.toUpperCase())}
                         placeholder="e.g. LDH"
                         required
                         className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-200"
                       />
                     </div>
                   )}

                   {coordRole === UserRole.BLOCK_ADMIN && (
                     <div>
                       <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Block Code</label>
                       <input
                         type="text"
                         value={coordBlock}
                         onChange={e => setCoordBlock(e.target.value.toUpperCase())}
                         placeholder="e.g. LDH-01"
                         required
                         className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-200"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* School scope text input for School and Teacher roles */}
              {[UserRole.SCHOOL, UserRole.TEACHER].includes(coordRole) && (
                <div>
                   <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Assigned School ID</label>
                   <input
                     type="text"
                     value={coordSchoolId}
                     onChange={e => setCoordSchoolId(e.target.value)}
                     placeholder="e.g. gps-vl-002"
                     required
                     className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 outline-none focus:bg-white dark:focus:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-100"
                   />
                 </div>
               )}

               {/* Comma-separated school IDs for Volunteers */}
               {coordRole === UserRole.VOLUNTEER && (
                 <div>
                   <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Assigned School IDs (Comma Separated)</label>
                   <input
                     type="text"
                     value={coordAssignedSchoolsStr}
                     onChange={e => setCoordAssignedSchoolsStr(e.target.value)}
                     placeholder="e.g. gps-vl-002, gps-jai-004"
                     required
                     className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 outline-none focus:bg-white dark:focus:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-100"
                   />
                 </div>
               )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 font-medium text-sm py-2.5 px-4 rounded-lg cursor-pointer shadow-sm transition-colors mt-2 text-center block font-mono"
              >
                {loading ? 'Registering...' : 'Provision Account'}
              </button>
            </form>
          </div>

          {/* Coordinators lists */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div>
                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">Registered Coordinators Index</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Filter coordinator records by state, district, and school.</p>
              </div>
              <button
                onClick={resetCoordinatorFilters}
                className="text-xs font-semibold text-indigo-700 hover:underline"
              >
                Reset filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">State</label>
                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setDistrictFilter('');
                    setSchoolFilter('');
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-zinc-900 dark:text-white"
                >
                  <option value="">All states</option>
                  {stateFilterOptions.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">District</label>
                <select
                  value={districtFilter}
                  onChange={(e) => {
                    setDistrictFilter(e.target.value);
                    setSchoolFilter('');
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-zinc-900 dark:text-white"
                >
                  <option value="">All districts</option>
                  {districtFilterOptions.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">School</label>
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-zinc-900 dark:text-white"
                >
                  <option value="">All schools</option>
                  {schoolFilterOptions.map(id => (
                    <option key={id} value={id}>{schoolNameById[id] ? `${schoolNameById[id]} (${id})` : id}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

            {(() => {
              const coordinatorColumns: Column<User>[] = [
                { header: 'Coordinator Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-900 dark:text-slate-100' },
                { header: 'Email', accessor: 'email', sortKey: 'email', className: 'font-mono text-slate-500 dark:text-slate-400' },
                {
                  header: 'Role Tier',
                  accessor: (c) => (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      c.role === UserRole.SUPERADMIN ? 'bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900' : c.role === UserRole.ADMIN ? 'bg-indigo-105 text-indigo-850 dark:bg-indigo-950 dark:text-indigo-200' : c.role === UserRole.DISTRICT_ADMIN ? 'bg-emerald-105 text-emerald-850 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-105 text-amber-855 dark:bg-amber-950 dark:text-amber-200'
                    }`}>
                      {c.role}
                    </span>
                  )
                },
                {
                  header: 'Assigned Scope Nodes',
                  accessor: (c) => {
                    let nodeScope = '';
                    if (c.role === UserRole.SUPERADMIN) {
                      nodeScope = 'National (Global)';
                    } else if (c.role === UserRole.ADMIN) {
                      nodeScope = `State: ${c.stateCode || 'N/A'}`;
                    } else if (c.role === UserRole.DISTRICT_ADMIN) {
                      nodeScope = `State: ${c.stateCode || 'N/A'} / District: ${c.districtCode || 'N/A'}`;
                    } else if (c.role === UserRole.BLOCK_ADMIN) {
                      nodeScope = `State: ${c.stateCode || 'N/A'} / Dist: ${c.districtCode || 'N/A'} / Block: ${c.blockCode || 'N/A'}`;
                    } else if (c.role === UserRole.SCHOOL || c.role === UserRole.TEACHER) {
                      const sch = schools.find(s => s.id === c.schoolId);
                      if (sch) {
                        nodeScope = `State: ${sch.stateCode} / Dist: ${sch.districtCode} / Block: ${sch.blockCode} (${sch.name})`;
                      } else {
                        nodeScope = `School ID: ${c.schoolId || 'N/A'}`;
                      }
                    } else if (c.role === UserRole.VOLUNTEER) {
                      const firstSchId = c.assignedSchools?.[0];
                      const sch = firstSchId ? schools.find(s => s.id === firstSchId) : undefined;
                      if (sch) {
                        nodeScope = `State: ${sch.stateCode} / Dist: ${sch.districtCode} / Block: ${sch.blockCode} (${sch.name})`;
                      } else if (c.assignedSchools && c.assignedSchools.length > 0) {
                        nodeScope = `Schools: ${c.assignedSchools.join(', ')}`;
                      } else {
                        nodeScope = 'No schools assigned';
                      }
                    } else {
                      nodeScope = `State: ${c.stateCode || 'N/A'} / Dist: ${c.districtCode || 'N/A'} / Block: ${c.blockCode || 'N/A'}`;
                    }
                    return <span className="font-medium text-slate-700 dark:text-slate-200">{nodeScope}</span>;
                  }
                }
              ];
              return (
                <Table data={filteredCoordinators} columns={coordinatorColumns} searchPlaceholder="Search coordinators..." searchKey="name" />
              );
            })()}
          </div>

        </div>
      )}

      {activeTab === 'analytics' && (
        <RegionalAnalyticsView token={token} user={user} />
      )}

      {activeTab === 'intervention' && (
        <QuestionInterventionPanel />
      )}

      {activeTab === 'curriculum' && (
        <CurriculumLevelsPanel />
      )}

      {activeTab === 'qreview' && (
        <QuestionReviewPanel />
      )}
    </div>
  );
};
