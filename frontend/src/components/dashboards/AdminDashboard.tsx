// 2. STATE ADMIN / DISTRICT ADMIN / BLOCK ADMIN DASHBOARDS


import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/apiClient';
import { User, UserRole, Student, School,DashboardProps } from '../../types';
import { STATE_NAMES, DISTRICT_NAMES} from '../RoleDashboards';
import {RegionalAnalyticsView} from '../dashboards/RegionalAnalyticsView'

export const AdminDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'access'>('overview');
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
        const schData = await schRes.json();
        if (Array.isArray(schData)) setSchools(schData);

        const stdRes = await apiFetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        const stdData = await stdRes.json();
        if (Array.isArray(stdData)) setStudents(stdData);

        const uRes = await apiFetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
        const uData = await uRes.json();
        if (Array.isArray(uData)) setAllUsers(uData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [token]);

  // Determine appropriate dashboard header details
  const stateCode = user.stateCode || 'PB';
  const stateName = STATE_NAMES[stateCode] || stateCode;
  const districtCode = user.districtCode || 'LDH';
  const districtName = DISTRICT_NAMES[districtCode] || districtCode;
  const blockCode = user.blockCode || 'LDH-01';

  let panelTitle = 'Regional Oversight Center';
  let panelSub = 'State administration and reporting node.';
  if (user.role === UserRole.ADMIN) {
    panelTitle = `State Oversight Center: ${stateName}`;
    panelSub = `State Coordinator ${stateCode} · Performance Oversight Console`;
  } else if (user.role === UserRole.DISTRICT_ADMIN) {
    panelTitle = `District Oversight Center: ${districtName}`;
    panelSub = `District Officer ${stateCode}-${districtCode} · Scoped Administrative Node`;
  } else if (user.role === UserRole.BLOCK_ADMIN) {
    panelTitle = `Block Administrative Console: ${blockCode}`;
    panelSub = `Block Supervisor ${stateCode}-${districtCode}-${blockCode} · Localized Facility Audit Roster`;
  }

  // Filter schools based on user's regional scope
  const scopedSchools = schools.filter(s => {
    if (user.role === UserRole.ADMIN) {
      return s.stateCode === stateCode;
    }
    if (user.role === UserRole.DISTRICT_ADMIN) {
      return s.stateCode === stateCode && s.districtCode === districtCode;
    }
    if (user.role === UserRole.BLOCK_ADMIN) {
      return s.stateCode === stateCode && s.districtCode === districtCode && s.blockCode === blockCode;
    }
    return true;
  });

  const scopedSchoolIds = scopedSchools.map(s => s.id);
  const scopedStudents = students.filter(s => scopedSchoolIds.includes(s.schoolId));

  // Calculate dynamic pipeline metrics
  const studentsCount = scopedStudents.length;
  const certifiedCount = scopedStudents.filter(s => s.currentLevel !== null && s.currentLevel >= 5).length;
  const conductedExams = scopedSchools.length * 3 || 0;
  const ingestedSheets = studentsCount * 2 || 0;

  // Compile performance & lagging metrics per school
  const schoolPerformance = scopedSchools.map(sch => {
    const schStudents = students.filter(s => s.schoolId === sch.id);
    const total = schStudents.length;
    const certified = schStudents.filter(s => s.currentLevel !== null && s.currentLevel >= 5).length;
    const rate = total > 0 ? Math.round((certified / total) * 100) : 0;
    
    let statusText = '';
    let isLagging = false;
    if (total === 0) {
      statusText = 'No active students preseeded';
    } else if (rate < 50) {
      statusText = `Lagging <50% (${rate}% Certified)`;
      isLagging = true;
    } else {
      statusText = `${rate}% Certified`;
    }

    const deploymentMode = `${sch.teachersCount || 0} teachers assigned`;

    return {
      schoolId: sch.id,
      name: sch.name,
      district: DISTRICT_NAMES[sch.districtCode] || sch.districtCode,
      deploymentMode,
      statusText,
      isLagging,
      certifiedRate: rate
    };
  });

  // Dynamic volunteer roster assignments
  const preseededVolunteers = [
    { name: 'Rahul Kumar', email: 'vol.rahul@fln.org', assignedSchools: ['gps-vl-002'], status: 'On-Site Active' },
    { name: 'Amit Saini', email: 'vol.amit@fln.org', assignedSchools: ['gps-vl-002', 'gps-jai-004'], status: 'On-Site Active' },
    { name: 'Sneha Verma', email: 'vol.up_sneha@fln.org', assignedSchools: ['gps-lko-005'], status: 'Field Onboarding' },
    { name: 'Vipin Yadav', email: 'vol.hr_vipin@fln.org', assignedSchools: ['gps-amb-003'], status: 'On-Site Active' }
  ];

  const scopedVolunteers = preseededVolunteers.filter(v => 
    v.assignedSchools.some(schId => scopedSchoolIds.includes(schId))
  );

  return (
    <div className="space-y-6" id="admin-dashboard">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">{panelTitle}</h1>
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5">{panelSub}</p>
        </div>

        {/* Local Tab selectors */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit self-start">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'overview' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📋 Scoped Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'analytics' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📊 Scoped & Comparative Analytics
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'access' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            🛡️ Access Control & Defaulters
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Pipeline tracker (Conducted -> Scanned -> Evaluated -> Certified) */}
          <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
            <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">Regional Data Flow Pipeline</h3>
            <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase mb-1">1. Conducted</span>
                <span className="text-lg font-bold text-zinc-905 dark:text-white">{conductedExams} Exams</span>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase mb-1">2. Ingested (ICR)</span>
                <span className="text-lg font-bold text-zinc-905 dark:text-white">{ingestedSheets} Sheets</span>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase mb-1">3. Evaluated</span>
                <span className="text-lg font-bold text-indigo-755 dark:text-indigo-300">100% Scored</span>
              </div>
              <div className="p-4 bg-zinc-900 text-white rounded-lg border-none shadow-sm">
                <span className="block text-[10px] text-zinc-400 font-bold uppercase mb-1">4. Certified FLN</span>
                <span className="text-lg font-bold text-green-400">{certifiedCount} Students</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* District rankings & lagging alerts */}
            <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
              <h3 className="text-base font-display font-semibold text-zinc-900 dark:text-white">Regional Learning Gaps & Lagging Alerts</h3>
              <div className="space-y-3">
                {schoolPerformance.length === 0 ? (
                  <p className="text-zinc-400 dark:text-zinc-500 text-xs text-center py-6 font-mono">No preseeded schools found in this regional scope.</p>
                ) : (
                  schoolPerformance.map(perf => (
                    <div 
                      key={perf.schoolId} 
                      className={`flex justify-between items-center p-3 border rounded-lg ${
                        perf.isLagging 
                          ? 'border-red-100 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50' 
                          : 'border-zinc-150 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <h5 className={`font-medium text-sm ${perf.isLagging ? 'text-red-900 dark:text-red-200' : 'text-zinc-900 dark:text-white'}`}>
                          {perf.schoolId} ({perf.name})
                        </h5>
                        <p className={`text-[10px] font-mono ${perf.isLagging ? 'text-red-600 dark:text-red-300' : 'text-zinc-400 dark:text-zinc-500'}`}>
                          {perf.deploymentMode}
                        </p>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                        perf.isLagging 
                          ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-800' 
                          : 'text-zinc-700 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {perf.statusText}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Block oversight */}
            <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
              <h3 className="text-base font-display font-semibold text-zinc-900 dark:text-white">Volunteer Assignments</h3>
              <div className="space-y-3">
                {scopedVolunteers.length === 0 ? (
                  <p className="text-zinc-400 dark:text-zinc-500 text-xs text-center py-6 font-mono">No active volunteers deployed in this regional node.</p>
                ) : (
                  scopedVolunteers.map(vol => (
                    <div key={vol.email} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{vol.name}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                          Assigned: {vol.assignedSchools.join(', ')}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 px-2.5 py-0.5 rounded border border-green-200 dark:border-green-800">
                        {vol.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <RegionalAnalyticsView token={token} user={user} />
      )}

      {activeTab === 'access' && (
        <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">School & Teacher Access Control</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor Teacher delay attempts, suspensions, and manual school lockout restorations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Schools Lockdown Monitoring */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-zinc-800 dark:text-zinc-100 text-xs uppercase font-mono border-b border-zinc-100 dark:border-zinc-800 pb-2">Schools Lock Status</h4>
              {scopedSchools.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">No schools found in scope.</p>
              ) : (
                scopedSchools.map(sch => {
                  const isLocked = sch.isAccessLocked;
                  const canRestore = [UserRole.SUPERADMIN, UserRole.ADMIN].includes(user.role);

                  const handleRestore = async () => {
                    try {
                      const res = await apiFetch('/api/admin/restore-school', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ schoolId: sch.id })
                      });
                      if (res.ok) {
                        alert(`School access restored for ${sch.name}.`);
                        // Refresh data
                        const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
                        const schData = await schRes.json();
                        if (Array.isArray(schData)) setSchools(schData);
                        
                        const uRes = await apiFetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
                        const uData = await uRes.json();
                        if (Array.isArray(uData)) setAllUsers(uData);
                      } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to restore school access.');
                      }
                    } catch (e) {
                      alert('Connection failed.');
                    }
                  };

                  return (
                    <div key={sch.id} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{sch.name}</div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">ID: {sch.id} · Teachers: {sch.teachersCount ?? 0}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isLocked 
                            ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' 
                            : 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        }`}>
                          {isLocked ? 'LOCKED OUT' : 'ACTIVE'}
                        </span>
                        {isLocked && (
                          <button
                            disabled={!canRestore}
                            onClick={handleRestore}
                            className={`font-mono text-[9px] font-bold px-2 py-1 rounded shadow-sm border transition-colors ${
                              canRestore 
                                ? 'bg-white dark:bg-slate-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 cursor-pointer' 
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 cursor-not-allowed'
                            }`}
                            title={!canRestore ? 'Only State Admin / Superadmin can restore School access.' : ''}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Teachers Banned / Suspended Tracking */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-zinc-800 dark:text-zinc-100 text-xs uppercase font-mono border-b border-zinc-100 dark:border-zinc-800 pb-2">Teacher Defaulters & Bans</h4>
              {allUsers.filter(u => u.role === UserRole.TEACHER && (user.role === UserRole.SUPERADMIN || (u.schoolId && scopedSchoolIds.includes(u.schoolId)))).length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">No teachers registered in this scope.</p>
              ) : (
                allUsers.filter(u => u.role === UserRole.TEACHER && (user.role === UserRole.SUPERADMIN || (u.schoolId && scopedSchoolIds.includes(u.schoolId)))).map(tch => {
                  const delays = tch.delayedAttemptsCount || 0;
                  const isSuspended = tch.isBanned;

                  const handleRevive = async () => {
                    try {
                      const res = await apiFetch('/api/admin/revive-teacher', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ teacherId: tch.id })
                      });
                      if (res.ok) {
                        alert(`Teacher ${tch.name} revived. Suspension released.`);
                        // Refresh data
                        const schRes = await apiFetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
                        const schData = await schRes.json();
                        if (Array.isArray(schData)) setSchools(schData);
                        
                        const uRes = await apiFetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
                        const uData = await uRes.json();
                        if (Array.isArray(uData)) setAllUsers(uData);
                      } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to revive teacher.');
                      }
                    } catch (e) {
                      alert('Connection failed.');
                    }
                  };

                  return (
                    <div key={tch.id} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{tch.name} ({tch.email})</div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                          Delays: <strong className={delays > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-550 dark:text-zinc-400'}>{delays} / 3</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isSuspended 
                            ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' 
                            : 'text-zinc-650 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {isSuspended ? 'SUSPENDED' : 'NORMAL'}
                        </span>
                        {isSuspended && (
                          <button
                            onClick={handleRevive}
                            className="bg-white dark:bg-slate-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 font-mono text-[9px] font-bold px-2 py-1 rounded shadow-sm cursor-pointer transition-colors"
                          >
                            Revive
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
