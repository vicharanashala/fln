/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Search, 
  Shield, 
  Filter, 
  ChevronDown, 
  Info, 
  CheckCircle,
  HelpCircle,
  Clock,
  MapPin,
  Check
} from 'lucide-react';
import { LogEntry, User, UserRole } from '../types';

interface LogbookPanelProps {
  currentUser: User;
  logs: LogEntry[];
}

const ROLE_RANKS: Record<UserRole, number> = {
  superadmin: 7,
  admin: 6,
  district_admin: 5,
  block_admin: 4,
  school: 3,
  teacher: 2,
  volunteer: 1
};

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin (National)',
  admin: 'State Admin',
  district_admin: 'District Admin',
  block_admin: 'Block Admin',
  school: 'School (Principal)',
  teacher: 'Teacher',
  volunteer: 'Volunteer'
};

const ROLE_COLOR_CLASSES: Record<UserRole, string> = {
  superadmin: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50',
  admin: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
  district_admin: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50',
  block_admin: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900/50',
  school: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
  teacher: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50',
  volunteer: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
};

export const LogbookPanel: React.FC<LogbookPanelProps> = ({ currentUser, logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');

  const userRank = useMemo(() => ROLE_RANKS[currentUser.role] || 1, [currentUser.role]);

  // Filter logs where log.level rank <= currentUser.role rank
  const accessibleLogs = useMemo(() => {
    return logs.filter(log => {
      const logRank = ROLE_RANKS[log.level] || 1;
      return logRank <= userRank;
    });
  }, [logs, userRank]);

  // List of roles that are lower or equal to currentUser's rank, for the filter dropdown
  const filterableRoles = useMemo(() => {
    return Object.keys(ROLE_RANKS).filter(role => {
      return ROLE_RANKS[role as UserRole] <= userRank;
    }) as UserRole[];
  }, [userRank]);

  // Filtered and searched logs
  const finalLogs = useMemo(() => {
    return accessibleLogs.filter(log => {
      const matchesSearch = 
        log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.scope && log.scope.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRole = 
        selectedRoleFilter === 'all' || 
        log.level === selectedRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [accessibleLogs, searchTerm, selectedRoleFilter]);

  return (
    <div className="space-y-6">
      {/* Visual Identity Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white md:text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600 animate-pulse" />
            FLN System Logbook & Audit Trail
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time, cryptographically logged operational journals and academic verification records.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400">
          <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Access Level: {ROLE_LABELS[currentUser.role]}</span>
        </div>
      </div>

      {/* Hierarchy Info Box */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 dark:text-blue-400" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-blue-950 uppercase tracking-wide dark:text-blue-300">
              Role-Based Logbook Visibility Policy
            </h4>
            <p className="text-xs text-blue-800/90 leading-relaxed dark:text-blue-400/90">
              Your logged-in role is <strong className="font-bold">{ROLE_LABELS[currentUser.role]}</strong>. Under standard FLN security directives, 
                <strong> only higher or equal level users can audit lower-level activities</strong>.
                You can monitor your level's actions and all activities logged by roles underneath you. Actions by superior hierarchies remain strictly confidential and redacted.
            </p>
            
            {/* Visual Steps of Hierarchy */}
            <div className="mt-4 pt-3 border-t border-blue-100 dark:border-blue-900/30">
              <span className="text-[10px] font-black uppercase text-blue-900 dark:text-blue-400 tracking-wider block mb-2">
                Hierarchical Audit Stream Visibility Flow
              </span>
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                {Object.entries(ROLE_RANKS)
                  .sort((a, b) => b[1] - a[1])
                  .map(([role, rank], idx) => {
                    const isAccessible = rank <= userRank;
                    const isSelf = role === currentUser.role;
                    return (
                      <React.Fragment key={role}>
                        {idx > 0 && <span className="text-gray-400 font-normal">→</span>}
                        <div className={`px-2 py-0.5 rounded-full border transition ${
                          isSelf 
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                            : isAccessible 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' 
                            : 'bg-gray-100 text-gray-400 border-gray-200 line-through dark:bg-gray-900 dark:text-gray-600 dark:border-gray-800'
                        }`}>
                          {ROLE_LABELS[role as UserRole].split(' ')[0]}
                        </div>
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls: Search & Role Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-gray-100 dark:bg-gray-900 dark:border-gray-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-2 text-xs text-gray-950 placeholder-gray-400 focus:border-indigo-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
            placeholder="Search logs by keyword, type, details, or school code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500 font-semibold">Filter by Level:</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-950 focus:border-indigo-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white font-bold"
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value)}
          >
            <option value="all">All Accessible Levels</option>
            {filterableRoles.map(role => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-[10px] font-extrabold uppercase text-slate-700 dark:bg-gray-950/40 dark:border-gray-800">
                <th className="px-6 py-3.5 text-primary-navy font-bold">Timestamp</th>
                <th className="px-6 py-3.5 text-primary-navy font-bold">Log Type</th>
                <th className="px-6 py-3.5 text-primary-navy font-bold">Initiated Level</th>
                <th className="px-6 py-3.5 text-primary-navy font-bold">Scope / Code</th>
                <th className="px-6 py-3.5 text-primary-navy font-bold">Operation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {finalLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/70 transition-colors dark:hover:bg-gray-950/40">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px]">{log.time}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                      {log.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${ROLE_COLOR_CLASSES[log.level]}`}>
                      {ROLE_LABELS[log.level]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-medium">
                    {log.scope ? (
                      <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-[11px] font-mono">
                        <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                        {log.scope}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">Global System</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {log.details}
                  </td>
                </tr>
              ))}
              {finalLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400 text-xs font-semibold">
                    No activities matching the active criteria were logged in this audit epoch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
