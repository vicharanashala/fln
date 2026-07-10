import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, ClassGroup, School, LogEntry, Ticket } from '../types';
import { BulkDiagnosticWorkflow } from './BulkDiagnosticWorkflow';
import { WorksheetWorkflow } from './WorksheetWorkflow';
import { LogbookView } from './LogbookView';
import { TicketSubmission } from './TicketSubmission';
import { IcrScanner } from './IcrScanner';
import { Users, Award, BarChart3, FileText, School as SchoolIcon } from 'lucide-react';
import { Table, Column } from './Table';
import { MetricCard } from './Card';
import { Input, Select, Textarea } from './Form';


export const FLN_LEVELS_LIST = [
  { id: 1, class: "Preschool 1", name: "Quantity Comparison", strand: "Number Sense" },
  { id: 2, class: "Preschool 1", name: "Odd One Out", strand: "Number Sense" },
  { id: 3, class: "Preschool 1", name: "Matching + Tracing Lines", strand: "Shapes" },
  { id: 4, class: "Preschool 2", name: "Numbers 1-10", strand: "Number Sense" },
  { id: 5, class: "Preschool 2", name: "Finger Gesture Counting", strand: "Number Sense" },
  { id: 6, class: "Preschool 2", name: "After, Between, Before", strand: "Number Sense" },
  { id: 7, class: "Preschool 3", name: "Addition through objects", strand: "Number Operations" },
  { id: 8, class: "Preschool 3", name: "Subtraction(1-10)", strand: "Number Operations" },
  { id: 9, class: "Preschool 3", name: "Pattern Recognition+Draw by Tracing", strand: "Patterns" },
  { id: 10, class: "Preschool 3", name: "Comparison â€“ Numeral", strand: "Number Sense" },
  { id: 11, class: "Review", name: "Review Assessment", strand: "Review" },
  { id: 12, class: "Class 1", name: "Tens and Ones", strand: "Number Sense" },
  { id: 13, class: "Class 1", name: "Numbers 11â€“30", strand: "Number Sense" },
  { id: 14, class: "Class 1", name: "Counting + Fun Trace", strand: "Number Sense" },
  { id: 15, class: "Class 1", name: "After, Between & Before", strand: "Number Sense" },
  { id: 16, class: "Class 1", name: "Addition (1-30)", strand: "Number Operations" },
  { id: 17, class: "Class 1", name: "Subtraction (1-30)", strand: "Number Operations" },
  { id: 18, class: "Class 1", name: "Ordering (1-30)", strand: "Number Sense" },
  { id: 19, class: "Class 1", name: "Numering 31-50", strand: "Number Sense" },
  { id: 20, class: "Class 1", name: "Skip Counting in 2s/3s", strand: "Number Sense" },
  { id: 21, class: "Class 1", name: "Comparison (1-50)", strand: "Number Sense" },
  { id: 22, class: "Class 1", name: "Ordering (1-50)", strand: "Number Sense" },
  { id: 23, class: "Review", name: "Review Assessment", strand: "Review" },
  { id: 24, class: "Class 2", name: "Numbers 51-100", strand: "Number Sense" },
  { id: 25, class: "Class 2", name: "Place Value (Tens & Ones)", strand: "Number Sense" },
  { id: 26, class: "Class 2", name: "Carry Addition", strand: "Number Operations" },
  { id: 27, class: "Class 2", name: "Borrow Subtraction", strand: "Number Operations" },
  { id: 28, class: "Class 2", name: "Comparison (Greater Than, Less Than, Equal)", strand: "Number Sense" },
  { id: 29, class: "Class 2", name: "Ordering (Ascending & Descending)", strand: "Number Sense" },
  { id: 30, class: "Class 2", name: "Data Handling (Tally Marks)", strand: "Data Handling" },
  { id: 31, class: "Class 2", name: "Time", strand: "Calendar & Time" },
  { id: 32, class: "Class 2", name: "Ordinal Positions (1stâ€“10th)", strand: "Number Sense" },
  { id: 33, class: "Class 2", name: "Multiplication (Repeated Addition)", strand: "Number Operations" },
  { id: 34, class: "Class 2", name: "Measurement (Non-Standard & Standard)", strand: "Measurement" },
  { id: 35, class: "Review", name: "Review Assessment", strand: "Review" },
  { id: 36, class: "Class 3", name: "Numbers 101â€“1000 (Place Value)", strand: "Number Sense" },
  { id: 37, class: "Class 3", name: "Comparison (Greater Than, Less Than, Equal)", strand: "Number Sense" },
  { id: 38, class: "Class 3", name: "Ordering (Ascending & Descending)", strand: "Number Sense" },
  { id: 39, class: "Class 3", name: "Addition (Up to 1000)", strand: "Number Operations" },
  { id: 40, class: "Class 3", name: "Subtraction (Up to 1000)", strand: "Number Operations" },
  { id: 41, class: "Class 3", name: "Multiplication (Tables 2â€“10)", strand: "Number Operations" },
  { id: 42, class: "Class 3", name: "Division (Introduction)", strand: "Number Operations" },
  { id: 43, class: "Class 3", name: "Standard Measurement & Simple Conversions", strand: "Measurement" },
  { id: 44, class: "Class 3", name: "Time & Calendar", strand: "Calendar & Time" },
  { id: 45, class: "Class 3", name: "Fractions", strand: "Fractions" },
  { id: 46, class: "Class 3", name: "Money", strand: "Money" },
  { id: 47, class: "Class 3", name: "Data Handling", strand: "Data Handling" },
  { id: 48, class: "Review", name: "Foundation Mastery Assessment", strand: "Review" },
  { id: 49, class: "Class 4", name: "Numbers up to 10,000", strand: "Number Sense" },
  { id: 50, class: "Class 4", name: "Advanced Multiplication", strand: "Number Operations" },
  { id: 51, class: "Class 4", name: "Advanced Division", strand: "Number Operations" },
  { id: 52, class: "Class 4", name: "Maps & Directions", strand: "Shapes" },
  { id: 53, class: "Class 4", name: "Factors & Multiples", strand: "Number Operations" },
  { id: 54, class: "Class 4", name: "Fraction Operations", strand: "Fractions" },
  { id: 55, class: "Class 4", name: "Decimals (Introduction)", strand: "Number Sense" },
  { id: 56, class: "Class 4", name: "Area & Perimeter", strand: "Measurement" },
  { id: 57, class: "Class 4", name: "Angles", strand: "Measurement" },
  { id: 58, class: "Class 4", name: "Symmetry & Reflection", strand: "Shapes" },
  { id: 59, class: "Review", name: "Advanced Mastery Assessment", strand: "Review" }
];

export const FLNLevelReferenceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');

  if (!isOpen) return null;

  const classesList = ['All', 'Preschool 1', 'Preschool 2', 'Preschool 3', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Review'];

  const filtered = FLN_LEVELS_LIST.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.strand.toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClass === 'All' || l.class === selectedClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-zinc-200">
        <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-display font-semibold text-zinc-900">ðŸ“– FLN Levels Framework Reference</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Explore details of the 59 curriculum levels spanning Preschool 1 to Class 4</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-650 text-sm font-semibold border border-zinc-200 bg-white hover:bg-zinc-100 p-2 rounded-lg">Close</button>
        </div>

        <div className="p-6 border-b border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 uppercase mb-1">Search Level/Strand</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Addition, shapes, numbers..."
              className="w-full text-sm border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 uppercase mb-1">Filter by Class</label>
            <div className="flex flex-wrap gap-1">
              {classesList.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`text-[10px] font-mono font-semibold px-2 py-1.5 rounded border transition-colors ${
                    selectedClass === c ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <div key={l.id} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm hover:border-zinc-350 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                      Level {l.id}
                    </span>
                    <span className="text-[9px] font-mono font-semibold uppercase text-zinc-400">
                      {l.class}
                    </span>
                  </div>
                  <h4 className="font-display font-semibold text-zinc-900 text-sm mt-2">{l.name}</h4>
                </div>
                  <div className="mt-4 pt-2 border-t border-zinc-100 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                    <span>Strand: <strong className="text-zinc-700">{l.strand}</strong></span>
                  </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const STATE_NAMES: Record<string, string> = {
  'PB': 'Punjab',
  'HR': 'Haryana',
  'RJ': 'Rajasthan',
  'UP': 'Uttar Pradesh'
};

const DISTRICT_NAMES: Record<string, string> = {
  'LDH': 'Ludhiana',
  'MOG': 'Moga',
  'AMB': 'Ambala',
  'JAI': 'Jaipur',
  'LKO': 'Lucknow'
};

interface DashboardProps {
  user: User;
  token: string;
  onImpersonate?: (user: User) => void;
}

// ==========================================
// GEOGRAPHICAL COMPARATIVE ANALYTICS (SHARED VIEW)
// ==========================================
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
      const res = await fetch(`/api/analytics?${q}`, {
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
        <span className="ml-3 text-xs font-medium text-zinc-500 font-mono">Calculating live statistics...</span>
      </div>
    );
  }

  // Determine active level comparison
  let activeLabel = 'National';
  let activeMetrics = data?.national;
  
  if (user.role === UserRole.SUPERADMIN) {
    activeLabel = blockCode ? `Block: ${blockCode}` : districtCode ? `District: ${districtCode}` : stateCode ? `State: ${stateCode}` : 'National';
    activeMetrics = blockCode && data?.block ? data.block : districtCode && data?.district ? data.district : stateCode && data?.state ? data.state : data?.national;
  }

  return (
    <div className="space-y-6" id="geographical-analytics">
      {/* Scope Controls for Superadmin */}
      {user.role === UserRole.SUPERADMIN && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end text-xs font-sans">
          <div className="flex-grow">
            <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Filter State</label>
            <input 
              type="text" 
              value={stateCode} 
              onChange={e => {
                setStateCode(e.target.value.toUpperCase());
                setDistrictCode('');
                setBlockCode('');
              }}
              placeholder="e.g. PB"
              className="w-full border border-zinc-200 rounded-lg p-2.5 bg-white outline-none font-medium text-zinc-800 focus:border-zinc-400"
            />
          </div>
          <div className="flex-grow">
            <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Filter District</label>
            <input 
              type="text" 
              value={districtCode} 
              onChange={e => {
                setDistrictCode(e.target.value.toUpperCase());
                setBlockCode('');
              }}
              placeholder="e.g. LDH"
              className="w-full border border-zinc-200 rounded-lg p-2.5 bg-white outline-none font-medium text-zinc-800 focus:border-zinc-400"
            />
          </div>
          <div className="flex-grow">
            <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Filter Block</label>
            <input 
              type="text" 
              value={blockCode} 
              onChange={e => setBlockCode(e.target.value.toUpperCase())}
              placeholder="e.g. LDH-01"
              className="w-full border border-zinc-200 rounded-lg p-2.5 bg-white outline-none font-medium text-zinc-800 focus:border-zinc-400"
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
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h4 className="font-display font-bold text-zinc-900 text-base flex items-center gap-2">
                <span>National Benchmark</span>
              </h4>
              <p className="text-zinc-400 text-[11px] mt-0.5">Immutable global standards compiled as universal framework baseline.</p>
            </div>
            <span className="px-2.5 py-1 bg-zinc-100 text-zinc-800 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-zinc-200 shadow-sm">
              Benchmark
            </span>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg shadow-sm">
              <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase block">Average FLN Level</span>
              <span className="block text-2xl font-display font-extrabold text-zinc-900 mt-1">Level {data?.national?.avgLevel}</span>
            </div>
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg shadow-sm">
              <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase block">Certification Rate</span>
              <span className="block text-2xl font-display font-extrabold text-zinc-900 mt-1">{data?.national?.certificationRate}%</span>
            </div>
          </div>

          {/* Topic Mastery progress */}
          <div className="space-y-4 pt-2">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">Topic Mastery Scores</h5>
            {data?.national?.topicMastery && Object.entries(data.national.topicMastery).map(([topic, val]: any) => (
              <div key={topic} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-600">{topic}</span>
                  <span className="font-semibold text-zinc-900">{val}%</span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2">
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
              <h4 className="font-display font-bold text-zinc-100 text-base">Scope: {activeLabel}</h4>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-zinc-200 rounded-xl p-6 shadow-sm" id="analytics-charts-panel">
          
          {/* Donut Pie Chart for Certification Rate */}
          <div className="flex flex-col items-center justify-center p-5 border border-zinc-100 rounded-xl bg-zinc-50/50" id="certification-donut-chart">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">Certification Rate (Pie / Donut Chart)</h5>
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
                <span className="block text-3xl font-display font-black text-zinc-900 leading-none">{activeMetrics.certificationRate}%</span>
                <span className="text-[9px] text-zinc-500 font-mono uppercase font-bold tracking-widest mt-1.5 inline-block">Certified</span>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex gap-6 mt-6 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>
                <span className="text-zinc-700">Certified (L5-L6): {activeMetrics.certificationRate || 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-200 block"></span>
                <span className="text-zinc-505">Developing (L1-L4): {100 - (activeMetrics.certificationRate || 0)}%</span>
              </div>
            </div>
          </div>

          {/* Bar Graph for FLN Level Distribution */}
          <div className="flex flex-col justify-between p-5 border border-zinc-100 rounded-xl bg-zinc-50/50" id="level-bar-chart">
            <div>
              <h5 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-2 text-center md:text-left">Student FLN Level Distribution (Bar Graph)</h5>
              <p className="text-[11px] text-zinc-505 text-center md:text-left mb-6 leading-relaxed">
                Aggregated cohort size representing count profiles across foundational literacy & numeracy levels.
              </p>
            </div>
            
            {/* Visual Bars container */}
            <div className="flex items-end justify-between gap-3 h-48 px-2 border-b border-zinc-200 pb-2">
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
                    <div className="w-full bg-zinc-200 rounded-t-lg relative overflow-hidden transition-all duration-500" style={{ height: `${percentHeight}%`, minHeight: count > 0 ? '12px' : '4px' }}>
                      <div className="absolute inset-0 bg-zinc-950 group-hover:bg-zinc-700 transition-colors duration-200 rounded-t-lg" />
                    </div>
                    {/* Label */}
                    <span className="text-[10px] font-mono font-bold text-zinc-500 mt-2 text-center whitespace-nowrap">{level.replace('Level ', 'L')}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Total Indicator */}
            <div className="text-center md:text-right mt-3">
              <span className="text-[10px] text-zinc-500 font-mono">
                Roster segment: <strong className="text-zinc-800">{Object.values(activeMetrics.levelDistribution || {}).reduce((a: any, b: any) => a + b, 0)} student profiles</strong>
              </span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};


// ==========================================
// 1. SUPERADMIN (NATIONAL) DASHBOARD
// ==========================================
export const SuperadminDashboard: React.FC<DashboardProps> = ({ user, token, onImpersonate }) => {
  type Tab = 'overview' | 'teachers' | 'worksheets';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [worksheets, setWorksheets] = useState<any[]>([]);
  const [worksheetsLoading, setWorksheetsLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  // Overview data
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachersList, setTeachersList] = useState<User[]>([]);

  // Teacher registration state
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherClassId, setTeacherClassId] = useState('');
  const [teacherSchoolName, setTeacherSchoolName] = useState('');
  const [teacherCreateMsg, setTeacherCreateMsg] = useState('');
  const [teacherCreateError, setTeacherCreateError] = useState('');

  const fetchGlobalData = async () => {
    try {
      const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
      const schData = await schRes.json();
      if (Array.isArray(schData)) setSchools(schData);

      const stdRes = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);

      const tchRes = await fetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
      const tchData = await tchRes.json();
      if (Array.isArray(tchData)) setTeachersList(tchData.filter((u: User) => u.role === UserRole.TEACHER));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorksheets = async () => {
    setWorksheetsLoading(true);
    try {
      const res = await fetch('/api/worksheets', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setWorksheets(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWorksheetsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'worksheets') fetchWorksheets();
  }, [activeTab]);

  const handleUnlock = async (teacherEmail: string, teacherName?: string, cycle?: string) => {
    const defaultReason = teacherName ? `Accidental print — re-print approved for ${teacherName} (${cycle || 'worksheet'})` : '';
    const reason = window.prompt(
      `🔓 Confirm Re-Print Approval\n\nEnter a reason for unlocking this worksheet for re-printing:\n(Teacher: ${teacherName || 'Unknown'} — Cycle: ${cycle || 'Unknown'})`,
      defaultReason
    );
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      alert('A reason is required to approve re-printing.');
      return;
    }
    setUnlocking(`${teacherEmail}-${cycle}`);
    try {
      await fetch('/api/worksheets/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ teacherEmail, cycle, reason: reason.trim() })
      });
      fetchWorksheets();
    } catch (err) {
      console.error(err);
    } finally {
      setUnlocking(null);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherCreateMsg('');
    setTeacherCreateError('');
    if (!teacherName || !teacherEmail || !teacherClassId || !teacherSchoolName) {
      setTeacherCreateError('All fields are required.');
      return;
    }
    try {
      const res = await fetch('/api/admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: teacherName,
          email: teacherEmail,
          password: 'Teacher@123',
          role: UserRole.TEACHER,
          schoolName: teacherSchoolName,
          className: teacherClassId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTeacherCreateMsg(`Teacher "${teacherName}" created at "${teacherSchoolName}" and assigned to ${teacherClassId}.`);
        setTeacherName('');
        setTeacherEmail('');
        setTeacherClassId('');
        setTeacherSchoolName('');
        setTimeout(() => setTeacherCreateMsg(''), 5000);
      } else {
        setTeacherCreateError(data.error || 'Failed to create teacher.');
      }
    } catch {
      setTeacherCreateError('Network error.');
    }
  };

  const certifiedCount = students.filter(s => s.currentLevel >= 5).length;
  const certifiedPercent = students.length > 0 ? Math.round((certifiedCount / students.length) * 100) : 0;

  return (
    <div className="space-y-6" id="superadmin-dashboard">
      <div className="border-b border-zinc-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 tracking-tight">National Oversight Center</h1>
          <p className="text-zinc-505 text-sm mt-0.5">IIT Ropar / Vicharanashala Lab · Global Curriculum Master Controls</p>
        </div>

        {/* Dashboard Tabs Selector */}
        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 w-fit self-start">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'overview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'teachers' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            🧑‍🏫 Teachers
          </button>

          <button
            onClick={() => setActiveTab('worksheets')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'worksheets' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            📋 Worksheets
          </button>
        </div>

        {/* DB Reset for easy demo */}
        <button
          onClick={async () => {
            if (!window.confirm('Reset all database data to fresh seed state? This is irreversible.')) return;
            await fetch('/api/reset', { method: 'POST' });
            window.location.reload();
          }}
          className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          Reset Database
        </button>
      </div>

      {activeTab === 'overview' && (() => {
        const schoolColumns: Column<School>[] = [
          { header: 'School ID', accessor: 'id', sortKey: 'id', className: 'font-mono text-xs text-slate-500' },
          { header: 'School Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-800' },
          { header: 'State', accessor: 'stateCode', sortKey: 'stateCode', className: 'font-mono' },
          {
            header: 'Deployment',
            accessor: (s) => (
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                s.strength === 'high' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {s.strength === 'high' ? 'High-Strength' : 'Low-Strength'}
              </span>
            )
          },
          {
            header: 'Avg Level',
            accessor: () => <span className="font-mono font-bold text-emerald-600">Level 3.2</span>
          }
        ];

        return (
          <>
            {/* Analytics Card Deck */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard title="Total Schools Tracked" value={schools.length} subtext="● 100% Active" icon={SchoolIcon} />
              <MetricCard title="National Roster Count" value={students.length} subtext="Primary FLN candidates" icon={Users} />
              <MetricCard title="National FLN Score" value="82.4" subtext="Average assessment grade" icon={BarChart3} />
              <MetricCard title="FLN Certification Rate" value={`${certifiedPercent}%`} subtext={`${certifiedCount} students verified competent`} icon={Award} />
            </div>

            <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-4">
              <h3 className="text-lg font-display font-medium text-zinc-900">State / School Performance Table</h3>
              <Table data={schools} columns={schoolColumns} searchPlaceholder="Search schools by name..." searchKey="name" />
            </div>
          </>
        );
      })()}



      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="max-w-lg">
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h2 className="text-lg font-display font-semibold text-zinc-900 mb-4">🧑‍🏫 Register a New Teacher</h2>

              {teacherCreateError && (
                <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{teacherCreateError}</div>
              )}
              {teacherCreateMsg && (
                <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{teacherCreateMsg}</div>
              )}

              <form onSubmit={handleCreateTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={e => setTeacherEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. teacher@fln.org"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">School Name</label>
                  <input
                    type="text"
                    value={teacherSchoolName}
                    onChange={e => setTeacherSchoolName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. GPS Model Town"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Assign Class</label>
                  <select
                    value={teacherClassId}
                    onChange={e => setTeacherClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Class --</option>
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                    <option value="Class 4">Class 4</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create Teacher
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm">
            <h3 className="text-lg font-display font-medium text-zinc-900 mb-4">Registered Teachers</h3>
            {teachersList.length === 0 ? (
              <div className="text-sm text-zinc-500">No teachers found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Email</th>
                    <th className="text-right px-4 py-3 font-semibold text-zinc-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersList.map(t => (
                    <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-800 font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{t.email}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUnlock(t.email, t.name)}
                          disabled={unlocking === `${t.email}-undefined`}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        >
                          {unlocking === `${t.email}-undefined` ? 'Unlocking...' : '🔓 Unlock All Prints'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'worksheets' && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold text-zinc-900">📋 Worksheet Print Activity</h2>
          {worksheetsLoading ? (
            <div className="text-sm text-zinc-500">Loading worksheets...</div>
          ) : worksheets.length === 0 ? (
            <div className="text-sm text-zinc-500">No worksheets found.</div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Worksheet</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">School</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Teacher</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Cycle</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-700">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-zinc-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Build a map: key = teacherEmail|className|cycle
                    const agg: { [key: string]: any } = {};
                    worksheets.filter(ws => ws.cycle === 'Baseline').forEach(ws => {
                      const key = `${ws.generatedByEmail}|${ws.className}|${ws.cycle}`;
                      if (!agg[key]) {
                        agg[key] = {
                          ...ws,
                          printedCount: ws.printed ? 1 : 0,
                          total: 1,
                        };
                      } else {
                        agg[key].printedCount += ws.printed ? 1 : 0;
                        agg[key].total += 1;
                      }
                    });
                    const rows = Object.values(agg);
                    const teacherMap = teachersList.reduce((m, t) => {
                      m[t.email] = t.name;
                      return m;
                    }, {} as { [email: string]: string });
                    return rows.map((row: any) => {
                      const teacherName = teacherMap[row.generatedByEmail] || row.generatedByEmail;
                      const status = row.printedCount > 0 ? 'Printed' : 'Not Printed';
                      return (
                        <tr key={`${row.generatedByEmail}-${row.className}-${row.cycle}`} className="border-b border-zinc-100 hover:bg-zinc-50">
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.id}</td>
                          <td className="px-4 py-3 text-zinc-800">{row.schoolName}</td>
                          <td className="px-4 py-3 text-zinc-800">{teacherName}</td>
                          <td className="px-4 py-3 text-zinc-800">{row.cycle}</td>
                          <td className="px-4 py-3 text-zinc-800">{row.date}</td>
                          <td className="px-4 py-3">
                            {status === 'Printed' ? (
                              <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-semibold">Printed</span>
                            ) : (
                              <span className="text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded text-xs font-semibold">Not Printed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {status === 'Printed' ? (
                              <button
                                onClick={() => handleUnlock(row.generatedByEmail, teacherName, row.cycle)}
                                disabled={unlocking === `${row.generatedByEmail}-${row.cycle}`}
                                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                              >
                                {unlocking === `${row.generatedByEmail}-${row.cycle}` ? 'Unlocking...' : '🔓 Unlock Print'}
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};





// ==========================================
// 4. TEACHER DASHBOARD
// ==========================================
export const TeacherDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);

  // Modal / workflow triggers
  const [diagnosticStudent, setDiagnosticStudent] = useState<Student | null>(null);
  const [showWorksheetPortal, setShowWorksheetPortal] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [showLevelRef, setShowLevelRef] = useState(false);
  const [showIcrScanner, setShowIcrScanner] = useState(false);
  const [showBulkDiagnostic, setShowBulkDiagnostic] = useState(false);

  // Inline bulk generation state
  const [bulkJob, setBulkJob] = useState<{ jobId: string; total: number; completed: number; status: string; pdfUrl: string; downloadUrl: string | null; error: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Level-wise bulk generation state
  const [levelBulkProgress, setLevelBulkProgress] = useState<{ total: number; completed: number; errors: string[] } | null>(null);
  const [levelBulkLoading, setLevelBulkLoading] = useState(false);

  // New Student state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [cls, setCls] = useState('Class 2');
  const [sec, setSec] = useState('A');
  const [aadhar, setAadhar] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const [levelPdfLoading, setLevelPdfLoading] = useState(false);
  const [levelPdfError, setLevelPdfError] = useState('');

  const fetchTeacherData = async () => {
    try {
      const clsRes = await fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } });
      const clsData = await clsRes.json();
      if (Array.isArray(clsData)) {
        setClasses(clsData);
        if (clsData.length > 0) setActiveClass(clsData[0]);
      }

      const stdRes = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, [token]);

  // Poll bulk job progress
  useEffect(() => {
    if (!bulkJob || bulkJob.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnostic/bulk/${bulkJob.jobId}/progress`);
        if (res.ok) {
          const data = await res.json();
          setBulkJob(prev => prev ? { ...prev, completed: data.completed, status: data.status, pdfUrl: data.pdfUrl || prev.pdfUrl, downloadUrl: data.downloadUrl || prev.downloadUrl, error: data.error || '' } : prev);
          if (data.status !== 'running') clearInterval(interval);
        } else {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [bulkJob?.jobId, bulkJob?.status]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!name || !age || !aadhar) {
      setRegError('All fields are required.');
      return;
    }

    const schoolId = user.schoolId || (classes.length > 0 ? classes[0].schoolId : '');
    if (!schoolId) {
      setRegError('No school associated with this user.');
      return;
    }

    const finalClassGroup = activeClass ? activeClass.className : cls;
    const finalSection = activeClass ? activeClass.section : sec;

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          age,
          classGroup: finalClassGroup,
          section: finalSection,
          schoolId: schoolId,
          aadharNumber: aadhar
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRegSuccess(`Successfully registered ${name} in ${finalClassGroup} - ${finalSection}!`);
        setName('');
        setAge('');
        setAadhar('');
        fetchTeacherData();
        setTimeout(() => {
          setShowAddForm(false);
          setRegSuccess('');
        }, 3000);
      } else {
        setRegError(data.error || 'Failed to register student.');
      }
    } catch (err) {
      setRegError('Network error. Check connection settings.');
    }
  };

  if (showBulkDiagnostic) {
    return (
      <BulkDiagnosticWorkflow
        user={user}
        token={token}
        userRole={user.role}
        onBack={() => {
          setShowBulkDiagnostic(false);
          fetchTeacherData();
        }}
      />
    );
  }

  if (showIcrScanner) {
    return (
      <IcrScanner
        token={token}
        user={user}
        onBack={() => {
          setShowIcrScanner(false);
          fetchTeacherData();
        }}
      />
    );
  }

  // Filter students under selected active class
  const classStudents = activeClass ? students.filter(s => s.classGroup === activeClass.className && s.section === activeClass.section) : [];

  if (showWorksheetPortal) {
    const effectiveClass = activeClass || (classes.length > 0 ? classes[0] : null);
    if (effectiveClass) {
      const effectiveStudents = students.filter(
        s => s.classGroup === effectiveClass.className && s.section === effectiveClass.section
      );
      return (
        <WorksheetWorkflow
          classGroup={effectiveClass}
          students={effectiveStudents}
          token={token}
          userRole={user.role}
          onBack={() => {
            setShowWorksheetPortal(false);
            fetchTeacherData();
          }}
        />
      );
    } else {
      return (
        <div className="p-8 max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl shadow-sm text-center space-y-4 my-12" id="no-classes-fallback">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-zinc-950 text-base">No Classes Found</h3>
          <p className="text-sm text-zinc-500">You must have at least one registered classroom to open the Exam Worksheets Personalization Portal.</p>
          <button
            onClick={() => setShowWorksheetPortal(false)}
            className="px-4 py-2 bg-zinc-950 text-white font-mono font-medium text-xs rounded-lg hover:bg-zinc-850 cursor-pointer animate-pulse"
          >
            Go Back
          </button>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6" id="teacher-dashboard">
      {levelPdfLoading && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl text-xs font-mono animate-pulse flex items-center gap-2">
          <span className="animate-spin text-lg">⏳</span>
          Generating Personalized Level-Wise Worksheet via Levels_wise_question_generator pipeline...
        </div>
      )}
      {levelPdfError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-mono">
          ⚠️ {levelPdfError}
        </div>
      )}
      <div className="border-b border-zinc-200 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 tracking-tight">Classroom Workspace</h1>
          <p className="text-zinc-550 text-sm mt-0.5 font-medium">Teacher: {user.name} · School: {user.schoolId || 'N/A'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLevelRef(true)}
            className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-mono text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            📖 59 FLN Framework
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {showAddForm ? 'Close Form' : 'Register New Student'}
          </button>
        </div>
      </div>

      {/* Add student dropdown form */}
      {showAddForm && (
        <form onSubmit={handleAddStudent} className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
            <h4 className="text-xs font-mono font-bold text-zinc-500 uppercase">
              Register Student in <span className="text-zinc-900">{activeClass ? `${activeClass.className} - ${activeClass.section}` : `${cls} - ${sec}`}</span>
            </h4>
          </div>
          
          {regError && (
            <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg border border-red-100 font-medium">
              ⚠️ {regError}
            </div>
          )}
          {regSuccess && (
            <div className="p-3 text-xs bg-green-50 text-green-700 rounded-lg border border-green-100 font-medium">
              ✅ {regSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amanpreet Singh"
                className="w-full text-sm border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 8"
                className="w-full text-sm border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 mb-1">Identity (Aadhar / BC No.)</label>
              <input
                type="text"
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
                placeholder="12 digit identity number"
                className="w-full text-sm border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-zinc-900 text-white font-mono font-medium text-xs py-3 rounded-lg hover:bg-zinc-800 cursor-pointer shadow-sm transition-colors"
              >
                Verify & Add Student
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Class picker tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-px">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveClass(c)}
            className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all ${
              activeClass?.id === c.id ? 'border-zinc-900 text-zinc-900 font-semibold' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {c.className} - {c.section}
          </button>
        ))}
      </div>

      {activeClass && (
        <div className="space-y-6">
          {/* 📋 Diagnostic Paper Generator */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-display font-semibold text-zinc-900 text-sm">📋 Diagnostic Paper Generator</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Generate baseline diagnostic PDFs for students pending placement.</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {classStudents.filter(s => s.levelHistory.length === 0).length} Pending
                </span>
              </div>
              {!bulkJob || bulkJob?.status === 'failed' ? (
                <button
                  type="button"
                  onClick={async () => {
                    const unplaced = classStudents.filter(s => s.levelHistory.length === 0);
                    if (unplaced.length === 0) {
                      alert('All students in this class already have diagnostic placements.');
                      return;
                    }
                    const classMatch = activeClass?.className.match(/\d+/);
                    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 2;
                    setBulkLoading(true);
                    setBulkError('');
                    setBulkJob(null);
                    try {
                      const res = await fetch('/api/diagnostic/bulk', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ classNumber, students: unplaced.map(s => ({ name: s.name, studentId: s.id })) })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setBulkJob({ ...data, total: unplaced.length, completed: 0, pdfUrl: data.pdfUrl || '', downloadUrl: data.downloadUrl || null, error: '' });
                      } else {
                        setBulkError(data.error || 'Failed to start bulk generation.');
                      }
                    } catch {
                      setBulkError('Network error starting bulk generation.');
                    } finally {
                      setBulkLoading(false);
                    }
                  }}
                  disabled={bulkLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkLoading ? (
                    <><span className="animate-spin text-sm">⏳</span> Generating...</>
                  ) : (
                    <>Generate Diagnostic Papers</>
                  )}
                </button>
              ) : null}
            </div>

            {/* Generating state */}
            {bulkLoading && (
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="animate-spin text-xl">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Generating Diagnostic Papers...</p>
                    <p className="text-xs text-blue-600">Please wait while the papers are being generated for {classStudents.filter(s => s.levelHistory.length === 0).length} students.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk job polling & result */}
            {bulkJob && (
              <>
                {/* Poll progress while running */}
                {bulkJob.status === 'running' && (
                  <div className="pt-2 border-t border-zinc-100">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="animate-spin text-xl">⏳</span>
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Generating Diagnostic Papers...</p>
                        <p className="text-xs text-blue-600">{bulkJob.completed} / {bulkJob.total} papers generated</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed result */}
                {bulkJob.status === 'completed' && bulkJob.downloadUrl && (
                  <div className="pt-2 border-t border-zinc-100">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 font-bold text-sm">✅ {bulkJob.total} Diagnostic Papers Generated Successfully</span>
                      </div>
                      <div className="flex gap-3">
                        {bulkJob.pdfUrl && (
                          <a
                            href={bulkJob.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            👁️ View Generated PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Failed result */}
                {bulkJob.status === 'failed' && (
                  <div className="pt-2 border-t border-zinc-100">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-700 font-medium">❌ Generation Failed: {bulkJob.error || 'Unknown error'}</p>
                      <button
                        onClick={() => setBulkJob(null)}
                        className="mt-2 text-xs text-red-600 underline cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {bulkError && !bulkJob && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">⚠️ {bulkError}</div>
            )}
          </div>

          {/* 📄 Level-Wise Paper Generator - Disabled (Coming Soon) */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4 opacity-60">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-semibold text-zinc-900 text-sm">📄 Level-Wise Paper Generator</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Generate personalized level-wise question PDFs for placed students.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-zinc-200 text-zinc-500 border border-zinc-300">
                  {classStudents.filter(s => s.levelHistory.length > 0).length} Placed
                </span>
                <button
                  type="button"
                  disabled
                  className="bg-zinc-400 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg cursor-not-allowed flex items-center gap-1.5"
                  title="Coming Soon"
                >
                  🚧 Coming Soon
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Class roster table */}
          <div className="xl:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 flex justify-between items-center bg-zinc-50/50">
              <h3 className="font-display font-medium text-zinc-900 text-sm">Classroom Student Roster ({classStudents.length})</h3>
              <button
                onClick={() => setShowWorksheetPortal(true)} // Open worksheets flow
                className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:border-zinc-400 transition-colors"
              >
                Trigger Worksheets Flow
              </button>
            </div>
            <div className="p-4">
              {(() => {
                const studentColumns: Column<Student>[] = [
                  { header: 'ID', accessor: 'id', sortKey: 'id', className: 'font-mono text-xs text-slate-400' },
                  { header: 'Student Name', accessor: 'name', sortKey: 'name', className: 'font-medium text-slate-900' },
                  { header: 'Aadhar / ID No.', accessor: 'aadharMasked', className: 'font-mono text-xs text-slate-500' },
                  {
                    header: 'Current Level',
                    accessor: (s) => (
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                        {s.levelHistory.length === 0 ? '-' : `L${s.currentLevel}.${s.currentSubLevel ?? 0}`}
                      </span>
                    )
                  },
                  {
                    header: 'Target Level',
                    accessor: (s) => <span className="font-mono text-slate-500 text-xs">{s.levelHistory.length === 0 ? '-' : `Level ${s.targetLevel}`}</span>
                  },
                  {
                    header: 'Streak',
                    accessor: (s) => <span className="font-mono font-semibold text-slate-800">{s.levelHistory.length === 0 ? '-' : `${s.streak} 🔥`}</span>
                  },
                  {
                    header: 'Diagnostic Status',
                    accessor: (s) => s.levelHistory.length === 0 ? (
                      <span className="text-amber-700 font-mono text-[9px] font-bold uppercase bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        Will get diagnostic paper
                      </span>
                    ) : (
                      <span className="text-green-700 font-mono text-[9px] font-bold uppercase bg-green-50 px-2 py-1 rounded border border-green-200">
                        Placed
                      </span>
                    )
                  }
                ];
                return (
                  <Table data={classStudents} columns={studentColumns} searchPlaceholder="Search roster by name..." searchKey="name" />
                );
              })()}
            </div>
          </div>


          {/* Quick-action worksheets shortcuts */}
          <div className="xl:col-span-1 space-y-4">
            <div className="bg-white p-5 border border-zinc-200 rounded-xl shadow-sm space-y-4">
              <h4 className="font-display font-medium text-zinc-905 text-sm">Student Management</h4>
              <p className="text-xs text-zinc-505 leading-relaxed">
                View all students registered under your classes and access their complete profiles.
              </p>
              <button
                onClick={() => setShowIcrScanner(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer"
              >
                ICR Answer Sheet Scanner
              </button>
            </div>
          </div>

          {/* Student List Modal */}
          {showStudentList && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowStudentList(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden m-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-200">
                  <h3 className="text-lg font-display font-semibold text-zinc-900">All Students ({students.length})</h3>
                  <button onClick={() => setShowStudentList(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold px-2">&times;</button>
                </div>
                <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
                  {students.length === 0 ? (
                    <p className="text-center text-zinc-400 text-sm py-8">No students registered.</p>
                  ) : (
                    students.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setDiagnosticStudent(s); setShowStudentList(false); }}
                        className="w-full flex items-center gap-4 p-4 border border-zinc-100 rounded-xl hover:border-zinc-300 hover:bg-zinc-50 text-left transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-zinc-900">{s.name}</div>
                          <div className="text-xs text-zinc-400">{s.classGroup} - {s.section} · {s.schoolId}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-sm text-zinc-800">
                            {s.levelHistory.length === 0 ? '—' : `L${s.currentLevel}.${s.currentSubLevel ?? 0}`}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {s.levelHistory.length === 0 ? 'Pending' : 'Placed'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      <FLNLevelReferenceModal isOpen={showLevelRef} onClose={() => setShowLevelRef(false)} />
    </div>
  );
};



