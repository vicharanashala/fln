// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 6).
import React from 'react';
import { User } from '../../types';
import { PageHeader } from './PanelShared';
import { MapPin } from 'lucide-react';
import { DISTRICT_NAMES } from '../../constants';

export const BlocksPanel: React.FC<{ currentUser: User; getBlockStats: (districtCode: string) => any[] }> = ({ currentUser, getBlockStats }) => {
    const userDistrict = currentUser.districtCode || '';
    const districtBlocks = getBlockStats(userDistrict);
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Block Administration" desc="All blocks under your district jurisdiction" icon={<MapPin className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{districtBlocks.map(b => (
          <div key={b.code} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between"><span className="font-bold text-sm">{b.name}</span><span className="text-xs text-slate-400 dark:text-slate-500">Dist: {DISTRICT_NAMES[b.district] || b.district}</span></div>
            <div className="flex gap-4 text-xs"><span>🏫 {b.schools} schools</span><span>👨‍🎓 {b.students} students</span></div>
            <div><div className="flex justify-between text-[10px] mb-0.5"><span>Certification</span><span>{b.certifiedRate}%</span></div><div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${b.certifiedRate}%` }} /></div></div>
          </div>
        ))}</div>
      </div>
    );
};
