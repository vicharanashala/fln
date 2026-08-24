// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 6).
import React, { useState } from 'react';
import { User, School, Student } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { MapPin, School as SchoolIcon, Users, Award, ChevronDown } from 'lucide-react';

export const DistrictsPanel: React.FC<{
  currentUser: User;
  schools: School[];
  students: Student[];
  getDistrictStats: (stateCode: string) => any[];
}> = ({ currentUser, schools, students, getDistrictStats }) => {
  const [expandedDist, setExpandedDist] = useState<string | null>(null);

    const userState = currentUser.stateCode || 'PB';
    const stateDistricts = getDistrictStats(userState);
    const distSchools = expandedDist ? schools.filter(s => s.districtCode === expandedDist) : [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="State Districts" value={stateDistricts.length} subtext={`${userState} jurisdiction`} icon={MapPin} />
          <MetricCard title="Total Schools" value={stateDistricts.reduce((a, d) => a + d.schools, 0)} subtext="Registered facilities" icon={SchoolIcon} />
          <MetricCard title="Total Students" value={stateDistricts.reduce((a, d) => a + d.students, 0)} subtext="Across all districts" icon={Users} />
          <MetricCard title="Avg Certification" value={stateDistricts.length > 0 ? `${Math.round(stateDistricts.reduce((a, d) => a + d.certifiedRate, 0) / stateDistricts.length)}%` : '—'} subtext="State weighted average" icon={Award} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* District list */}
          <div className={`${expandedDist ? 'lg:col-span-1' : 'lg:col-span-3'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm`}>
            <PageHeader title="District Overview" desc={`${userState} — Performance metrics by district`} icon={<MapPin className="h-5 w-5" />} />
            <div className="space-y-2 mt-4">{stateDistricts.map(d => {
              const isExpanded = expandedDist === d.code;
              const schoolList = schools.filter(s => s.districtCode === d.code);
              const studentCount = schoolList.reduce((a, s) => a + (students.filter(st => st.schoolId === s.id).length), 0);
              return (
                <div key={d.code}>
                  <button onClick={() => setExpandedDist(isExpanded ? null : d.code)} className={`w-full flex items-center gap-4 p-3 border rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-all ${isExpanded ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-100 dark:border-slate-700'}`}>
                    <div className="w-16"><span className="font-bold text-sm">{d.code}</span><span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">({d.state})</span></div>
                    <div className="flex-1"><span className="text-sm font-semibold">{d.name}</span></div>
                    <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span><strong className="text-slate-800 dark:text-slate-100">{studentCount}</strong> students</span>
                      <span><strong className="text-slate-800 dark:text-slate-100">{schoolList.length}</strong> schools</span>
                    </div>
                    <div className="w-24"><div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.certifiedRate}%` }} /></div><div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right">{d.certifiedRate}% certified</div></div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              );
            })}</div>
          </div>

          {/* Schools in selected district */}
          {expandedDist && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schools in {expandedDist}</h3>
                  <button onClick={() => setExpandedDist(null)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-mono">Close</button>
                </div>
                <div className="grid grid-cols-1 gap-4">{distSchools.map(sch => {
                  const schStudents = students.filter(st => st.schoolId === sch.id);
                  const certified = schStudents.filter(st => st.currentLevel >= 5).length;
                  const avgLevel = schStudents.length > 0 ? Math.round(schStudents.reduce((a, st) => a + st.currentLevel, 0) / schStudents.length) : 0;
                  return (
                    <div key={sch.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-slate-400 dark:hover:border-slate-600 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">{sch.name}</h4>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{sch.id} · {sch.blockCode} · {sch.stateCode}/{sch.districtCode}</p>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sch.strength === 'high' ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{sch.strength}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="text-center"><div className="text-lg font-bold text-slate-900 dark:text-white">{schStudents.length}</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Students</div></div>
                        <div className="text-center"><div className="text-lg font-bold text-slate-900 dark:text-white">{sch.teachersCount}</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Teachers</div></div>
                        <div className="text-center"><div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{certified}</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Certified</div></div>
                        <div className="text-center"><div className="text-lg font-bold text-slate-900 dark:text-white">L{avgLevel}</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Avg Level</div></div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1"><span>Certification Rate</span><span>{schStudents.length > 0 ? Math.round(certified / schStudents.length * 100) : 0}%</span></div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${schStudents.length > 0 ? (certified / schStudents.length) * 100 : 0}%` }} /></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">{schStudents.map(st => (
                        <span key={st.id} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${st.levelHistory.length > 0 ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>{st.name.split(' ')[0]} L{st.currentLevel}</span>
                      ))}</div>
                    </div>
                  );
                })}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};
