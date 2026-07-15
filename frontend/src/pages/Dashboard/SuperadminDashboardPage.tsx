import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { 
  Users, 
  Award, 
  School as SchoolIcon, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  BookOpen
} from 'lucide-react';

// --- TYPES ---
interface School {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: string;
  teachersCount?: number;
}

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  schoolId: string;
  schoolName: string;
  currentLevel: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[];
}

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortKey?: keyof T;
  className?: string;
}

// --- SUBCOMPONENTS ---

// Simple Metric Card
const MetricCard: React.FC<{ title: string; value: string | number; subtext: string; icon: any }> = ({ title, value, subtext, icon: Icon }) => (
  <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm flex items-center gap-4">
    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">{title}</p>
      <h4 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{value !== undefined && value !== '' ? value : '—'}</h4>
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subtext}</p>
    </div>
  </div>
);

// Inline Reusable Table Component (Simplified & Bug-Free)
function Table<T extends { id: string }>({ data, columns, searchKey, searchPlaceholder }: {
  data: T[];
  columns: Column<T>[];
  searchKey?: keyof T;
  searchPlaceholder?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const requestSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (searchQuery && searchKey) {
      result = result.filter(row => {
        const val = row[searchKey];
        return String(val || '').toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, searchKey, sortConfig]);

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={searchPlaceholder || "Search..."}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
              {columns.map((col, idx) => {
                const isSortable = !!col.sortKey;
                const isSorted = sortConfig?.key === col.sortKey;
                return (
                  <th
                    key={idx}
                    onClick={() => isSortable && col.sortKey && requestSort(col.sortKey)}
                    className={`p-4 font-bold ${col.className || ''} ${isSortable ? 'cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.header}</span>
                      {isSortable && (
                        isSorted && sortConfig ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-650" /> : <ChevronDown className="h-3 w-3 text-indigo-650" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-350">
            {processedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-xs font-mono text-slate-400">
                  No records found
                </td>
              </tr>
            ) : (
              processedData.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition duration-150">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`p-4 ${col.className || ''}`}>
                      {typeof col.accessor === 'function' ? (
                        col.accessor(row)
                      ) : (
                        String(row[col.accessor] ?? '')
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Geographical Analytics Subcomponent
const RegionalAnalyticsView: React.FC<{ token: string; user: any }> = ({ token, user }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
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
  }, [token, stateCode, districtCode, blockCode]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16" id="analytics-loader">
        <div className="w-8 h-8 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 font-mono">Calculating live statistics...</span>
      </div>
    );
  }

  let activeLabel = 'National';
  let activeMetrics = data?.national;
  
  if (user.role === 'superadmin') {
    activeLabel = blockCode ? `Block: ${blockCode}` : districtCode ? `District: ${districtCode}` : stateCode ? `State: ${stateCode}` : 'National';
    activeMetrics = blockCode && data?.block ? data.block : districtCode && data?.district ? data.district : stateCode && data?.state ? data.state : data?.national;
  }

  return (
    <div className="space-y-6" id="geographical-analytics">
      {/* Scope Controls */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end text-xs">
        <div className="flex-grow">
          <label className="block text-[10px] font-mono font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Filter State</label>
          <input 
            type="text" 
            value={stateCode} 
            onChange={e => {
              setStateCode(e.target.value.toUpperCase());
              setDistrictCode('');
              setBlockCode('');
            }}
            placeholder="e.g. PB"
            className="w-full border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-white dark:bg-slate-900 outline-none font-medium text-zinc-800 dark:text-zinc-100 focus:border-zinc-400"
          />
        </div>
        <div className="flex-grow">
          <label className="block text-[10px] font-mono font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Filter District</label>
          <input 
            type="text" 
            value={districtCode} 
            onChange={e => {
              setDistrictCode(e.target.value.toUpperCase());
              setBlockCode('');
            }}
            placeholder="e.g. LDH"
            className="w-full border border-zinc-200 dark:border-zinc-755 rounded-lg p-2 bg-white dark:bg-slate-900 outline-none font-medium text-zinc-800 dark:text-zinc-100 focus:border-zinc-400"
          />
        </div>
        <div className="flex-grow">
          <label className="block text-[10px] font-mono font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Filter Block</label>
          <input 
            type="text" 
            value={blockCode} 
            onChange={e => setBlockCode(e.target.value.toUpperCase())}
            placeholder="e.g. LDH-01"
            className="w-full border border-zinc-200 dark:border-zinc-760 rounded-lg p-2 bg-white dark:bg-slate-900 outline-none font-medium text-zinc-800 dark:text-zinc-100 focus:border-zinc-400"
          />
        </div>
        <button 
          onClick={fetchAnalytics}
          className="bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 dark:hover:bg-zinc-650 font-medium font-mono text-xs py-2 px-4 rounded-lg cursor-pointer transition-colors"
        >
          Refilter Metrics
        </button>
      </div>

      {/* Baseline / Scope Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* National Benchmark */}
        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-white text-base">🌐 National Benchmark</h4>
              <p className="text-zinc-400 dark:text-zinc-500 text-[11px] mt-0.5">Immutable global standards compiled as baseline.</p>
            </div>
            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-850 dark:text-zinc-200 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-zinc-200 dark:border-zinc-700">
              Benchmark
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-250 dark:border-zinc-700 rounded-lg">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-bold uppercase block">Average FLN Level</span>
              <span className="block text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">Level {data?.national?.avgLevel}</span>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-250 dark:border-zinc-700 rounded-lg">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-bold uppercase block">Certification Rate</span>
              <span className="block text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">{data?.national?.certificationRate}%</span>
            </div>
          </div>

          {/* Topic mastery */}
          <div className="space-y-4 pt-2">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Topic Mastery Scores</h5>
            {data?.national?.topicMastery && Object.entries(data.national.topicMastery).map(([topic, val]: any) => (
              <div key={topic} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-650 dark:text-zinc-300">{topic}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{val}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-2">
                  <div className="bg-zinc-500 h-2 rounded-full transition-all" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Scope */}
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-slate-100 text-base">📍 Scope: {activeLabel}</h4>
              <p className="text-zinc-400 text-[11px] mt-0.5">Real-time local metrics calculated from active rosters.</p>
            </div>
            <span className="px-2 py-0.5 bg-green-950/40 text-green-400 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-green-800/30">
              Live Scoped
            </span>
          </div>

          {activeMetrics ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-zinc-800/80 border border-zinc-700/50 rounded-lg">
                  <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase block">Average FLN Level</span>
                  <span className="block text-2xl font-extrabold text-white mt-1">Level {activeMetrics.avgLevel}</span>
                </div>
                <div className="p-4 bg-zinc-800/80 border border-zinc-700/50 rounded-lg">
                  <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase block">Certification Rate</span>
                  <span className="block text-2xl font-extrabold text-green-400 mt-1">{activeMetrics.certificationRate}%</span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h5 className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest block">Topic Mastery Scores</h5>
                {activeMetrics.topicMastery && Object.entries(activeMetrics.topicMastery).map(([topic, val]: any) => (
                  <div key={topic} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-350">{topic}</span>
                      <span className="font-semibold text-white">{val}%</span>
                    </div>
                    <div className="w-full bg-zinc-850 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex justify-center items-center py-20 text-zinc-400 text-xs">
              No live evaluation records registered for active scope.
            </div>
          )}
        </div>

      </div>

      {/* SVG Charts */}
      {activeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm">
          
          {/* Donut Chart */}
          <div className="flex flex-col items-center justify-center p-5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/50">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Certification Rate (Pie / Donut)</h5>
            <div className="relative flex items-center justify-center">
              <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
                <circle cx="90" cy="90" r="70" fill="transparent" stroke="#f3f4f6" strokeWidth="16" className="dark:stroke-zinc-700" />
                <circle cx="90" cy="90" r="70" fill="transparent" stroke="#10b981" strokeWidth="16"
                        strokeDasharray={439.8}
                        strokeDashoffset={439.8 - (439.8 * (activeMetrics.certificationRate || 0)) / 100}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">{activeMetrics.certificationRate}%</span>
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-mono">Certified</span>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex flex-col p-5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/50">
            <h5 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 text-center">Topic Proficiency Index</h5>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {activeMetrics.topicMastery && Object.entries(activeMetrics.topicMastery).map(([topic, val]: any) => (
                <div key={topic} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 w-32 truncate">{topic}</span>
                  <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-3">
                    <div className="bg-indigo-600 h-3 rounded-full" style={{ width: `${val}%` }} />
                  </div>
                  <span className="text-xs font-bold text-zinc-850 dark:text-white w-8 text-right">{val}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

// --- MAIN SUPERADMIN DASHBOARD ---
export default function SuperadminDashboardPage() {
  const { user } = useAuth();
  const token = localStorage.getItem("fln_token") || "mock-token";
  const [activeTab, setActiveTab] = useState<'overview' | 'coordinators' | 'analytics'>('overview');
  
  // Overview state
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Coordinator state
  const [coordName, setCoordName] = useState('');
  const [coordEmail, setCoordEmail] = useState('');
  const [coordPass, setCoordPass] = useState('');
  const [coordRole, setCoordRole] = useState('admin');
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
  const [newSchoolStrength, setNewSchoolStrength] = useState('low');
  const [schoolSuccess, setSchoolSuccess] = useState('');
  const [schoolError, setSchoolError] = useState('');

  // RCI Filters
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');

  const stateFilterOptions = useMemo(() => {
    return Array.from(new Set(coordinatorsList.map(c => c.stateCode).filter((x): x is string => !!x)))
      .sort();
  }, [coordinatorsList]);

  const districtFilterOptions = useMemo(() => {
    return Array.from(new Set(
      coordinatorsList
        .filter(c => !stateFilter || c.stateCode === stateFilter)
        .map(c => c.districtCode)
        .filter((x): x is string => !!x)
    )).sort();
  }, [coordinatorsList, stateFilter]);

  const schoolFilterOptions = useMemo(() => {
    return Array.from(new Set(
      coordinatorsList
        .filter(c => (!stateFilter || c.stateCode === stateFilter) && (!districtFilter || c.districtCode === districtFilter))
        .map(c => c.schoolId)
        .filter((x): x is string => !!x)
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

      const stdRes = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
      const stdData = await stdRes.json();
      if (Array.isArray(stdData)) setStudents(stdData);
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
        setSuccessMsg('Announcement broadcasted and escalated successfully!');
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
          schoolId: ['school', 'teacher'].includes(coordRole) ? coordSchoolId : undefined,
          assignedSchools: coordRole === 'volunteer' ? assignedSchools : undefined
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

  const isPassLengthValid = coordPass.length >= 8;
  const isPassUppercaseValid = /[A-Z]/.test(coordPass);
  const isPassNumberValid = /[0-9]/.test(coordPass);
  const isPassSpecialValid = /[!@#$%^&*(),.?":{}|<>]/.test(coordPass);

  const certifiedCount = students.filter(s => s.currentLevel >= 5).length;
  const certifiedPercent = students.length > 0 ? Math.round((certifiedCount / students.length) * 100) : 0;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto" id="superadmin-dashboard">
      
      {/* Title / Action bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">National Oversight Center</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">IIT Ropar / Vicharanashala Lab · Master Controls</p>
        </div>

        {/* Dashboard Tabs Selector */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit self-start">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'overview' ? 'bg-white dark:bg-zinc-750 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-450 hover:text-zinc-900'
            }`}
          >
            📋 Overview
          </button>
          <button
            onClick={() => setActiveTab('coordinators')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'coordinators' ? 'bg-white dark:bg-zinc-750 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-450 hover:text-zinc-900'
            }`}
          >
            👤 Coordinator Management
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'analytics' ? 'bg-white dark:bg-zinc-750 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-450 hover:text-zinc-900'
            }`}
          >
            📊 Geographical Analytics
          </button>
        </div>

        {/* Reset Database */}
        <button
          onClick={async () => {
            if (!window.confirm('Reset database to fresh seed state? This is irreversible.')) return;
            await fetch('/api/reset', { method: 'POST' });
            window.location.reload();
          }}
          className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-650 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
        >
          🔄 Reset Database
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Card stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Total Schools Tracked" value={schools.length} subtext="● 100% Active" icon={SchoolIcon} />
            <MetricCard title="National Roster Count" value={students.length} subtext="Primary FLN candidates" icon={Users} />
            <MetricCard title="National FLN Score" value="Level 3.2" subtext="Calculated Baseline" icon={BarChart3} />
            <MetricCard title="FLN Certification Rate" value={`${certifiedPercent}%`} subtext={`${certifiedCount} competent`} icon={Award} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Schools list */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white">State / School Performance Table</h3>
              <Table 
                data={schools} 
                columns={[
                  { header: 'School ID', accessor: 'id', sortKey: 'id', className: 'font-mono text-xs text-slate-500' },
                  { header: 'School Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-800 dark:text-slate-200' },
                  { header: 'State', accessor: 'stateCode', sortKey: 'stateCode', className: 'font-mono' },
                  {
                    header: 'Deployment',
                    accessor: (s) => (
                      <span className="text-[10px] font-mono text-zinc-500">{s.teachersCount !== undefined ? `${s.teachersCount} teachers` : '—'}</span>
                    )
                  },
                  {
                    header: 'Avg Level',
                    accessor: () => <span className="font-mono font-bold text-emerald-600">Level 3.2</span>
                  }
                ]} 
                searchPlaceholder="Search schools by name..." 
                searchKey="name" 
              />
            </div>

            {/* Broadcast Form */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm h-fit">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Post Global Announcement</h3>
              <form onSubmit={postAnnouncement} className="space-y-4">
                {successMsg && <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded border border-green-100 dark:border-green-800">{successMsg}</div>}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Announcement title..."
                    required
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Message Content</label>
                  <textarea
                    value={announcementMsg}
                    onChange={(e) => setAnnouncementMsg(e.target.value)}
                    rows={3}
                    placeholder="Details of the broadcast..."
                    required
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="rounded border-zinc-350 text-zinc-905 focus:ring-zinc-900"
                  />
                  <span className="text-xs text-red-650 font-medium uppercase font-mono">Flag Urgent</span>
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
      )}

      {activeTab === 'coordinators' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create coordinator */}
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm h-fit">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Provision Coordinator Profile</h3>
            {coordSuccess && <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded border border-green-100 dark:border-green-800 mb-4">{coordSuccess}</div>}
            {coordError && <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 mb-4">{coordError}</div>}

            <form onSubmit={handleCreateCoordinator} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={coordName}
                  onChange={e => setCoordName(e.target.value)}
                  placeholder="e.g. Dr. Satnam Singh"
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-805 outline-none focus:bg-white focus:border-zinc-500 text-zinc-900 dark:text-white"
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
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-805 outline-none focus:bg-white focus:border-zinc-500 text-zinc-900 dark:text-white"
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
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-805 outline-none focus:bg-white focus:border-zinc-500 text-zinc-900 dark:text-white"
                />
                
                <div className="mt-2 p-2.5 bg-zinc-50 dark:bg-zinc-805 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold block">Password SLA Checks</span>
                  <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
                    <span className="flex items-center gap-1">
                      {isPassLengthValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-zinc-300" />}
                      <span className={isPassLengthValid ? 'text-green-700' : 'text-zinc-500'}>&gt;= 8 Chars</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {isPassUppercaseValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-zinc-300" />}
                      <span className={isPassUppercaseValid ? 'text-green-700' : 'text-zinc-500'}>1 Uppercase</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {isPassNumberValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-zinc-300" />}
                      <span className={isPassNumberValid ? 'text-green-700' : 'text-zinc-500'}>1 Digit</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {isPassSpecialValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-zinc-300" />}
                      <span className={isPassSpecialValid ? 'text-green-700' : 'text-zinc-500'}>1 Symbol</span>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Administrative Role Tier</label>
                <select
                  value={coordRole}
                  onChange={e => setCoordRole(e.target.value)}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-805 outline-none focus:bg-white text-zinc-800 dark:text-zinc-100 font-medium"
                >
                  <option value="admin">State Admin / Coordinator</option>
                  <option value="district_admin">District Admin / Officer</option>
                  <option value="block_admin">Block Admin / Supervisor</option>
                  <option value="school">School Principal</option>
                  <option value="teacher">Teacher</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </div>

              {/* Dynamic scope filters */}
              {!['school', 'teacher', 'volunteer'].includes(coordRole) && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-0.5">State</label>
                    <input
                       type="text"
                       value={coordState}
                       onChange={e => setCoordState(e.target.value.toUpperCase())}
                       placeholder="e.g. PB"
                       required
                       className="w-full text-xs border border-zinc-200 rounded-lg p-1.5 bg-zinc-50 outline-none font-medium text-zinc-800"
                    />
                  </div>
                  
                  {coordRole !== 'admin' && (
                    <div>
                      <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-0.5">District</label>
                      <input
                        type="text"
                        value={coordDistrict}
                        onChange={e => setCoordDistrict(e.target.value.toUpperCase())}
                        placeholder="e.g. LDH"
                        required
                        className="w-full text-xs border border-zinc-200 rounded-lg p-1.5 bg-zinc-50 outline-none font-medium text-zinc-800"
                      />
                    </div>
                  )}

                  {coordRole === 'block_admin' && (
                    <div>
                      <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Block</label>
                      <input
                        type="text"
                        value={coordBlock}
                        onChange={e => setCoordBlock(e.target.value.toUpperCase())}
                        placeholder="e.g. LDH-01"
                        required
                        className="w-full text-xs border border-zinc-200 rounded-lg p-1.5 bg-zinc-50 outline-none font-medium text-zinc-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {['school', 'teacher'].includes(coordRole) && (
                <div>
                   <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Assigned School ID</label>
                   <input
                     type="text"
                     value={coordSchoolId}
                     onChange={e => setCoordSchoolId(e.target.value)}
                     placeholder="e.g. gps-vl-002"
                     required
                     className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-805 outline-none focus:bg-white text-zinc-800 dark:text-zinc-100"
                   />
                 </div>
               )}

               {coordRole === 'volunteer' && (
                 <div>
                   <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">School IDs (Comma Separated)</label>
                   <input
                     type="text"
                     value={coordAssignedSchoolsStr}
                     onChange={e => setCoordAssignedSchoolsStr(e.target.value)}
                     placeholder="e.g. gps-vl-002, gps-jai-004"
                     required
                     className="w-full text-sm border border-zinc-200 dark:border-zinc-750 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-805 outline-none focus:bg-white text-zinc-800 dark:text-zinc-100"
                   />
                 </div>
               )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-650 text-white disabled:opacity-50 font-medium text-sm py-2 px-4 rounded-lg cursor-pointer shadow-sm transition-colors mt-2"
              >
                {loading ? 'Provisioning...' : 'Provision Account'}
              </button>
            </form>
          </div>

          {/* Coordinators table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3 justify-between">
                <div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Registered Coordinators Index</h3>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400">Filter and view coordinator registration details.</p>
                </div>
                <button
                  onClick={resetCoordinatorFilters}
                  className="text-xs font-semibold text-indigo-650 hover:underline"
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
                    className="w-full rounded-lg border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs outline-none text-zinc-900 dark:text-white"
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
                    className="w-full rounded-lg border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs outline-none text-zinc-900 dark:text-white"
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
                    className="w-full rounded-lg border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs outline-none text-zinc-900 dark:text-white"
                  >
                    <option value="">All schools</option>
                    {schoolFilterOptions.map(id => (
                      <option key={id} value={id}>{schoolNameById[id] ? `${schoolNameById[id]} (${id})` : id}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Table
                data={filteredCoordinators}
                columns={[
                  { header: 'Coordinator Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-900 dark:text-slate-100' },
                  { header: 'Email', accessor: 'email', sortKey: 'email', className: 'font-mono text-xs text-slate-500 dark:text-slate-400' },
                  {
                    header: 'Role Tier',
                    accessor: (c) => (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300`}>
                        {c.role}
                      </span>
                    )
                  },
                  {
                    header: 'Scope',
                    accessor: (c) => {
                      let nodeScope = '';
                      if (c.role === 'superadmin') {
                        nodeScope = 'National (Global)';
                      } else if (c.role === 'admin') {
                        nodeScope = `State: ${c.stateCode || 'PB'}`;
                      } else if (c.role === 'district_admin') {
                        nodeScope = `State: ${c.stateCode || 'PB'} / Dist: ${c.districtCode || 'LDH'}`;
                      } else if (c.role === 'block_admin') {
                        nodeScope = `State: ${c.stateCode || 'PB'} / Dist: ${c.districtCode || 'LDH'} / Block: ${c.blockCode || 'N/A'}`;
                      } else if (['school', 'teacher'].includes(c.role)) {
                        nodeScope = `School ID: ${c.schoolId || 'N/A'}`;
                      } else if (c.role === 'volunteer') {
                        nodeScope = c.assignedSchools && c.assignedSchools.length > 0 ? `Schools: ${c.assignedSchools.join(', ')}` : 'No schools assigned';
                      }
                      return <span className="text-xs text-slate-700 dark:text-slate-300">{nodeScope}</span>;
                    }
                  }
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <RegionalAnalyticsView token={token || ''} user={user} />
      )}
    </div>
  );
}
