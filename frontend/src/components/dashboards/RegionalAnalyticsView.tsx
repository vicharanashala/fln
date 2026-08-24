// ==========================================
// GEOGRAPHICAL COMPARATIVE ANALYTICS (SHARED VIEW)
// ==========================================
//important imports as needed
//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/apiClient';
import { User, UserRole } from '../../types';

export const RegionalAnalyticsView: React.FC<{ token: string; user: User }> = ({ token, user }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Scopes
  const [stateCode, setStateCode] = useState(user.stateCode || 'PB');
  const [districtCode, setDistrictCode] = useState(user.districtCode || 'LDH');
  const [blockCode, setBlockCode] = useState(user.blockCode || 'LDH-01');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const q = `stateCode=${stateCode}&districtCode=${districtCode}&blockCode=${blockCode}`;
      const res = await apiFetch(`/api/analytics?${q}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token, stateCode, districtCode, blockCode, user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16" id="analytics-loader">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 font-mono">Calculating live statistics...</span>
      </div>
    );
  }

  // Determine active level comparison
  let activeLabel = 'National';
  let activeMetrics = data?.national;
  
  if (user.role === UserRole.SUPERADMIN) {
    activeLabel = blockCode ? `Block: ${blockCode}` : districtCode ? `District: ${districtCode}` : stateCode ? `State: ${stateCode}` : 'National';
    activeMetrics = blockCode && data?.block ? data.block : districtCode && data?.district ? data.district : stateCode && data?.state ? data.state : data?.national;
  } else if (user.role === UserRole.ADMIN) {
    activeLabel = `State Admin`;
    activeMetrics = data?.state;
  } else if (user.role === UserRole.DISTRICT_ADMIN) {
    activeLabel = `District Admin`;
    activeMetrics = data?.district;
  } else if (user.role === UserRole.BLOCK_ADMIN) {
    activeLabel = `Block Admin`;
    activeMetrics = data?.block;
  }

  return (
    <div className="space-y-6" id="geographical-analytics">
      {/* Scope Controls for Superadmin */}
      {user.role === UserRole.SUPERADMIN && (
        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end text-xs font-sans">
          <div className="flex-grow">
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Filter State</label>
            <input 
              type="text" 
              value={stateCode} 
              onChange={e => {
                setStateCode(e.target.value.toUpperCase());
                setDistrictCode('');
                setBlockCode('');
              }}
              placeholder="e.g. PB"
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none font-medium text-zinc-800 dark:text-zinc-100 focus:border-zinc-400"
            />
          </div>
          <div className="flex-grow">
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Filter District</label>
            <input 
              type="text" 
              value={districtCode} 
              onChange={e => {
                setDistrictCode(e.target.value.toUpperCase());
                setBlockCode('');
              }}
              placeholder="e.g. LDH"
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none font-medium text-zinc-800 dark:text-zinc-100 focus:border-zinc-400"
            />
          </div>
          <div className="flex-grow">
            <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Filter Block</label>
            <input 
              type="text" 
              value={blockCode} 
              onChange={e => setBlockCode(e.target.value.toUpperCase())}
              placeholder="e.g. LDH-01"
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none font-medium text-zinc-800 dark:text-zinc-100 focus:border-zinc-400"
            />
          </div>
          <button 
            onClick={fetchAnalytics}
            className="bg-zinc-900 text-white hover:bg-zinc-800 font-medium font-mono text-xs py-3 px-5 rounded-lg cursor-pointer shadow-sm transition-colors"
          >
            Refilter Metrics
          </button>
        </div>
      )}

      {/* Side-by-Side Comparison layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* National Benchmark (Visible to All) */}
        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h4 className="font-display font-bold text-zinc-900 dark:text-white text-base flex items-center gap-2">
                <span>🌐 National Benchmark</span>
              </h4>
              <p className="text-zinc-400 dark:text-zinc-500 text-[11px] mt-0.5">Immutable global standards compiled as universal framework baseline.</p>
            </div>
            <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 shadow-sm">
              Benchmark
            </span>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-bold uppercase block">Average FLN Level</span>
              <span className="block text-2xl font-display font-extrabold text-zinc-900 dark:text-white mt-1">Level {data?.national?.avgLevel}</span>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-bold uppercase block">Certification Rate</span>
              <span className="block text-2xl font-display font-extrabold text-zinc-900 dark:text-white mt-1">{data?.national?.certificationRate}%</span>
            </div>
          </div>

          {/* Topic Mastery progress */}
          <div className="space-y-4 pt-2">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Topic Mastery Scores</h5>
            {data?.national?.topicMastery && Object.entries(data.national.topicMastery).map(([topic, val]: any) => (
              <div key={topic} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-600 dark:text-zinc-300">{topic}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{val}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-2">
                  <div className="bg-zinc-500 h-2 rounded-full transition-all" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Assigned Scope */}
        <div className="bg-zinc-900 text-white rounded-xl p-6 shadow-md space-y-6 border-none">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h4 className="font-display font-bold text-zinc-100 text-base">📍 Scope: {activeLabel}</h4>
              <p className="text-zinc-400 text-[11px] mt-0.5">Real-time local metrics calculated dynamically from active rosters.</p>
            </div>
            <span className="px-2.5 py-1 bg-green-950/40 text-green-400 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-green-800/30">
              Live Scoped
            </span>
          </div>

          {activeMetrics ? (
            <>
              {/* Cards */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-zinc-800/80 border border-zinc-700/50 rounded-lg shadow-sm">
                  <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase block">Average FLN Level</span>
                  <span className="block text-2xl font-display font-extrabold text-white mt-1">Level {activeMetrics.avgLevel}</span>
                </div>
                <div className="p-4 bg-zinc-800/80 border border-zinc-700/50 rounded-lg shadow-sm">
                  <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase block">Certification Rate</span>
                  <span className="block text-2xl font-display font-extrabold text-green-400 mt-1">{activeMetrics.certificationRate}%</span>
                </div>
              </div>

              {/* Topic Mastery progress */}
              <div className="space-y-4 pt-2">
                <h5 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">Topic Mastery Scores</h5>
                {activeMetrics.topicMastery && Object.entries(activeMetrics.topicMastery).map(([topic, val]: any) => (
                  <div key={topic} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-300">{topic}</span>
                      <span className="font-semibold text-white">{val}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex justify-center items-center py-20 text-zinc-400 text-xs">
              No live evaluation records registered for active scopes.
            </div>
          )}
        </div>

      </div>

      {/* Dynamic Visual Charts & Insights */}
      {activeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm" id="analytics-charts-panel">
          
          {/* Donut Pie Chart for Certification Rate */}
          <div className="flex flex-col items-center justify-center p-5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/50" id="certification-donut-chart">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Certification Rate (Pie / Donut Chart)</h5>
            <div className="relative flex items-center justify-center">
              <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
                {/* Background track */}
                <circle cx="90" cy="90" r="70" fill="transparent" stroke="#f4f4f5" strokeWidth="16" />
                {/* Certified segment */}
                <circle cx="90" cy="90" r="70" fill="transparent" stroke="#10b981" strokeWidth="16"
                        strokeDasharray={439.8}
                        strokeDashoffset={439.8 - (439.8 * (activeMetrics.certificationRate || 0)) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out" />
              </svg>
              {/* Inner absolute content */}
              <div className="absolute text-center">
                <span className="block text-3xl font-display font-black text-zinc-900 dark:text-white leading-none">{activeMetrics.certificationRate}%</span>
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase font-bold tracking-widest mt-1.5 inline-block">Certified</span>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex gap-6 mt-6 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>
                <span className="text-zinc-700 dark:text-zinc-200">Certified (L5-L6): {activeMetrics.certificationRate || 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-600 block"></span>
                <span className="text-zinc-505 dark:text-zinc-400">Developing (L1-L4): {100 - (activeMetrics.certificationRate || 0)}%</span>
              </div>
            </div>
          </div>

          {/* Bar Graph for FLN Level Distribution */}
          <div className="flex flex-col justify-between p-5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/50" id="level-bar-chart">
            <div>
              <h5 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 text-center md:text-left">Student FLN Level Distribution (Bar Graph)</h5>
              <p className="text-[11px] text-zinc-505 dark:text-zinc-400 text-center md:text-left mb-6 leading-relaxed">
                Aggregated cohort size representing count profiles across foundational literacy & numeracy levels.
              </p>
            </div>
            
            {/* Visual Bars container */}
            <div className="flex items-end justify-between gap-3 h-48 px-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
              {Object.entries(activeMetrics.levelDistribution || { "Level 1": 0, "Level 2": 0, "Level 3": 0, "Level 4": 0, "Level 5": 0, "Level 6": 0 }).map(([level, val]: any) => {
                const count = Number(val);
                const maxLevelVal = Math.max(...Object.values(activeMetrics.levelDistribution || {}) as number[], 1);
                const percentHeight = (count / maxLevelVal) * 100;
                return (
                  <div key={level} className="flex-grow flex flex-col items-center group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow">
                      {count} student{count !== 1 ? 's' : ''}
                    </div>
                    {/* Bar graphic */}
                    <div className="w-full bg-zinc-200 dark:bg-zinc-600 rounded-t-lg relative overflow-hidden transition-all duration-500" style={{ height: `${percentHeight}%`, minHeight: count > 0 ? '12px' : '4px' }}>
                      <div className="absolute inset-0 bg-zinc-950 group-hover:bg-zinc-700 transition-colors duration-200 rounded-t-lg" />
                    </div>
                    {/* Label */}
                    <span className="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 mt-2 text-center whitespace-nowrap">{level.replace('Level ', 'L')}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Total Indicator */}
            <div className="text-center md:text-right mt-3">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                Roster segment: <strong className="text-zinc-800 dark:text-zinc-100">{(Object.values(activeMetrics.levelDistribution || {}).reduce((a: any, b: any) => a + b, 0) as number)} student profiles</strong>
              </span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
