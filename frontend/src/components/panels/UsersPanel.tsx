// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 5).
import React, { useState } from 'react';
import { PageHeader } from './PanelShared';
import { Users } from 'lucide-react';
import { STATE_NAMES, DISTRICT_NAMES, BLOCK_NAMES } from '../../constants';

export const UsersPanel: React.FC<{ usersList: any[] }> = ({ usersList }) => {
  const [userRoleFilter, setUserRoleFilter] = useState('superadmin');
  const [userSearch, setUserSearch] = useState('');

    const roleLabel = (r: string) => r === 'superadmin' ? 'Super Admin' : r === 'admin' ? 'State Admin' : r === 'district_admin' ? 'District Admin' : r === 'block_admin' ? 'Block Admin' : r === 'school' ? 'Principal' : r === 'teacher' ? 'Teacher' : r === 'volunteer' ? 'Volunteer' : r;
    const scopeLabel = (u: any) => u.stateCode ? [STATE_NAMES[u.stateCode] || u.stateCode, DISTRICT_NAMES[u.districtCode] || u.districtCode, BLOCK_NAMES[u.blockCode] || u.blockCode, u.schoolId].filter(Boolean).join(' › ') : 'National';

    const userDisplayName = (u: any) => {
      if (u.role === 'superadmin') return u.name;
      if (u.role === 'admin') return `${STATE_NAMES[u.stateCode] || u.stateCode} State Admin`;
      if (u.role === 'district_admin') return `${DISTRICT_NAMES[u.districtCode] || u.districtCode} District Admin`;
      if (u.role === 'block_admin') return `${BLOCK_NAMES[u.blockCode] || u.blockCode} Block Admin`;
      if (u.role === 'school') return `${u.name}`;
      if (u.role === 'teacher') return `${u.name}`;
      if (u.role === 'volunteer') return `${u.name}`;
      return u.name;
    };

    const roleOrder = ['superadmin', 'admin', 'district_admin', 'block_admin', 'school', 'teacher', 'volunteer'];
    const roleCounts = roleOrder.reduce((acc, r) => { acc[r] = usersList.filter((u: any) => u.role === r).length; return acc; }, {} as Record<string, number>);

    const filteredUsers = usersList.filter((u: any) => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
      if (userSearch) {
        const q = userSearch.toLowerCase();
        const name = userDisplayName(u).toLowerCase();
        const email = (u.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });

    const roleFilterLabel = (r: string) => {
      if (r === 'superadmin') return 'Super Admin';
      if (r === 'admin') return 'State Admin';
      if (r === 'district_admin') return 'District Admin';
      if (r === 'block_admin') return 'Block Admin';
      if (r === 'school') return 'Principal';
      if (r === 'teacher') return 'Teacher';
      if (r === 'volunteer') return 'Volunteer';
      return r;
    };
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="User Management" desc={`All registered users across the FLN system (${usersList.length} total)`} icon={<Users className="h-5 w-5" />} />
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Role</label>
            <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[160px]">
              <option value="all">All Roles</option>
              {roleOrder.filter(r => roleCounts[r] > 0).map(r => (
                <option key={r} value={r}>{roleFilterLabel(r)} ({roleCounts[r]})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Search</label>
            <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Name or email..." className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[200px]" />
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 pb-1">Showing {filteredUsers.length} of {usersList.length} users</div>
        </div>
        <div className="space-y-2">{filteredUsers.map((u: any) => (
          <div key={u.email} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
            <div><div className="font-medium text-sm">{userDisplayName(u)}</div><div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{u.email}</div></div>
            <div className="flex items-center gap-3"><span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{roleLabel(u.role)}</span><span className="text-xs text-slate-400 dark:text-slate-500">{scopeLabel(u)}</span><span className="text-[10px] font-mono font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">Active</span></div>
          </div>
        ))}</div>
      </div>
    );
};
