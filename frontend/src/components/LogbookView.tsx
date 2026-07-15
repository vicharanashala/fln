import React, { useState, useEffect } from 'react';
import { LogEntry, UserRole, User, School } from '../types';
import { Download, Search, SlidersHorizontal } from 'lucide-react';

interface LogbookViewProps {
  token: string;
  user?: User | null;
}

export const LogbookView: React.FC<LogbookViewProps> = ({ token, user }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  
  // Filtering states
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedBlock, setSelectedBlock] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Fetch logbook entries
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logbook', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
      } catch (err) {
      console.error('Failed to fetch activity log:', err);
    }
  };

  // Fetch school list for geographical lookup
  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/schools');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSchools(data);
      }
    } catch (err) {
      console.error('Failed to fetch schools:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchSchools();
  }, [token]);

  // Set default locked locations according to User Role & credentials
  useEffect(() => {
    if (user) {
      if (user.role === UserRole.ADMIN) {
        setSelectedState(user.stateCode || 'all');
      } else if (user.role === UserRole.DISTRICT_ADMIN) {
        setSelectedState(user.stateCode || 'all');
        setSelectedDistrict(user.districtCode || 'all');
      } else if (user.role === UserRole.BLOCK_ADMIN) {
        setSelectedState(user.stateCode || 'all');
        setSelectedDistrict(user.districtCode || 'all');
        setSelectedBlock(user.blockCode || 'all');
      }
    }
  }, [user]);

  // Derived geographical options based on selections & roles
  const uniqueStates = Array.from(new Set(schools.map(s => s.stateCode))).filter(Boolean);
  
  const uniqueDistricts = Array.from(new Set(
    schools
      .filter(s => selectedState === 'all' || s.stateCode.toLowerCase() === selectedState.toLowerCase())
      .map(s => s.districtCode)
  )).filter(Boolean);

  const uniqueBlocks = Array.from(new Set(
    schools
      .filter(s => selectedState === 'all' || s.stateCode.toLowerCase() === selectedState.toLowerCase())
      .filter(s => selectedDistrict === 'all' || s.districtCode.toLowerCase() === selectedDistrict.toLowerCase())
      .map(s => s.blockCode)
  )).filter(Boolean);

  const filteredSchoolsList = schools
    .filter(s => selectedState === 'all' || s.stateCode.toLowerCase() === selectedState.toLowerCase())
    .filter(s => selectedDistrict === 'all' || s.districtCode.toLowerCase() === selectedDistrict.toLowerCase())
    .filter(s => selectedBlock === 'all' || s.blockCode.toLowerCase() === selectedBlock.toLowerCase());

  // Filter actual log list
  const filteredLogs = logs.filter(log => {
    // Lookup geographical data of school associated with this log
    const matchedSchool = schools.find(s => s.id === log.schoolId);
    
    const logState = matchedSchool ? matchedSchool.stateCode : 'National';
    const logDistrict = matchedSchool ? matchedSchool.districtCode : 'National';
    const logBlock = matchedSchool ? matchedSchool.blockCode : 'National';

    // Verify cascading dropdown matches
    const stateMatch = selectedState === 'all' || logState.toLowerCase() === selectedState.toLowerCase();
    const districtMatch = selectedDistrict === 'all' || logDistrict.toLowerCase() === selectedDistrict.toLowerCase();
    const blockMatch = selectedBlock === 'all' || logBlock.toLowerCase() === selectedBlock.toLowerCase();
    const schoolMatch = selectedSchool === 'all' || log.schoolId === selectedSchool;

    // Type filter
    const typeMatch = filterType === 'all' || log.activityType === filterType;

    // Search query match
    const searchMatch = search === '' || 
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.id.toLowerCase().includes(search.toLowerCase()) ||
      (log.schoolName && log.schoolName.toLowerCase().includes(search.toLowerCase()));

    return stateMatch && districtMatch && blockMatch && schoolMatch && typeMatch && searchMatch;
  });

  // Export to CSV function
  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;
    
    const headers = ['Timestamp', 'Log ID', 'User Email', 'User Role', 'Location School ID', 'Location School Name', 'Activity', 'Status', 'Details'];
    
    const rows = filteredLogs.map(l => [
      new Date(l.timestamp).toISOString(),
      l.id,
      l.userEmail,
      l.userRole,
      l.schoolId || 'National',
      l.schoolName || 'National Framework',
      l.activityType,
      l.status,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FLN_System_Logbook_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check locks for selectors based on user roles
  const isStateLocked = user && [UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(user.role);
  const isDistrictLocked = user && [UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(user.role);
  const isBlockLocked = user && [UserRole.BLOCK_ADMIN].includes(user.role);

  return (
    <div className="space-y-6" id="logbook-view">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">Immutable System Logbook & Audit Trail</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Real-time recording of and compliance tracking for active workspaces, downloads, and scoring pipelines.</p>
        </div>
        
        {/* Export Button */}
        <button
          onClick={exportToCSV}
          disabled={filteredLogs.length === 0}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium text-xs font-mono py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer w-fit self-start sm:self-center"
        >
          <Download className="w-4 h-4" /> Export Filtered CSV
        </button>
      </div>

      {/* Advanced Cascading Filter Panel */}
      <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-medium text-sm border-b border-zinc-100 dark:border-zinc-700 pb-3">
          <SlidersHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span>Regional Drill-Down & Scoped Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs font-sans">
          {/* 1. State Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">State Scope</label>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict('all');
                setSelectedBlock('all');
                setSelectedSchool('all');
              }}
              disabled={!!isStateLocked}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:bg-white dark:focus:bg-slate-800 outline-none disabled:opacity-70 disabled:bg-zinc-100 dark:disabled:bg-zinc-700 font-medium text-zinc-900 dark:text-white"
            >
              <option value="all">All States</option>
              {uniqueStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          {/* 2. District Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">District Scope</label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedBlock('all');
                setSelectedSchool('all');
              }}
              disabled={!!isDistrictLocked || (selectedState === 'all' && !isStateLocked)}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:bg-white dark:focus:bg-slate-800 outline-none disabled:opacity-70 disabled:bg-zinc-100 dark:disabled:bg-zinc-700 font-medium text-zinc-900 dark:text-white"
            >
              <option value="all">All Districts</option>
              {uniqueDistricts.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>

          {/* 3. Block Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Block Scope</label>
            <select
              value={selectedBlock}
              onChange={(e) => {
                setSelectedBlock(e.target.value);
                setSelectedSchool('all');
              }}
              disabled={!!isBlockLocked || (selectedDistrict === 'all' && !isDistrictLocked)}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:bg-white dark:focus:bg-slate-800 outline-none disabled:opacity-70 disabled:bg-zinc-100 dark:disabled:bg-zinc-700 font-medium text-zinc-900 dark:text-white"
            >
              <option value="all">All Blocks</option>
              {uniqueBlocks.map(block => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>
          </div>

          {/* 4. School Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">School Facility</label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:bg-white dark:focus:bg-slate-800 outline-none font-medium text-zinc-900 dark:text-white"
            >
              <option value="all">All School Facilities</option>
              {filteredSchoolsList.map(sch => (
                <option key={sch.id} value={sch.id}>{sch.name}</option>
              ))}
            </select>
          </div>

          {/* 5. Log Type Filter */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Activity Category</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:bg-white dark:focus:bg-slate-800 outline-none font-medium text-zinc-900 dark:text-white"
            >
              <option value="all">All Activities</option>
              <option value="download">Downloads</option>
              <option value="print">Prints</option>
              <option value="conduct">Assessment Conduct</option>
              <option value="scan">ICR Solution Scans</option>
              <option value="verify">Verification Checks</option>
              <option value="ticket">Feedback Ticket logs</option>
            </select>
          </div>
        </div>

        {/* Global search details */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, school name, activity description or log identifier..."
            className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-zinc-500 transition-colors bg-white dark:bg-slate-800 text-zinc-900 dark:text-white"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white/90 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-zinc-700/80 dark:bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/50">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Viewing {filteredLogs.length} matching audit logs
          </span>
        </div>
        
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-zinc-200/80 bg-zinc-50/95 text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-zinc-500 backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:text-zinc-400">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Log ID</th>
                <th className="p-4">Correspondent</th>
                <th className="p-4">Geographic Node</th>
                <th className="p-4">Activity</th>
                <th className="p-4">Status</th>
                <th className="p-4 w-96">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white text-sm text-zinc-700 dark:bg-slate-900 dark:text-zinc-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs font-sans text-zinc-400">
                    No activity records found with the active filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => {
                  const sMatch = schools.find(sch => sch.id === l.schoolId);
                  const nodeScope = sMatch ? `${sMatch.stateCode} / ${sMatch.districtCode} / ${sMatch.blockCode}` : 'National';
                  return (
                    <tr key={l.id} className="border-b border-zinc-100/80 odd:bg-white even:bg-zinc-50/70 transition-colors hover:bg-indigo-50/70 dark:border-zinc-800/70 dark:odd:bg-slate-900 dark:even:bg-zinc-900/70 dark:hover:bg-zinc-800/70">
                      <td className="p-4 whitespace-nowrap font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        {l.id}
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-semibold text-zinc-900 dark:text-white">{l.userEmail}</div>
                        <div className="mt-0.5 text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500">{l.userRole}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        <div className="font-medium text-zinc-800 dark:text-zinc-100">{l.schoolName || 'National Framework'}</div>
                        <div className="mt-0.5 text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500">{nodeScope}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-mono text-xs capitalize text-zinc-800 dark:text-zinc-100">
                          {l.activityType}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                          l.status === 'Success' ? 'border-green-200 bg-green-100 text-green-800' : l.status === 'Delayed' ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-red-200 bg-red-100 text-red-800'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {l.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
