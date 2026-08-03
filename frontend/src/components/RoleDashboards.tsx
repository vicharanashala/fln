import React, { useState, useEffect, useMemo } from 'react';
import { Announcement, AnnouncementReadStats } from '../types';
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
      const res = await fetch(`/api/analytics?stateCode=${stateCode}&districtCode=${districtCode}&blockCode=${blockCode}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        } else {
          setMetrics(null);
        }
    } catch (e) {
      console.error(e);
      setMetrics(null);
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
};export const AnnouncementComplianceView: React.FC<{ token: string }> = ({ token }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [stats, setStats] = useState<AnnouncementReadStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState<'read' | 'unread'>('unread');

  useEffect(() => {
    const fetchAnns = async () => {
      try {
        const res = await fetch('/api/announcements', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setAnnouncements(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchAnns();
  }, [token]);

  useEffect(() => {
    if (!selectedId) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/announcements/${selectedId}/reads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        console.log("FETCHED READ STATS FROM BACKEND:", d);
        console.log("READ USERS LIST FROM BACKEND:", d.readUsers);
        setStats(d);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedId, token]);

  const byRoleEntries = Object.entries((stats?.byRole as Record<string, any>) ?? {}) as Array<
    [string, { read?: number; total?: number }]
  >;
  const byDistrictEntries = Object.entries((stats?.byDistrict as Record<string, any>) ?? {}) as Array<
    [string, { read?: number; total?: number }]
  >;
  const unreadUsers = Array.isArray(stats?.unreadUsers) ? stats.unreadUsers : [];
  const readUsers = Array.isArray(stats?.readUsers) ? stats.readUsers : [];
  const activeUsers = showList === 'unread' ? unreadUsers : readUsers;

  // Live calculated metrics
const readCount = readUsers.length;
const unreadCount = unreadUsers.length;
const totalRecipients = readCount + unreadCount;
const readPercent = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-4">
        <h3 className="text-lg font-display font-medium text-zinc-900">Announcements</h3>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full md:w-96 text-sm border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-500"
        >
          {announcements.map(a => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="p-8 text-center text-zinc-400 font-mono text-xs">Loading compliance data...</div>
      )}

      {!loading && stats && (
        <>
          {/* Summary cards + progress bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Total Recipients" value={totalRecipients} />
            <MetricCard title="Read" value={readCount} subtext={`${readPercent}% of recipients`} />
            <MetricCard title="Unread" value={unreadCount} />
            <MetricCard
              title="Last Viewed"
              value={stats.lastViewedAt ? new Date(stats.lastViewedAt).toLocaleTimeString() : '—'}
              subtext={stats.firstViewedAt ? `First: ${new Date(stats.firstViewedAt).toLocaleTimeString()}` : undefined}
            />
          </div>

          <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-zinc-600">Overall Read Rate</span>
              <span className="font-semibold text-zinc-900">{readPercent}%</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-3">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all"
                style={{ width: `${readPercent}%` }}
              />
            </div>
          </div>

          {/* Role + District breakdowns side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-3">
              <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">By Role</h4>
              {byRoleEntries.length === 0 ? (
                <div className="p-4 text-center text-zinc-400 text-xs font-mono">
                  No role breakdown available.
                </div>
              ) : (
                byRoleEntries.map(([role, s]) => {
                  const roleRead = Number(s?.read ?? 0);
                  const roleTotal = Number(s?.total ?? 0);
                  const rolePercent = roleTotal > 0 ? (roleRead / roleTotal) * 100 : 0;

                  return (
                    <div key={role} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-600 capitalize">
                          {role.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-zinc-900">
                          {roleRead}/{roleTotal}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${rolePercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-3">
              <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">By District</h4>
              {byDistrictEntries.length === 0 ? (
                <div className="p-4 text-center text-zinc-400 text-xs font-mono">
                  No district breakdown available.
                </div>
              ) : (
                byDistrictEntries.map(([district, s]) => {
                  const districtRead = Number(s?.read ?? 0);
                  const districtTotal = Number(s?.total ?? 0);
                  const districtPercent = districtTotal > 0 ? (districtRead / districtTotal) * 100 : 0;

                  return (
                    <div key={district} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-600">{district}</span>
                        <span className="font-semibold text-zinc-900">
                          {districtRead}/{districtTotal}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${districtPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Toggleable recipient list */}
          <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-4">
            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 w-fit">
              <button
                onClick={() => setShowList('unread')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  showList === 'unread' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                ○ Unread ({unreadUsers.length})
              </button>
              <button
                onClick={() => setShowList('read')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  showList === 'read' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                ✓ Read ({readUsers.length})
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {activeUsers.length === 0 ? (
                <div className="p-4 text-center text-zinc-400 text-xs font-mono">No {showList} recipients.</div>
              ) : (
                activeUsers.map((u: any) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-zinc-100"
                  >
                    <div>
                      <span className="text-xs font-semibold text-zinc-900">
                        {showList === 'unread' ? '○ ' : '✓ '}{u.name}
                      </span>
                      <span className="block text-[10px] text-zinc-400 font-mono">
                        {u.email}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase text-zinc-400">
                      {u.role ? String(u.role).replace('_', ' ') : 'Unknown'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
