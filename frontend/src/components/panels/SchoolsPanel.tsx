// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 5).
import React, { useState } from 'react';
import { School } from '../../types';
import { STATE_NAMES, DISTRICT_NAMES, BLOCK_NAMES } from '../../constants';

export const SchoolsPanel: React.FC<{ schools: School[] }> = ({ schools }) => {
  const [stateFilter, setStateFilter] = useState('all');
  const [distFilter, setDistFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');

  const filteredSchools = schools.filter(s => {
    if (stateFilter !== 'all' && s.stateCode !== stateFilter) return false;
    if (distFilter !== 'all' && s.districtCode !== distFilter) return false;
    if (blockFilter !== 'all' && s.blockCode !== blockFilter) return false;
    return true;
  });

    const uniqueStateCodes = Array.from(new Set(schools.map(s => s.stateCode))) as string[];
    const stateOpts = uniqueStateCodes.sort().map(c => ({ code: c, name: STATE_NAMES[c] || c }));
    const filteredByState = schools.filter(s => stateFilter === 'all' || s.stateCode === stateFilter);
    const uniqueDistCodes = Array.from(new Set(filteredByState.map(s => s.districtCode))) as string[];
    const distOpts = uniqueDistCodes.sort().map(c => ({ code: c, name: DISTRICT_NAMES[c] || c }));
    const filteredByDist = filteredByState.filter(s => distFilter === 'all' || s.districtCode === distFilter);
    const uniqueBlockCodes = Array.from(new Set(filteredByDist.map(s => s.blockCode))) as string[];
    const blockOpts = uniqueBlockCodes.sort().map(c => ({ code: c, name: BLOCK_NAMES[c] || c }));
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">State</label><select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setDistFilter('all'); setBlockFilter('all'); }} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[180px]">{stateOpts.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}<option value="all">All States</option></select></div>
          <div><label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">District</label><select value={distFilter} onChange={e => { setDistFilter(e.target.value); setBlockFilter('all'); }} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[180px]"><option value="all">All Districts</option>{distOpts.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}</select></div>
          <div><label className="block text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Block</label><select value={blockFilter} onChange={e => setBlockFilter(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-w-[180px]"><option value="all">All Blocks</option>{blockOpts.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}</select></div>
          <div className="text-xs text-slate-400 dark:text-slate-500 pb-1">Showing {filteredSchools.length} of {schools.length} schools</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredSchools.map(s => (
          <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex justify-between"><h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.name}</h4><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.strength === 'high' ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{s.strength}</span></div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{STATE_NAMES[s.stateCode] || s.stateCode} &rsaquo; {DISTRICT_NAMES[s.districtCode] || s.districtCode} &rsaquo; {BLOCK_NAMES[s.blockCode] || s.blockCode}</div>
            <div className="flex gap-4 text-xs pt-1 border-t border-slate-100 dark:border-slate-700"><span>👨‍🏫 {s.teachersCount} teachers</span><span className={s.isAccessLocked ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>{s.isAccessLocked ? '🔒 Locked' : '🔓 Active'}</span></div>
          </div>
        ))}</div>
      </div>
    );
};
