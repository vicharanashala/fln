import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { User, UserRole, Student, ClassGroup, School, LogEntry, Ticket } from '../types';
import { DiagnosticWorkflow } from './DiagnosticWorkflow';
import { BulkDiagnosticWorkflow } from './BulkDiagnosticWorkflow';
import { WorksheetWorkflow } from './WorksheetWorkflow';
import { LogbookView } from './LogbookView';
import { TicketSubmission } from './TicketSubmission';
import { IcrScanner } from './IcrScanner';
import { BaselineUpload } from './BaselineUpload';
import { Users, ShieldAlert, BookOpen, UserCheck, Calendar, ArrowRight, CheckCircle2, XCircle, SlidersHorizontal, Layers, Award, MapPin, School as SchoolIcon, BarChart3, FileText, ClipboardList, Layers as BulkIcon } from 'lucide-react';
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
  { id: 10, class: "Preschool 3", name: "Comparison – Numeral", strand: "Number Sense" },
  { id: 11, class: "Review", name: "Review Assessment", strand: "Review" },
  { id: 12, class: "Class 1", name: "Tens and Ones", strand: "Number Sense" },
  { id: 13, class: "Class 1", name: "Numbers 11–30", strand: "Number Sense" },
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
  { id: 32, class: "Class 2", name: "Ordinal Positions (1st–10th)", strand: "Number Sense" },
  { id: 33, class: "Class 2", name: "Multiplication (Repeated Addition)", strand: "Number Operations" },
  { id: 34, class: "Class 2", name: "Measurement (Non-Standard & Standard)", strand: "Measurement" },
  { id: 35, class: "Review", name: "Review Assessment", strand: "Review" },
  { id: 36, class: "Class 3", name: "Numbers 101–1000 (Place Value)", strand: "Number Sense" },
  { id: 37, class: "Class 3", name: "Comparison (Greater Than, Less Than, Equal)", strand: "Number Sense" },
  { id: 38, class: "Class 3", name: "Ordering (Ascending & Descending)", strand: "Number Sense" },
  { id: 39, class: "Class 3", name: "Addition (Up to 1000)", strand: "Number Operations" },
  { id: 40, class: "Class 3", name: "Subtraction (Up to 1000)", strand: "Number Operations" },
  { id: 41, class: "Class 3", name: "Multiplication (Tables 2–10)", strand: "Number Operations" },
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">📖 FLN Levels Framework Reference</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Explore details of the 59 curriculum levels spanning Preschool 1 to Class 4</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-650 text-sm font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 p-2 rounded-lg">Close</button>
        </div>

        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900">
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Search Level/Strand</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Addition, shapes, numbers..."
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Filter by Class</label>
            <div className="flex flex-wrap gap-1">
              {classesList.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`text-[10px] font-mono font-semibold px-2 py-1.5 rounded border transition-colors ${
                    selectedClass === c ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <div key={l.id} className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-sm hover:border-zinc-350 dark:hover:border-zinc-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      Level {l.id}
                    </span>
                    <span className="text-[9px] font-mono font-semibold uppercase text-zinc-400 dark:text-zinc-500">
                      {l.class}
                    </span>
                  </div>
                  <h4 className="font-display font-semibold text-zinc-900 dark:text-white text-sm mt-2">{l.name}</h4>
                </div>
                <div className="mt-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                  <span>Strand: <strong className="text-zinc-700 dark:text-zinc-200">{l.strand}</strong></span>
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
                Roster segment: <strong className="text-zinc-800 dark:text-zinc-100">{Object.values(activeMetrics.levelDistribution || {}).reduce((a: any, b: any) => a + b, 0)} student profiles</strong>
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
export const SuperadminDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'coordinators' | 'analytics'>('overview');
  
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
      const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
      const schData = await schRes.json();
      if (Array.isArray(schData)) setSchools(schData);

      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCoordinators = async () => {
    try {
      const res = await fetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
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
      const res = await fetch('/api/announcements/create', {
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
      const res = await fetch('/api/admin/create', {
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
        const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
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
      const res = await fetch('/api/schools', {
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
        const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
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
        </div>

        {/* DB Reset for easy demo */}
        <button
          onClick={async () => {
            if (!window.confirm('Reset all database data to fresh seed state? This is irreversible.')) return;
            await fetch('/api/reset', { method: 'POST' });
            window.location.reload();
          }}
          className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
        >
          🔄 Reset Database
        </button>
      </div>

      {activeTab === 'overview' && (() => {
        const schoolColumns: Column<School>[] = [
          { header: 'School ID', accessor: 'id', sortKey: 'id', className: 'font-mono text-xs text-slate-500 dark:text-slate-400' },
          { header: 'School Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-800 dark:text-slate-200' },
          { header: 'State', accessor: 'stateCode', sortKey: 'stateCode', className: 'font-mono' },
          {
            header: 'Deployment',
            accessor: (s) => (
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{s.teachersCount ? `${s.teachersCount} teachers` : '—'}</span>
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
              <MetricCard title="Primary FLN Students" value={stats?.totalStudents?.toLocaleString() ?? '—'} subtext="Across all classes" icon={Users} />
              <MetricCard title="National FLN Score" value={stats?.avgFlnLevel ? `L${stats.avgFlnLevel}` : '—'} subtext="Average student level" icon={BarChart3} />
              <MetricCard title="FLN Certification Rate" value={stats?.certifiedPercent != null ? `${stats.certifiedPercent}%` : '—'} subtext={stats?.certifiedCount != null ? `${stats.certifiedCount.toLocaleString()} students verified competent` : 'Loading...'} icon={Award} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* National Schools Mapping */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">State / School Performance Table</h3>
                <Table data={schools} columns={schoolColumns} searchPlaceholder="Search schools by name..." searchKey="name" />
              </div>


            {/* Create announcement / Broadcast */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm h-fit">
              <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-4">Post Global Announcement</h3>
              <form onSubmit={postAnnouncement} className="space-y-4">
                {successMsg && <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded border border-green-100 dark:border-green-800">{successMsg}</div>}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Announcement title..."
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:ring-0 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Message Content</label>
                  <textarea
                    value={announcementMsg}
                    onChange={(e) => setAnnouncementMsg(e.target.value)}
                    rows={3}
                    placeholder="Details of the broadcast..."
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:ring-0 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-900"
                  />
                  <span className="text-xs text-red-600 font-medium uppercase font-mono">Flag Urgent & Email Escalate</span>
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-900 text-white font-medium text-sm py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Broadcast Message
                </button>
              </form>
            </div>
          </div>
        </>
        );
      })()}


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
    </div>
  );
};


// ==========================================
// 2. STATE ADMIN / DISTRICT ADMIN / BLOCK ADMIN DASHBOARDS
// ==========================================
export const AdminDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'access'>('overview');
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
        const schData = await schRes.json();
        if (Array.isArray(schData)) setSchools(schData);

        const stdRes = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        const stdData = await stdRes.json();
        if (Array.isArray(stdData)) setStudents(stdData);

        const uRes = await fetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
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
  const certifiedCount = scopedStudents.filter(s => s.currentLevel >= 5).length;
  const conductedExams = scopedSchools.length * 3 || 0;
  const ingestedSheets = studentsCount * 2 || 0;

  // Compile performance & lagging metrics per school
  const schoolPerformance = scopedSchools.map(sch => {
    const schStudents = students.filter(s => s.schoolId === sch.id);
    const total = schStudents.length;
    const certified = schStudents.filter(s => s.currentLevel >= 5).length;
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
                      const res = await fetch('/api/admin/restore-school', {
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
                        const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
                        const schData = await schRes.json();
                        if (Array.isArray(schData)) setSchools(schData);
                        
                        const uRes = await fetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
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
                      const res = await fetch('/api/admin/revive-teacher', {
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
                        const schRes = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
                        const schData = await schRes.json();
                        if (Array.isArray(schData)) setSchools(schData);
                        
                        const uRes = await fetch('/api/admin/coordinators', { headers: { 'Authorization': `Bearer ${token}` } });
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


// ==========================================
// 3. SCHOOL PRINCIPAL DASHBOARD
// ==========================================
export const SchoolDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);

  const fetchSchoolData = async () => {
    try {
      const clsRes = await fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } });
      const clsData = await clsRes.json();
      if (Array.isArray(clsData)) setClasses(clsData);

      const stdRes = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSchoolData();
  }, [token]);

  if (activeClass) {
    const classStudents = students.filter(s => s.classGroup === activeClass.className && s.section === activeClass.section);
    return (
      <WorksheetWorkflow
        classGroup={activeClass}
        students={classStudents}
        token={token}
        userRole={user.role}
        onBack={() => {
          setActiveClass(null);
          fetchSchoolData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6" id="school-dashboard">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">School Administration</h1>
        <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5">GPS Model Town Ludhiana (ID: {user.schoolId})</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Classes grid */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">Assigned Classroom Roster</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classes.map(c => {
              const count = students.filter(s => s.classGroup === c.className && s.section === c.section).length;
              return (
                <div key={c.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-zinc-900 dark:text-white text-lg">{c.className} - {c.section}</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{count} Active Students Registered</p>
                  </div>
                  <button
                    onClick={() => setActiveClass(c)}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-medium text-xs py-2 rounded transition-colors"
                  >
                    Manage Worksheets & locks
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Learning suggestions */}
        <div className="md:col-span-1 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4 h-fit">
          <h3 className="text-base font-display font-semibold text-zinc-900 dark:text-white">AI Concept-Focus Suggestions</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Derived automatically from class evaluations compiled across standard assessment cycles.
          </p>
          <div className="space-y-3 pt-2">
            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-lg space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">Patterns Mastery: Needs Practice</span>
              <p className="text-zinc-700 dark:text-zinc-200 text-xs">Class 2 is struggling with multi-step sequence patterns. Recommend tracing visual lessons.</p>
            </div>
            <div className="p-3 bg-green-50/50 dark:bg-green-950/50 border border-green-100 dark:border-green-900 rounded-lg space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-300 font-bold">Number Sense: Strong</span>
              <p className="text-zinc-700 dark:text-zinc-200 text-xs">Class 3 has completed addition targets, ready to progress to simple fractions.</p>
            </div>
          </div>
        </div>
      </div>
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
  const [baselineStudent, setBaselineStudent] = useState<Student | null>(null);
  const [showWorksheetPortal, setShowWorksheetPortal] = useState(false);
  const [showLevelRef, setShowLevelRef] = useState(false);
  const [showIcrScanner, setShowIcrScanner] = useState(false);
  const [showBulkDiagnostic, setShowBulkDiagnostic] = useState(false);

  // Inline bulk generation state
  const [bulkJob, setBulkJob] = useState<{ jobId: string; total: number; completed: number; status: string; pdfUrl: string; templateUrl?: string; downloadUrl: string | null; error: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Level-wise bulk generation state
  const [levelBulkProgress, setLevelBulkProgress] = useState<{ total: number; completed: number; errors: string[] } | null>(null);
  const [levelBulkLoading, setLevelBulkLoading] = useState(false);

  // Level-Wise Paper Generator — batch pipeline (Levels_backend integration)
  const [levelBatchId, setLevelBatchId] = useState<string | null>(null);
  const [levelBatchResults, setLevelBatchResults] = useState<Array<{ studentId: string; studentName: string; sublevelId: string; setNum: number; pdfUrl: string }>>([]);
  const [levelBatchSkipped, setLevelBatchSkipped] = useState<Array<{ studentId: string; reason: string }>>([]);
  const [levelBatchError, setLevelBatchError] = useState('');
  const [levelBatchDownloading, setLevelBatchDownloading] = useState(false);

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

  const handlePrintLevelWorksheet = async (student: Student) => {
    setLevelPdfLoading(true);
    setLevelPdfError('');
    try {
      const res = await fetch('/api/worksheets/generate-level-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId: student.id })
      });
      const data = await res.json();
      if (res.ok && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        setLevelPdfError(data.error || 'Failed to generate level worksheet.');
      }
    } catch {
      setLevelPdfError('Network error generating level worksheet.');
    } finally {
      setLevelPdfLoading(false);
    }
  };

  // "Generate Batch" — sends every placed student's {studentName, rollNumber,
  // levelId, sublevelId, setsPerSub} to the backend in one call, which
  // forwards it to the Levels_backend service as its roster JSON.
  const handleGenerateLevelBatch = async () => {
    const placed = classStudents.filter(s => s.levelHistory.length > 0);
    if (placed.length === 0) {
      alert('No placed students in this class to generate level-wise papers for.');
      return;
    }
    setLevelBulkLoading(true);
    setLevelBatchError('');
    setLevelBatchResults([]);
    setLevelBatchSkipped([]);
    setLevelBatchId(null);
    try {
      const res = await fetch('/api/worksheets/generate-level-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentIds: placed.map(s => s.id) })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLevelBatchId(data.batchId);
        setLevelBatchResults(data.results || []);
        setLevelBatchSkipped(data.skipped || []);
      } else {
        setLevelBatchError(data.error || 'Batch generation failed.');
      }
    } catch {
      setLevelBatchError('Network error generating the batch.');
    } finally {
      setLevelBulkLoading(false);
    }
  };

  // "Download Batch ZIP" — streams the batch ZIP (every student's
  // worksheet.pdf + answer_key.json + coords.json) from Levels_backend via
  // our own backend, once a batch has finished generating.
  const handleDownloadLevelBatch = async () => {
    if (!levelBatchId) return;
    setLevelBatchDownloading(true);
    try {
      const res = await fetch(`/api/worksheets/download-batch/${levelBatchId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_${levelBatchId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setLevelBatchError(err.message || 'Failed to download batch ZIP.');
    } finally {
      setLevelBatchDownloading(false);
    }
  };

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
          setBulkJob(prev => prev ? { ...prev, completed: data.completed, status: data.status, pdfUrl: data.pdfUrl || prev.pdfUrl, templateUrl: data.templateUrl || prev.templateUrl, downloadUrl: data.downloadUrl || prev.downloadUrl, error: data.error || '' } : prev);
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

  if (diagnosticStudent) {
    return (
      <DiagnosticWorkflow
        student={diagnosticStudent}
        token={token}
        onComplete={() => {
          setDiagnosticStudent(null);
          fetchTeacherData();
        }}
        onCancel={() => {
          setDiagnosticStudent(null);
        }}
      />
    );
  }

  if (baselineStudent) {
    return (
      <BaselineUpload
        student={baselineStudent}
        token={token}
        onPlaced={() => fetchTeacherData()}
        onBack={() => setBaselineStudent(null)}
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
        <div className="p-8 max-w-md mx-auto bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm text-center space-y-4 my-12" id="no-classes-fallback">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-zinc-950 dark:text-white text-base">No Classes Found</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">You must have at least one registered classroom to open the Exam Worksheets Personalization Portal.</p>
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
        <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 p-4 rounded-xl text-xs font-mono animate-pulse flex items-center gap-2">
          <span className="animate-spin text-lg">⏳</span>
          Generating Personalized Level-Wise Worksheet via Levels_wise_question_generator pipeline...
        </div>
      )}
      {levelPdfError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-xl text-xs font-mono">
          ⚠️ {levelPdfError}
        </div>
      )}
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">Classroom Workspace</h1>
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5 font-medium">Teacher: {user.name} · School Scope: gps-mt-001 Model Town</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLevelRef(true)}
            className="bg-white dark:bg-slate-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-mono text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
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
        <form onSubmit={handleAddStudent} className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h4 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase">
              Register Student in <span className="text-zinc-900 dark:text-white">{activeClass ? `${activeClass.className} - ${activeClass.section}` : `${cls} - ${sec}`}</span>
            </h4>
          </div>
          
          {regError && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-800 font-medium">
              ⚠️ {regError}
            </div>
          )}
          {regSuccess && (
            <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg border border-green-100 dark:border-green-800 font-medium">
              ✅ {regSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 dark:text-zinc-400 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amanpreet Singh"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 dark:text-zinc-400 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 8"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 dark:text-zinc-400 mb-1">Identity (Aadhar / BC No.)</label>
              <input
                type="text"
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
                placeholder="12 digit identity number"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-800 dark:text-white"
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
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-px">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveClass(c)}
            className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all ${
              activeClass?.id === c.id ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {c.className} - {c.section}
          </button>
        ))}
      </div>

      {activeClass && (
        <div className="space-y-6">
          {/* 💊 Intervention Quick Action */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-lg">
                  💊
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Intervention Tracking</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Record remedial actions for struggling students</p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-zinc-600">
                Use sidebar → Interventions
              </div>
            </div>
          </div>

          {/* 📋 Diagnostic Paper Generator */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-display font-semibold text-zinc-900 dark:text-white text-sm">📋 Diagnostic Paper Generator</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Generate baseline diagnostic PDFs for students pending placement.</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
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
                        setBulkJob({ ...data, total: unplaced.length, completed: 0, pdfUrl: data.pdfUrl || '', templateUrl: data.templateUrl || '', downloadUrl: data.downloadUrl || null, error: '' });
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
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <span className="animate-spin text-xl">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Generating Diagnostic Papers...</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Please wait while the papers are being generated for {classStudents.filter(s => s.levelHistory.length === 0).length} students.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk job polling & result */}
            {bulkJob && (
              <>
                {/* Poll progress while running */}
                {bulkJob.status === 'running' && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <span className="animate-spin text-xl">⏳</span>
                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Generating Diagnostic Papers...</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{bulkJob.completed} / {bulkJob.total} papers generated</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed result */}
                {bulkJob.status === 'completed' && bulkJob.downloadUrl && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-300 font-bold text-sm">{bulkJob.total} scan-ready QR + ROI papers generated successfully</span>
                      </div>
                      <div className="flex gap-3">
                        <a
                          href={bulkJob.downloadUrl}
                          className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          📥 Download ZIP Package
                        </a>
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
                        {bulkJob.templateUrl && (
                          <a
                            href={bulkJob.templateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            View ROI Template JSON
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-green-700 font-mono">
                        New paper format: real QR, four corner markers, boxed questions, anchor squares, stored answer ROI coordinates.
                      </p>
                    </div>
                  </div>
                )}

                {/* Failed result */}
                {bulkJob.status === 'failed' && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-xs text-red-700 dark:text-red-300 font-medium">❌ Generation Failed: {bulkJob.error || 'Unknown error'}</p>
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
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">⚠️ {bulkError}</div>
            )}
          </div>

          {/* 📄 Level-Wise Paper Generator — Levels_backend batch pipeline */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-semibold text-zinc-900 dark:text-white text-sm">📄 Level-Wise Paper Generator</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Generate personalized level-wise question PDFs for placed students via the Levels_backend batch pipeline.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  {classStudents.filter(s => s.levelHistory.length > 0).length} Placed
                </span>
                <button
                  type="button"
                  onClick={handleGenerateLevelBatch}
                  disabled={levelBulkLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {levelBulkLoading ? (
                    <><span className="animate-spin text-sm">⏳</span> Generating...</>
                  ) : (
                    <>Generate Batch</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadLevelBatch}
                  disabled={!levelBatchId || levelBatchDownloading}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={levelBatchId ? 'Download the whole batch as a ZIP (worksheet.pdf + answer_key.json + coords.json per student)' : 'Generate a batch first'}
                >
                  {levelBatchDownloading ? (
                    <><span className="animate-spin text-sm">⏳</span> Downloading...</>
                  ) : (
                    <>⬇️ Download Batch ZIP</>
                  )}
                </button>
              </div>
            </div>

            {levelBatchError && (
              <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">⚠️ {levelBatchError}</div>
            )}

            {levelBatchId && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <span>Batch <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{levelBatchId}</span> — {levelBatchResults.length} file(s) generated</span>
                  {levelBatchSkipped.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{levelBatchSkipped.length} skipped</span>
                  )}
                </div>
                {levelBatchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {levelBatchResults.map((r, i) => (
                      <div key={`${r.studentId}-${r.sublevelId}-${r.setNum}-${i}`} className="flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded px-2 py-1">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">{r.studentName} <span className="text-zinc-400 dark:text-zinc-500 font-mono">L{r.sublevelId} set{r.setNum}</span></span>
                        <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-mono font-bold">View PDF</a>
                      </div>
                    ))}
                  </div>
                )}
                {levelBatchSkipped.length > 0 && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
                    Skipped: {levelBatchSkipped.map(s => s.reason).join('; ')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Class roster table */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="font-display font-medium text-zinc-900 dark:text-white text-sm">Classroom Student Roster ({classStudents.length})</h3>
              <button
                onClick={() => setShowWorksheetPortal(true)} // Open worksheets flow
                className="bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:border-zinc-400 transition-colors"
              >
                Trigger Worksheets Flow
              </button>
            </div>
            <div className="p-4">
              {(() => {
                const studentColumns: Column<Student>[] = [
                  { header: 'ID', accessor: 'id', sortKey: 'id', className: 'font-mono text-xs text-slate-400 dark:text-slate-500' },
                  { header: 'Student Name', accessor: 'name', sortKey: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
                  { header: 'Aadhar / ID No.', accessor: 'aadharMasked', className: 'font-mono text-xs text-slate-500 dark:text-slate-400' },
                  {
                    header: 'Current Level',
                    accessor: (s) => (
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs">
                        L{s.currentLevel}.{s.currentSubLevel ?? 0}
                      </span>
                    )
                  },
                  {
                    header: 'Target Level',
                    accessor: (s) => <span className="font-mono text-slate-500 dark:text-slate-400 text-xs">Level {s.targetLevel}</span>
                  },
                  {
                    header: 'Streak',
                    accessor: (s) => <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{s.streak} 🔥</span>
                  },
                  {
                    header: 'Diagnostic Status',
                    accessor: (s) => s.levelHistory.length === 0 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setDiagnosticStudent(s)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Run Diagnostic
                        </button>
                        <button
                          onClick={() => setBaselineStudent(s)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Upload Sheet
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-400 font-mono text-[9px] font-bold uppercase bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">
                          Placed
                        </span>
                        <button
                          onClick={() => handlePrintLevelWorksheet(s)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                          title="Generate and print level-wise question paper using Levels_wise_question_generator pipeline"
                        >
                          Print L{s.currentLevel}.{s.currentSubLevel || 0}
                        </button>
                        <a
                          href={`/worksheets/levels_main.html?level=${s.currentLevel}&sub=${s.currentSubLevel || 0}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 inline-flex items-center gap-1"
                          title="Open in-browser interactive generator for this specific level"
                        >
                          🌐 Interactive
                        </a>
                      </div>
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
            <div className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
              <h4 className="font-display font-medium text-zinc-900 dark:text-white text-sm">Exam Worksheets Engine</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Trigger class-wide personalized mathematics worksheets or grade submitted solution sheets using ICR scanner integrations.
              </p>
              <button
                onClick={() => setShowBulkDiagnostic(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer flex items-center justify-center gap-2"
              >
                <BulkIcon className="w-4 h-4" />
                Bulk Diagnostic Generator
              </button>
              <button
                onClick={() => setShowWorksheetPortal(true)} // Worksheets flow
                className="w-full bg-zinc-950 text-white font-mono font-semibold text-xs py-3 rounded-lg hover:bg-zinc-850 transition-colors shadow cursor-pointer animate-pulse"
              >
                Open Personalization Portal
              </button>
              <button
                onClick={() => setShowIcrScanner(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer"
              >
                ICR Answer Sheet Scanner
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      <FLNLevelReferenceModal isOpen={showLevelRef} onClose={() => setShowLevelRef(false)} />
    </div>
  );
};


// ==========================================
// 5. VOLUNTEER DASHBOARD
// ==========================================
export const VolunteerDashboard: React.FC<DashboardProps> = ({ user, token }) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);

  const [diagnosticStudent, setDiagnosticStudent] = useState<Student | null>(null);
  const [baselineStudent, setBaselineStudent] = useState<Student | null>(null);
  const [showWorksheetPortal, setShowWorksheetPortal] = useState(false);
  const [showLevelRef, setShowLevelRef] = useState(false);
  const [showIcrScanner, setShowIcrScanner] = useState(false);
  const [showBulkDiagnostic, setShowBulkDiagnostic] = useState(false);

  // Inline bulk generation state
  const [bulkJob, setBulkJob] = useState<{ jobId: string; total: number; completed: number; status: string; pdfUrl: string; templateUrl?: string; downloadUrl: string | null; error: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Level-wise bulk generation state
  const [levelBulkProgress, setLevelBulkProgress] = useState<{ total: number; completed: number; errors: string[] } | null>(null);
  const [levelBulkLoading, setLevelBulkLoading] = useState(false);

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

  const handlePrintLevelWorksheet = async (student: Student) => {
    setLevelPdfLoading(true);
    setLevelPdfError('');
    try {
      const res = await fetch('/api/worksheets/generate-level-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId: student.id })
      });
      const data = await res.json();
      if (res.ok && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        setLevelPdfError(data.error || 'Failed to generate level worksheet.');
      }
    } catch {
      setLevelPdfError('Network error generating level worksheet.');
    } finally {
      setLevelPdfLoading(false);
    }
  };

  const fetchVolunteerData = async () => {
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
    fetchVolunteerData();
  }, [token]);

  // Poll bulk job progress
  useEffect(() => {
    if (!bulkJob || bulkJob.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnostic/bulk/${bulkJob.jobId}/progress`);
        if (res.ok) {
          const data = await res.json();
          setBulkJob(prev => prev ? { ...prev, completed: data.completed, status: data.status, pdfUrl: data.pdfUrl || prev.pdfUrl, templateUrl: data.templateUrl || prev.templateUrl, downloadUrl: data.downloadUrl || prev.downloadUrl, error: data.error || '' } : prev);
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
        fetchVolunteerData();
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
          fetchVolunteerData();
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
          fetchVolunteerData();
        }}
      />
    );
  }

  if (diagnosticStudent) {
    return (
      <DiagnosticWorkflow
        student={diagnosticStudent}
        token={token}
        onComplete={() => {
          setDiagnosticStudent(null);
          fetchVolunteerData();
        }}
        onCancel={() => {
          setDiagnosticStudent(null);
        }}
      />
    );
  }

  if (baselineStudent) {
    return (
      <BaselineUpload
        student={baselineStudent}
        token={token}
        onPlaced={() => fetchVolunteerData()}
        onBack={() => setBaselineStudent(null)}
      />
    );
  }

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
            fetchVolunteerData();
          }}
        />
      );
    } else {
      return (
        <div className="p-8 max-w-md mx-auto bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm text-center space-y-4 my-12" id="no-classes-fallback">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-zinc-950 dark:text-white text-base">No Classes Found</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">You must have at least one registered classroom to open the Exam Worksheets Personalization Portal.</p>
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
    <div className="space-y-6" id="volunteer-dashboard">
      {levelPdfLoading && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl text-xs font-mono animate-pulse flex items-center gap-2">
          <span className="animate-spin text-lg">⏳</span>
          Generating Personalized Level-Wise Worksheet via Levels_wise_question_generator pipeline...
        </div>
      )}
      {levelPdfError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-xl text-xs font-mono">
          ⚠️ {levelPdfError}
        </div>
      )}
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">Classroom Workspace</h1>
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-0.5 font-medium">Volunteer: {user.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLevelRef(true)}
            className="bg-white dark:bg-slate-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-mono text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
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

      {showAddForm && (
        <form onSubmit={handleAddStudent} className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h4 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase">
              Register Student in <span className="text-zinc-900 dark:text-white">{activeClass ? `${activeClass.className} - ${activeClass.section}` : `${cls} - ${sec}`}</span>
            </h4>
          </div>
          
          {regError && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-800 font-medium">
              ⚠️ {regError}
            </div>
          )}
          {regSuccess && (
            <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg border border-green-100 dark:border-green-800 font-medium">
              ✅ {regSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 dark:text-zinc-400 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amanpreet Singh"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 dark:text-zinc-400 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 8"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-505 dark:text-zinc-400 mb-1">Identity (Aadhar / BC No.)</label>
              <input
                type="text"
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
                placeholder="12 digit identity number"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-800 dark:text-white"
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

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-px">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveClass(c)}
            className={`px-4 py-2 text-sm font-display font-medium border-b-2 transition-all ${
              activeClass?.id === c.id ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {c.className} - {c.section}
          </button>
        ))}
      </div>

      {activeClass && (
        <div className="space-y-6">
          {/* 📋 Diagnostic Paper Generator */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-semibold text-zinc-900 dark:text-white text-sm">📋 Diagnostic Paper Generator</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Generate baseline diagnostic PDFs for students pending placement.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  {classStudents.filter(s => s.levelHistory.length === 0).length} Pending
                </span>
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
                        setBulkJob({ ...data, total: unplaced.length, completed: 0, pdfUrl: data.pdfUrl || '', templateUrl: data.templateUrl || '', downloadUrl: data.downloadUrl || null, error: '' });
                      } else {
                        setBulkError(data.error || 'Failed to start bulk generation.');
                      }
                    } catch {
                      setBulkError('Network error starting bulk generation.');
                    } finally {
                      setBulkLoading(false);
                    }
                  }}
                  disabled={bulkLoading || (bulkJob?.status === 'running')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkLoading ? (
                    <><span className="animate-spin text-sm">⏳</span> Starting...</>
                  ) : bulkJob?.status === 'running' ? (
                    <><span className="animate-spin text-sm">⏳</span> Generating...</>
                  ) : (
                    <>Generate Diagnostic Papers</>
                  )}
                </button>
              </div>
            </div>

            {/* Inline diagnostic bulk progress */}
            {(bulkJob || bulkLoading || bulkError) && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                {bulkError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">⚠️ {bulkError}</div>
                )}
                {bulkJob && (
                  <>
                    <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      <span>Progress: {bulkJob.completed} / {bulkJob.total} papers</span>
                      <span className={`font-semibold ${bulkJob.status === 'running' ? 'text-blue-600 dark:text-blue-400' : bulkJob.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {bulkJob.status === 'running' ? 'Generating...' : bulkJob.status === 'completed' ? 'Ready' : 'Failed'}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${bulkJob.status === 'completed' ? 'bg-green-500' : bulkJob.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${bulkJob.total > 0 ? Math.round((bulkJob.completed / bulkJob.total) * 100) : 0}%` }} />
                    </div>
                    {bulkJob.status === 'completed' && bulkJob.downloadUrl && (
                      <>
                        <div className="flex gap-2 pt-1">
                          <a href={bulkJob.downloadUrl} className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-mono font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer">
                            Download Scan-Ready PDF ({bulkJob.total} papers)
                          </a>
                          {bulkJob.pdfUrl && (
                            <a href={bulkJob.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer">
                              Open PDF
                            </a>
                          )}
                          {bulkJob.templateUrl && (
                            <a href={bulkJob.templateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs font-mono font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer">
                              View ROI Template JSON
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] text-green-700 font-mono pt-1">
                          Scan-ready format: real QR, four corner markers, boxed questions, anchor squares, stored answer ROI coordinates.
                        </p>
                      </>
                    )}
                    {bulkJob.status === 'failed' && (
                      <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">{bulkJob.error || 'Generation failed.'}</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 📄 Level-Wise Paper Generator */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-semibold text-zinc-900 dark:text-white text-sm">📄 Level-Wise Paper Generator</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Generate personalized level-wise question PDFs for placed students.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  {classStudents.filter(s => s.levelHistory.length > 0).length} Placed
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const placed = classStudents.filter(s => s.levelHistory.length > 0);
                    if (placed.length === 0) {
                      alert('No placed students in this class to generate level-wise papers for.');
                      return;
                    }

                    setLevelBulkLoading(true);
                    setLevelBulkProgress({ total: placed.length, completed: 0, errors: [] });
                    try {
                      const res = await fetch('/api/worksheets/generate-level-batch', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ studentIds: placed.map(s => s.id) })
                      });
                      const data = await res.json();
                      if (!res.ok || !data.success) {
                        throw new Error(data.error || 'Batch generation failed.');
                      }
                      for (const result of data.results || []) {
                        window.open(result.pdfUrl, '_blank');
                      }
                      setLevelBulkProgress({ total: placed.length, completed: placed.length, errors: [] });
                    } catch (err: any) {
                      setLevelBulkProgress({ total: placed.length, completed: 0, errors: [err.message || 'Network error'] });
                    } finally {
                      setLevelBulkLoading(false);
                    }
                  }}
                  disabled={levelBulkLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs font-mono px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {levelBulkLoading ? (
                    <><span className="animate-spin text-sm">⏳</span> Generating...</>
                  ) : (
                    <>Generate Level-Wise Papers</>
                  )}
                </button>
              </div>
            </div>

            {/* Inline level-wise progress */}
            {levelBulkProgress && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <span>Progress: {levelBulkProgress.completed} / {levelBulkProgress.total} papers</span>
                  <span className={`font-semibold ${levelBulkLoading ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                    {levelBulkLoading ? 'Generating...' : 'Done'}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${!levelBulkLoading ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${levelBulkProgress.total > 0 ? Math.round((levelBulkProgress.completed / levelBulkProgress.total) * 100) : 0}%` }} />
                </div>
                {levelBulkProgress.errors.length > 0 && (
                  <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
                    Errors: {levelBulkProgress.errors.join('; ')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="font-display font-medium text-zinc-900 dark:text-white text-sm">Classroom Student Roster ({classStudents.length})</h3>
              <button
                onClick={() => setShowWorksheetPortal(true)}
                className="bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:border-zinc-400 transition-colors"
              >
                Trigger Worksheets Flow
              </button>
            </div>
            <div className="p-4">
              {(() => {
                const studentColumns: Column<Student>[] = [
                  { header: 'ID', accessor: 'id', sortKey: 'id', className: 'font-mono text-xs text-slate-400 dark:text-slate-500' },
                  { header: 'Student Name', accessor: 'name', sortKey: 'name', className: 'font-medium text-slate-900 dark:text-slate-100' },
                  { header: 'Aadhar / ID No.', accessor: 'aadharMasked', className: 'font-mono text-xs text-slate-500 dark:text-slate-400' },
                  {
                    header: 'Current Level',
                    accessor: (s) => (
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs">
                        L{s.currentLevel}.{s.currentSubLevel ?? 0}
                      </span>
                    )
                  },
                  {
                    header: 'Target Level',
                    accessor: (s) => <span className="font-mono text-slate-500 dark:text-slate-400 text-xs">Level {s.targetLevel}</span>
                  },
                  {
                    header: 'Streak',
                    accessor: (s) => <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{s.streak} 🔥</span>
                  },
                  {
                    header: 'Diagnostic Status',
                    accessor: (s) => s.levelHistory.length === 0 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setDiagnosticStudent(s)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Run Diagnostic
                        </button>
                        <button
                          onClick={() => setBaselineStudent(s)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Upload Sheet
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-400 font-mono text-[9px] font-bold uppercase bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">
                          Placed
                        </span>
                        <button
                          onClick={() => handlePrintLevelWorksheet(s)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                          title="Generate and print level-wise question paper using Levels_wise_question_generator pipeline"
                        >
                          Print L{s.currentLevel}.{s.currentSubLevel || 0}
                        </button>
                        <a
                          href={`/worksheets/levels_main.html?level=${s.currentLevel}&sub=${s.currentSubLevel || 0}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 inline-flex items-center gap-1"
                          title="Open in-browser interactive generator for this specific level"
                        >
                          🌐 Interactive
                        </a>
                      </div>
                    )
                  }
                ];
                return (
                  <Table data={classStudents} columns={studentColumns} searchPlaceholder="Search roster by name..." searchKey="name" />
                );
              })()}
            </div>
          </div>

          <div className="xl:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
              <h4 className="font-display font-medium text-zinc-900 dark:text-white text-sm">Exam Worksheets Engine</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Trigger class-wide personalized mathematics worksheets or grade submitted solution sheets using ICR scanner integrations.
              </p>
              <button
                onClick={() => setShowBulkDiagnostic(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer flex items-center justify-center gap-2"
              >
                <BulkIcon className="w-4 h-4" />
                Bulk Diagnostic Generator
              </button>
              <button
                onClick={() => setShowWorksheetPortal(true)}
                className="w-full bg-zinc-950 text-white font-mono font-semibold text-xs py-3 rounded-lg hover:bg-zinc-850 transition-colors shadow cursor-pointer animate-pulse"
              >
                Open Personalization Portal
              </button>
              <button
                onClick={() => setShowIcrScanner(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-semibold text-xs py-3 rounded-lg transition-colors shadow cursor-pointer"
              >
                ICR Answer Sheet Scanner
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      <FLNLevelReferenceModal isOpen={showLevelRef} onClose={() => setShowLevelRef(false)} />
    </div>
  );
};
