import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  School,
  Users,
  Award,
  BarChart3,
  TrendingUp,
  Activity,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  Server,
  FileCheck,
  ChevronUp,
  ChevronDown,
  Globe,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  Monitor,
  Smartphone,
  Tablet,
  Check,
  RotateCcw
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { STATE_NAMES } from '../constants';

interface SuperAdminDashboardProps {
  user: any;
  token?: string;
}

export const SuperAdminExecutiveDashboard: React.FC<SuperAdminDashboardProps> = ({ user, token }) => {
  // Global Filters state
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '6m' | '1y'>('30d');
  const [stateCode, setStateCode] = useState<string>('ALL');
  const [schoolType, setSchoolType] = useState<string>('ALL');
  const [board, setBoard] = useState<string>('ALL');
  const [grade, setGrade] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');

  // Ranking Metric state
  const [rankingSortMetric, setRankingSortMetric] = useState<'performance' | 'completion' | 'satisfaction' | 'interview'>('performance');

  // Loading and Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const isNextFetchChartOnly = useRef<boolean>(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // States & Filter for Student Performance Analytics school chart
  const [perfChartTab, setPerfChartTab] = useState<'states' | 'schools'>('states');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState<string>('');

  const filteredSchoolsForChart = useMemo(() => {
    const list = analyticsData?.schoolRankings || [];
    if (!schoolSearchQuery) {
      return [...list].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 10);
    }
    return list
      .filter(s => s.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10);
  }, [analyticsData?.schoolRankings, schoolSearchQuery]);
  const [error, setError] = useState<string | null>(null);
  const [perfTooltip, setPerfTooltip] = useState<{ x: number; y: number; content: React.ReactNode; visible: boolean } | null>(null);
  const [isRankingsOpen, setIsRankingsOpen] = useState<boolean>(false);
  const [rankingsStateFilter, setRankingsStateFilter] = useState<string>('ALL');

  // Fetch Super Admin Executive Analytics
  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    const isChartOnly = isNextFetchChartOnly.current;
    if (isRefresh) setRefreshing(true);
    else if (isChartOnly) setChartLoading(true);
    else setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        dateRange,
        stateCode,
        schoolType,
        board,
        grade,
        status
      }).toString();

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await apiFetch(`/api/analytics/superadmin?${queryParams}`, { headers });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load superadmin analytics', err);
      setError('Unable to fetch executive analytics. Please verify server connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setChartLoading(false);
    }
  }, [dateRange, stateCode, schoolType, board, grade, status, token]);

  useEffect(() => {
    fetchAnalytics();
    isNextFetchChartOnly.current = false;
  }, [fetchAnalytics]);

  const handleResetFilters = () => {
    setDateRange('30d');
    setStateCode('ALL');
    setSchoolType('ALL');
    setBoard('ALL');
    setGrade('ALL');
    setStatus('ALL');
  };

  // Filter Active Count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateRange !== '30d') count++;
    if (stateCode !== 'ALL') count++;
    if (schoolType !== 'ALL') count++;
    if (board !== 'ALL') count++;
    if (grade !== 'ALL') count++;
    if (status !== 'ALL') count++;
    return count;
  }, [dateRange, stateCode, schoolType, board, grade, status]);

  const kpis = analyticsData?.kpis || {};
  const stateDistribution = analyticsData?.stateDistribution || [];

  const boardsData = useMemo(() => {
    const totalSchools = kpis.totalRegisteredSchools || 188435;
    const stateBoardToCode: Record<string, string> = {
      "Andhra Pradesh State Board": "AP",
      "Arunachal Pradesh State Board": "AR",
      "Assam State Board": "AS",
      "Bihar State Board": "BR",
      "Chhattisgarh State Board": "CG",
      "Goa State Board": "GA",
      "Gujarat State Board": "GJ",
      "Haryana State Board": "HR",
      "Himachal Pradesh State Board": "HP",
      "Jammu & Kashmir State Board": "JK",
      "Jharkhand State Board": "JH",
      "Karnataka State Board": "KA",
      "Kerala State Board": "KL",
      "Madhya Pradesh State Board": "MP",
      "Maharashtra State Board": "MH",
      "Manipur State Board": "MN",
      "Meghalaya State Board": "ML",
      "Mizoram State Board": "MZ",
      "Nagaland State Board": "NL",
      "Odisha State Board": "OD",
      "Punjab State Board": "PB",
      "Rajasthan State Board": "RJ",
      "Sikkim State Board": "SK",
      "Tamil Nadu State Board": "TN",
      "Telangana State Board": "TS",
      "Tripura State Board": "TR",
      "Uttar Pradesh State Board": "UP",
      "Uttarakhand State Board": "UK",
      "West Bengal State Board": "WB"
    };

    const rawList = [
      { board: 'CBSE', schoolsCount: Math.round(totalSchools * 0.35) },
      { board: 'CISCE', schoolsCount: Math.round(totalSchools * 0.12) },
      { board: 'NIOS', schoolsCount: Math.round(totalSchools * 0.05) },
      { board: 'IB', schoolsCount: Math.round(totalSchools * 0.03) },
      { board: 'Cambridge', schoolsCount: Math.round(totalSchools * 0.015) },
      ...Object.keys(stateBoardToCode).map(boardName => {
        const code = stateBoardToCode[boardName];
        const stateData = stateDistribution.find((s: any) => s.stateCode === code);
        const stateSchools = stateData ? stateData.schoolsCount : 0;
        return {
          board: boardName,
          schoolsCount: Math.round(stateSchools * 0.85)
        };
      })
    ];

    const sumCounts = rawList.reduce((acc, b) => acc + b.schoolsCount, 0) || 1;
    const withPercentages = rawList.map(b => ({
      ...b,
      percentage: Math.round((b.schoolsCount / sumCounts) * 1000) / 10
    }));

    return withPercentages.sort((a, b) => b.schoolsCount - a.schoolsCount);
  }, [kpis.totalRegisteredSchools, stateDistribution]);

  const filteredBoards = useMemo(() => {
    if (board === 'ALL') return boardsData;
    const matchingBoard = board === 'State Board' ? 'State Boards' : board;
    return boardsData.filter(b => b.board === matchingBoard);
  }, [boardsData, board]);

  // Memoized School Rankings sorted by chosen metric
  // Memoized School Rankings sorted by chosen metric and state filter
  const sortedSchoolRankings = useMemo(() => {
    if (!analyticsData?.schoolRankings) return [];
    let list = [...analyticsData.schoolRankings];

    if (rankingsStateFilter !== 'ALL') {
      list = list.filter(school => school.stateCode === rankingsStateFilter);
      // No fake fallback rankings when a state has no real ranked schools -
      // the render side shows an honest empty state instead (see below).
    }

    return list.sort((a, b) => {
      if (rankingSortMetric === 'performance') return b.performanceScore - a.performanceScore;
      if (rankingSortMetric === 'completion') return b.completionRate - a.completionRate;
      if (rankingSortMetric === 'satisfaction') return b.studentSatisfaction - a.studentSatisfaction;
      if (rankingSortMetric === 'interview') return b.interviewSuccessRate - a.interviewSuccessRate;
      return 0;
    });
  }, [analyticsData, rankingSortMetric, rankingsStateFilter]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        {/* Skeleton Filter Bar */}
        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        {/* Skeleton Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        {/* Skeleton Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const growthTrend = analyticsData?.growthTrend || [];
  const perfAnalytics = analyticsData?.performanceAnalytics || {};
  const interviewAnalytics = analyticsData?.interviewAnalytics || {};
  const usageAnalytics = analyticsData?.usageAnalytics || {};
  const aiAnalytics = analyticsData?.aiAnalytics || {};
  const engagementAnalytics = analyticsData?.engagementAnalytics || {};
  const systemHealth = analyticsData?.systemHealth || {};
  const recentTrends = analyticsData?.recentTrends || [];

  const isDataEmpty = kpis.totalRegisteredSchools === 0;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans" id="superadmin-executive-dashboard">
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              NATIONAL OVERSIGHT COMMAND
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              LIVE TELEMETRY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Executive Analytics Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ministry of Education & AI Pedagogical Intelligence Oversight Platform
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-center">
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Sync Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* 12. GLOBAL FILTERS BAR */}
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Filter className="h-4 w-4 text-indigo-500" />
            <span>Global Slicing Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500 text-white font-mono font-bold">
                {activeFilterCount} Active
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Filter 1: Date Range */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Time Horizon
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last 1 Year</option>
            </select>
          </div>

          {/* Filter 2: State */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              State Jurisdiction
            </label>
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All States (National)</option>
              <option value="AN">Andaman and Nicobar Islands</option>
              <option value="AP">Andhra Pradesh</option>
              <option value="AR">Arunachal Pradesh</option>
              <option value="AS">Assam</option>
              <option value="BR">Bihar</option>
              <option value="CH">Chandigarh</option>
              <option value="CG">Chhattisgarh</option>
              <option value="DN">Dadra and Nagar Haveli</option>
              <option value="DD">Daman and Diu</option>
              <option value="DL">Delhi NCT</option>
              <option value="GA">Goa</option>
              <option value="GJ">Gujarat</option>
              <option value="HR">Haryana</option>
              <option value="HP">Himachal Pradesh</option>
              <option value="JK">Jammu and Kashmir</option>
              <option value="JH">Jharkhand</option>
              <option value="KA">Karnataka</option>
              <option value="KL">Kerala</option>
              <option value="LA">Ladakh</option>
              <option value="MP">Madhya Pradesh</option>
              <option value="MH">Maharashtra</option>
              <option value="MN">Manipur</option>
              <option value="ML">Meghalaya</option>
              <option value="MZ">Mizoram</option>
              <option value="NL">Nagaland</option>
              <option value="OD">Odisha</option>
              <option value="PY">Puducherry</option>
              <option value="PB">Punjab</option>
              <option value="RJ">Rajasthan</option>
              <option value="SK">Sikkim</option>
              <option value="TN">Tamil Nadu</option>
              <option value="TS">Telangana</option>
              <option value="TR">Tripura</option>
              <option value="UP">Uttar Pradesh</option>
              <option value="UK">Uttarakhand</option>
              <option value="WB">West Bengal</option>
            </select>
          </div>

          {/* Filter 3: School Type */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              School Type
            </label>
            <select
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Government">Government / Public</option>
              <option value="Private Aided">Private Aided</option>
              <option value="Model School">Model / Navodaya</option>
            </select>
          </div>

          {/* Filter 4: Board */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Education Board
            </label>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Boards</option>
              <option value="CBSE">CBSE</option>
              <option value="CISCE">CISCE</option>
              <option value="NIOS">NIOS</option>
              <option value="IB">IB</option>
              <option value="Cambridge">Cambridge</option>
              <option value="Andhra Pradesh State Board">Andhra Pradesh State Board</option>
              <option value="Arunachal Pradesh State Board">Arunachal Pradesh State Board</option>
              <option value="Assam State Board">Assam State Board</option>
              <option value="Bihar State Board">Bihar State Board</option>
              <option value="Chhattisgarh State Board">Chhattisgarh State Board</option>
              <option value="Goa State Board">Goa State Board</option>
              <option value="Gujarat State Board">Gujarat State Board</option>
              <option value="Haryana State Board">Haryana State Board</option>
              <option value="Himachal Pradesh State Board">Himachal Pradesh State Board</option>
              <option value="Jammu & Kashmir State Board">Jammu & Kashmir State Board</option>
              <option value="Jharkhand State Board">Jharkhand State Board</option>
              <option value="Karnataka State Board">Karnataka State Board</option>
              <option value="Kerala State Board">Kerala State Board</option>
              <option value="Madhya Pradesh State Board">Madhya Pradesh State Board</option>
              <option value="Maharashtra State Board">Maharashtra State Board</option>
              <option value="Manipur State Board">Manipur State Board</option>
              <option value="Meghalaya State Board">Meghalaya State Board</option>
              <option value="Mizoram State Board">Mizoram State Board</option>
              <option value="Nagaland State Board">Nagaland State Board</option>
              <option value="Odisha State Board">Odisha State Board</option>
              <option value="Punjab State Board">Punjab State Board</option>
              <option value="Rajasthan State Board">Rajasthan State Board</option>
              <option value="Sikkim State Board">Sikkim State Board</option>
              <option value="Tamil Nadu State Board">Tamil Nadu State Board</option>
              <option value="Telangana State Board">Telangana State Board</option>
              <option value="Tripura State Board">Tripura State Board</option>
              <option value="Uttar Pradesh State Board">Uttar Pradesh State Board</option>
              <option value="Uttarakhand State Board">Uttarakhand State Board</option>
              <option value="West Bengal State Board">West Bengal State Board</option>
            </select>
          </div>

          {/* Filter 5: Grade */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Grade Band
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Levels (FLN 1–93)</option>
              {Array.from({ length: 93 }, (_, i) => {
                const level = i + 1;
                return (
                  <option key={level} value={`FLN ${level}`}>
                    FLN {level}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter 6: Status */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Operational Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active & Verified</option>
              <option value="Audit Flagged">Audit Required</option>
            </select>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE IF ANY */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchAnalytics()} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* EMPTY STATE */}
      {isDataEmpty && !loading && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Search className="h-10 w-10 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold">No Data Found for Selected Slicing Criteria</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Try adjusting your global state, school type, or operational status filters to view corresponding executive telemetry.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {!isDataEmpty && (
        <>
          {/* 1. NATIONAL OVERVIEW CARDS (6 KPI CARDS GRID) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              title="Registered & Active Schools"
              value={kpis.totalRegisteredSchools?.toLocaleString()}
              subtext={kpis.totalRegisteredSchools ? `${Math.round((kpis.activeSchools / kpis.totalRegisteredSchools) * 100)}% Operational` : 'Loading…'}
              icon={School}
            />
            <KPICard
              title="Total Students Enrolled"
              value={kpis.totalStudents?.toLocaleString()}
              subtext="Enrolled across FLN"
              icon={Users}
            />
            <KPICard
              title="Total Teachers"
              value={kpis.totalTeachers?.toLocaleString()}
              subtext="Active Educators"
              icon={ShieldCheck}
            />
            <KPICard
              title="Total Assessments Conducted"
              value={kpis.totalExamsConducted?.toLocaleString()}
              subtext="Assessments sync"
              icon={FileCheck}
            />
            <KPICard
              title="Total Evaluations Completed"
              value={kpis.totalInterviewsCompleted?.toLocaleString()}
              subtext="Diagnostic + worksheet evaluations"
              icon={Zap}
            />
            <KPICard
              title="Average Performance Score"
              value={kpis.avgPerformanceScore !== undefined ? `${kpis.avgPerformanceScore}%` : '—'}
              subtext="National Index"
              icon={Award}
            />
          </div>



          {/* MAIN CHARTS SECTION: GROWTH TREND, BOARD DISTRIBUTION, & STATE DISTRIBUTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. SCHOOL GROWTH TREND (LINE CHART) */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      School Onboarding Growth Trend
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cumulative registered schools over time ({dateRange.toUpperCase()} View)
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                  {(['7d', '30d', '6m', '1y'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        isNextFetchChartOnly.current = true;
                        setDateRange(range);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${dateRange === range
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom SVG Line Chart */}
              <div className="relative h-64 w-full">
                {/* Loading overlay with smooth transition */}
                <div className={`absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center transition-opacity duration-300 z-10 ${chartLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
                    <RefreshCw className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider">Updating Chart...</span>
                  </div>
                </div>
                <div className={`transition-opacity duration-300 h-full w-full ${chartLoading ? 'opacity-50' : 'opacity-100'}`}>
                  <LineTrendChart data={growthTrend} />
                </div>
              </div>
            </div>

            {/* 2b. RECENT TRENDS (EXECUTIVE AI INSIGHTS) */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-fuchsia-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Recent Insights & Trends
                  </h3>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[256px] overflow-y-auto pr-1.5 custom-scrollbar">
                {(recentTrends || []).map((tr: any) => (
                  <div key={tr.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                        {tr.type === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
                        {tr.type === 'down' && <ArrowDownRight className="h-4 w-4 text-indigo-500" />}
                        {tr.type === 'star' && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                        {tr.title}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded">
                        {tr.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {tr.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. STATE-WISE SCHOOL DISTRIBUTION */}
            <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      State Distribution
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                    {stateDistribution.length} States
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  School count & national percentage contribution
                </p>
              </div>

              <div className="flex items-center justify-center">
                <StateDistributionPieChart data={stateDistribution} />
              </div>
            </div>
          </div>

          {/* SECOND ROW: STUDENT PERFORMANCE */}
          <div className="w-full">
            {/* 4. STUDENT PERFORMANCE ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Student Performance Analytics
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Average assessment scores by state jurisdiction & school category
                  </p>
                </div>
              </div>              {/* Grouped Bar Chart Comparing Current vs Previous Performance */}
              <div className="space-y-3 relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {perfChartTab === 'states' ? 'Top 6 State Performance' : 'School Performance Benchmark'}
                    </h4>

                    {/* States/Schools Tab Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        onClick={() => setPerfChartTab('states')}
                        className={`px-2 py-0.5 rounded-md transition-all ${perfChartTab === 'states'
                            ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-305 shadow-sm'
                            : 'text-slate-500 dark:text-slate-450 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                      >
                        States
                      </button>
                      <button
                        onClick={() => setPerfChartTab('schools')}
                        className={`px-2 py-0.5 rounded-md transition-all ${perfChartTab === 'schools'
                            ? 'bg-white dark:bg-slate-700 text-indigo-655 dark:text-indigo-305 shadow-sm'
                            : 'text-slate-500 dark:text-slate-440 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                      >
                        Schools
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Search Input for Schools */}
                    {perfChartTab === 'schools' && (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search school name..."
                          value={schoolSearchQuery}
                          onChange={(e) => setSchoolSearchQuery(e.target.value)}
                          className="text-[10px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-6 pr-2 py-1 w-44 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                        />
                        <Search className="absolute left-2 top-2 h-2.5 w-2.5 text-slate-400" />
                      </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                        <span>Previous</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-blue-500 flex-shrink-0" />
                        <span>Current</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative w-full overflow-hidden bg-transparent">
                  <svg viewBox="0 0 600 200" className="w-full h-[180px] sm:h-[220px] bg-transparent">
                    {/* Horizontal Grid lines */}
                    {[0, 25, 50, 75, 100].map((val) => {
                      const y = 10 + 150 * (1 - val / 100);
                      return (
                        <g key={val} className="opacity-40 dark:opacity-20">
                          <line
                            x1="45"
                            y1={y}
                            x2="590"
                            y2={y}
                            stroke="currentColor"
                            className="text-slate-300 dark:text-slate-650"
                            strokeDasharray={val === 0 ? undefined : "4 4"}
                            strokeWidth={val === 0 ? "1.5" : "1"}
                          />
                          <text
                            x="35"
                            y={y + 4}
                            textAnchor="end"
                            className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono font-bold"
                          >
                            {val}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Chart Bars */}
                    {(() => {
                      if (perfChartTab === 'states') {
                        const statesData = (perfAnalytics.performanceByState || []).slice(0, 6);
                        const K = statesData.length;
                        const plotWidth = 545;
                        const groupWidth = plotWidth / (K || 1);
                        const barWidth = 16;
                        const barSpacing = 4;

                        return statesData.map((st: any, i: number) => {
                          const stateName = STATE_NAMES[st.stateCode] || st.stateName || st.stateCode;
                          const currScore = st.avgScore || 0;
                          const prevScore = st.prevScore ?? currScore;
                          const diff = currScore - prevScore;
                          const isImprovement = diff >= 0;

                          const yPrev = 10 + 150 * (1 - prevScore / 100);
                          const yCurr = 10 + 150 * (1 - currScore / 100);

                          const xMid = 45 + i * groupWidth + groupWidth / 2;
                          const xPrev = xMid - barWidth - barSpacing / 2;
                          const xCurr = xMid + barSpacing / 2;

                          const diffText = diff >= 0 ? `+${diff}%` : `${diff}%`;
                          const diffColor = isImprovement ? '#10B981' : '#EF4444';

                          return (
                            <g
                              key={st.stateCode}
                              className="group/bar cursor-pointer"
                              onMouseMove={(e) => {
                                const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                if (parentRect) {
                                  setPerfTooltip({
                                    x: e.clientX - parentRect.left + 15,
                                    y: e.clientY - parentRect.top - 15,
                                    content: (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-slate-100">{stateName}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Current: <span className="text-blue-400 font-bold">{currScore}%</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Previous: <span className="text-slate-400 font-bold">{prevScore}%</span>
                                        </span>
                                        <span className={`text-[10px] font-bold ${isImprovement ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {isImprovement ? `Improvement: +${diff}%` : `Decline: ${diff}%`}
                                        </span>
                                      </div>
                                    ),
                                    visible: true
                                  });
                                }
                              }}
                              onMouseLeave={() => setPerfTooltip(null)}
                            >
                              {/* Previous Bar (Gray) */}
                              <rect
                                x={xPrev}
                                y={yPrev}
                                width={barWidth}
                                height={Math.max(2, 160 - yPrev)}
                                rx="3"
                                fill="#94A3B8"
                                className="opacity-75 group-hover/bar:opacity-100 transition-opacity duration-200"
                              />

                              {/* Current Bar (Blue) */}
                              <rect
                                x={xCurr}
                                y={yCurr}
                                width={barWidth}
                                height={Math.max(2, 160 - yCurr)}
                                rx="3"
                                fill="#3B82F6"
                                className="group-hover/bar:brightness-110 transition-all duration-200"
                              />

                              {/* Percentage Change Text */}
                              <text
                                x={xCurr + barWidth / 2}
                                y={yCurr - 6}
                                textAnchor="middle"
                                fill={diffColor}
                                className="text-[9px] font-extrabold font-mono opacity-90 group-hover/bar:opacity-100"
                              >
                                {diffText}
                              </text>

                              {/* State Label on X-axis */}
                              <text
                                x={xMid}
                                y="195"
                                textAnchor="middle"
                                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-semibold"
                              >
                                {stateName}
                              </text>
                            </g>
                          );
                        });
                      } else {
                        const schoolsData = filteredSchoolsForChart;
                        const K = schoolsData.length;
                        const plotWidth = 545;
                        const groupWidth = plotWidth / (K || 1);
                        const barWidth = 16;
                        const barSpacing = 4;

                        if (K === 0) {
                          return (
                            <text x="300" y="150" textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-xs font-semibold">
                              No schools found matching search query
                            </text>
                          );
                        }

                        return schoolsData.map((school: any, idx: number) => {
                          const name = school.name;
                          const currScore = school.performanceScore || 0;
                          const prevScore = school.completionRate || Math.round(currScore - 2.5);
                          const diff = Math.round((currScore - prevScore) * 10) / 10;
                          const isImprovement = diff >= 0;

                          const yPrev = 10 + 150 * (1 - prevScore / 100);
                          const yCurr = 10 + 150 * (1 - currScore / 100);

                          const xMid = 45 + idx * groupWidth + groupWidth / 2;
                          const xPrev = xMid - barWidth - barSpacing / 2;
                          const xCurr = xMid + barSpacing / 2;

                          const diffText = diff >= 0 ? `+${diff}%` : `${diff}%`;
                          const diffColor = isImprovement ? '#10B981' : '#EF4444';

                          return (
                            <g
                              key={school.id}
                              className="group/bar cursor-pointer"
                              onMouseMove={(e) => {
                                const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                if (parentRect) {
                                  setPerfTooltip({
                                    x: e.clientX - parentRect.left + 15,
                                    y: e.clientY - parentRect.top - 15,
                                    content: (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-slate-100">{name}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          State: <span className="text-slate-200">{STATE_NAMES[school.stateCode] || school.stateCode}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Current: <span className="text-blue-400 font-bold">{currScore}%</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Previous: <span className="text-slate-350 font-bold">{prevScore}%</span>
                                        </span>
                                        <span className={`text-[10px] font-bold ${isImprovement ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {isImprovement ? `Improvement: +${diff}%` : `Decline: ${diff}%`}
                                        </span>
                                      </div>
                                    ),
                                    visible: true
                                  });
                                }
                              }}
                              onMouseLeave={() => setPerfTooltip(null)}
                            >
                              {/* Previous Bar (Gray) */}
                              <rect
                                x={xPrev}
                                y={yPrev}
                                width={barWidth}
                                height={Math.max(2, 160 - yPrev)}
                                rx="2"
                                fill="#94A3B8"
                                className="opacity-75 group-hover/bar:opacity-100 transition-opacity duration-200"
                              />

                              {/* Current Bar (Blue) */}
                              <rect
                                x={xCurr}
                                y={yCurr}
                                width={barWidth}
                                height={Math.max(2, 160 - yCurr)}
                                rx="2"
                                fill="#3B82F6"
                                className="group-hover/bar:brightness-110 transition-all duration-200"
                              />

                              {/* Percentage Change Text */}
                              <text
                                x={xCurr + barWidth / 2}
                                y={yCurr - 6}
                                textAnchor="middle"
                                fill={diffColor}
                                className="text-[8px] font-extrabold font-mono opacity-90 group-hover/bar:opacity-100"
                              >
                                {diffText}
                              </text>

                              {/* School Label on X-axis (Rotated) */}
                              <text
                                x={xMid}
                                y="180"
                                textAnchor="middle"
                                className="fill-slate-500 dark:fill-slate-400 text-[8px] font-semibold"
                                transform={`rotate(-15, ${xMid}, 180)`}
                              >
                                {name.length > 12 ? name.substring(0, 10) + '...' : name}
                              </text>
                            </g>
                          );
                        });
                      }
                    })()}
                  </svg>

                  {/* Tooltip Overlay */}
                  {perfTooltip && perfTooltip.visible && (
                    <div
                      className="absolute z-50 bg-slate-900/95 dark:bg-slate-950/95 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-slate-700/80 dark:border-slate-800/80 shadow-md pointer-events-none transition-all duration-75 flex flex-col"
                      style={{ left: `${perfTooltip.x}px`, top: `${perfTooltip.y}px` }}
                    >
                      {perfTooltip.content}
                    </div>
                  )}
                </div>
              </div>

              {/* School Type Performance Breakdown */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Performance by School Type
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(perfAnalytics.performanceBySchoolType || []).map((st: any) => (
                    <div key={st.type} className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-center">
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">{st.type}</span>
                      <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-300 font-mono">{st.avgScore}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* THIRD ROW: AI ANALYTICS */}
          <div className="w-full">


            {/* 7. AI ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-fuchsia-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Student Performance Insights
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Model inference latency, performance score, and weak skill detections
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {aiAnalytics.aiAccuracyScore}% Performance Score
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-fuchsia-50/50 dark:bg-fuchsia-950/30 rounded-xl border border-fuchsia-100 dark:border-fuchsia-900/50">
                  <span className="block text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase">Average Assessment Time</span>
                  <span className="text-base font-extrabold text-fuchsia-700 dark:text-fuchsia-200 font-mono">
                    {aiAnalytics.avgResponseTime}
                  </span>
                </div>
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Average Feedback Time</span>
                  <span className="text-base font-extrabold text-purple-700 dark:text-purple-200 font-mono">
                    {aiAnalytics.avgFeedbackGenTime}
                  </span>
                </div>
              </div>

              {/* Weak Skills Detected */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Common Learning Gaps
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(aiAnalytics.mostCommonWeakSkills || []).map((sk: any) => (
                    <div key={sk.skill} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">{sk.category}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{sk.skill}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-500">{sk.frequency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FOURTH ROW: TOP 10 SCHOOL RANKINGS LEADERBOARD */}
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4" id="section-school-rankings">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  National School Leaderboard & Rankings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  View the top 10 schools ranked by performance score, student completion rate, satisfaction, and AI interview success rate.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRankingsOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap"
            >
              <Award className="h-4 w-4" />
              <span>View Rankings</span>
            </button>
          </div>

          {/* FIFTH ROW: ENGAGEMENT ANALYTICS */}
          <div className="w-full">
            {/* 9. ENGAGEMENT ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Engagement Analytics
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Students Active Today</span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    {engagementAnalytics.studentsActiveToday?.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-400">Returning vs New Users</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {engagementAnalytics.returningUsersPercentage}% Returning
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-indigo-600 rounded-l-full" style={{ width: `${engagementAnalytics.returningUsersPercentage}%` }} />
                    <div className="h-full bg-fuchsia-500 rounded-r-full" style={{ width: `${engagementAnalytics.newUsersPercentage}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal popup for rankings */}
          {isRankingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Top 10 School Rankings
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsRankingsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="h-4 w-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Controls / Filters */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      State Filter:
                    </label>
                    <select
                      value={rankingsStateFilter}
                      onChange={(e) => setRankingsStateFilter(e.target.value)}
                      className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ALL">All India</option>
                      {Object.keys(STATE_NAMES).sort().map(code => (
                        <option key={code} value={code}>{STATE_NAMES[code]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                    <button
                      onClick={() => setRankingSortMetric('performance')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${rankingSortMetric === 'performance'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                      Score %
                    </button>
                    <button
                      onClick={() => setRankingSortMetric('completion')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${rankingSortMetric === 'completion'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                      Completion Rate
                    </button>
                    <button
                      onClick={() => setRankingSortMetric('satisfaction')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${rankingSortMetric === 'satisfaction'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                      Satisfaction
                    </button>
                    <button
                      onClick={() => setRankingSortMetric('interview')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${rankingSortMetric === 'interview'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                      Interview Success
                    </button>
                  </div>
                </div>

                {/* Modal Body: Rankings Table */}
                <div className="p-5 overflow-y-auto flex-grow custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">School Name</th>
                        <th className="py-2.5 px-3">State</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Performance Score</th>
                        <th className="py-2.5 px-3 text-right">Completion</th>
                        <th className="py-2.5 px-3 text-right">Satisfaction</th>
                        <th className="py-2.5 px-3 text-right">Interview Success</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {sortedSchoolRankings.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 px-3 text-center text-slate-400 dark:text-slate-500">
                            No ranked schools yet for this filter.
                          </td>
                        </tr>
                      )}
                      {sortedSchoolRankings.map((school: any, idx: number) => (
                        <tr key={school.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-mono text-xs font-bold ${idx === 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                : idx === 1
                                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                  : idx === 2
                                    ? 'bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                    : 'text-slate-500'
                                }`}
                            >
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                            {school.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            {STATE_NAMES[school.stateCode] || school.stateCode}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{school.schoolType}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {school.performanceScore}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {school.completionRate}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-amber-600 font-bold">
                            ★ {school.studentSatisfaction}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            {school.interviewSuccessRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- KPI CARD HELPER COMPONENT ---
interface KPICardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ElementType;
  badge?: string;
  badgeType?: 'up' | 'down' | 'neutral' | 'special';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtext, icon: Icon, badge, badgeType = 'neutral' }) => {
  return (
    <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-2 hover:border-indigo-400/50 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>

      <div>
        <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
          {value ?? '—'}
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5">
          <span className="text-slate-500 dark:text-slate-400 line-clamp-1">{subtext}</span>
          {badge && (
            <span
              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[9px] ${badgeType === 'up'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                : badgeType === 'special'
                  ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/80 dark:text-fuchsia-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// --- CUSTOM SVG LINE TREND CHART ---
interface LineTrendChartProps {
  data: { label: string; cumulative: number; newSchools?: number }[];
}

const LineTrendChart: React.FC<LineTrendChartProps> = ({ data }) => {
  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400">No chart data</div>;

  const height = 220;
  const width = 700;
  const paddingLeft = 45;   // Space for Y-axis labels
  const paddingRight = 10;  // Minimal space on the right to remove empty gap
  const paddingTop = 20;    // Top padding
  const paddingBottom = 30; // Bottom padding for X-axis labels

  const maxVal = Math.max(...data.map(d => d.cumulative), 10);
  const minVal = Math.min(...data.map(d => d.cumulative), 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i * (width - paddingLeft - paddingRight)) / (data.length - 1 || 1);
    const y = height - paddingBottom - ((d.cumulative - minVal) / range) * (height - paddingTop - paddingBottom);
    return { x, y, label: d.label, val: d.cumulative };
  });

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-transparent">
      <defs>
        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid Lines */}
      <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" />
      <line x1={paddingLeft} y1={(height - paddingBottom + paddingTop) / 2} x2={width - paddingRight} y2={(height - paddingBottom + paddingTop) / 2} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" />
      <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />

      {/* Area */}
      <path d={areaD} fill="url(#growthGradient)" />

      {/* Path Line */}
      <path d={pathD} fill="none" stroke="#6366F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data Points */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const textAnchor = isLast ? 'end' : i === 0 ? 'start' : 'middle';

        return (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="5" className="fill-indigo-600 stroke-white dark:stroke-slate-900 hover:scale-125 transition-transform duration-150" strokeWidth="2" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" className="hidden group-hover:block fill-slate-900 dark:fill-white text-[10px] font-bold font-mono">
              {p.val.toLocaleString()}
            </text>
            <text x={p.x} y={height - 12} textAnchor={textAnchor} className="fill-slate-400 text-[10px] font-semibold">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// --- CUSTOM SVG INTERVIEW TREND CHART ---
interface InterviewTrendChartProps {
  data: any[];
}

const InterviewTrendChart: React.FC<InterviewTrendChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; visible: boolean; content: React.ReactNode } | null>(null);

  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400">No chart data</div>;

  const height = 180;
  const width = 600;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 25;
  const paddingBottom = 25;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxCount = 2000;
  const stepX = plotWidth / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = paddingLeft + i * stepX;
    const yCount = paddingTop + plotHeight * (1 - d.count / maxCount);
    const yPass = paddingTop + plotHeight * (1 - d.passRate / 100);
    const yFail = paddingTop + plotHeight * (1 - (100 - d.passRate) / 100);
    return { x, yCount, yPass, yFail, item: d };
  });

  const passPathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.yPass}` : `${acc} L ${p.x} ${p.yPass}`), '');
  const failPathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.yFail}` : `${acc} L ${p.x} ${p.yFail}`), '');

  return (
    <div className="relative w-full overflow-hidden bg-transparent">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-transparent">
        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((percent) => {
          const y = paddingTop + plotHeight * (1 - percent / 100);
          const countLabel = Math.round((percent / 100) * maxCount);

          return (
            <g key={percent} className="opacity-40 dark:opacity-20">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="currentColor"
                className="text-slate-300 dark:text-slate-650"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              {/* Left Y-axis (Count) */}
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono font-bold"
              >
                {countLabel.toLocaleString()}
              </text>
              {/* Right Y-axis (Percentage) */}
              <text
                x={width - paddingRight + 8}
                y={y + 3}
                textAnchor="start"
                className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono font-bold"
              >
                {percent}%
              </text>
            </g>
          );
        })}

        {/* Daily Interview Volume Bars */}
        {points.map((p, i) => {
          const barWidth = 20;
          const barHeight = Math.max(2, height - paddingBottom - p.yCount);

          return (
            <g key={i}>
              <rect
                x={p.x - barWidth / 2}
                y={p.yCount}
                width={barWidth}
                height={barHeight}
                rx="3"
                className="fill-indigo-500/15 dark:fill-indigo-500/10 stroke-indigo-400/40 dark:stroke-indigo-500/30 transition-all duration-250"
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {/* Pass Rate Line (Green) */}
        <path d={passPathD} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Fail Rate Line (Red) */}
        <path d={failPathD} fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive nodes & tooltips */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const textAnchor = isLast ? 'end' : i === 0 ? 'start' : 'middle';

          return (
            <g
              key={i}
              className="group/node cursor-pointer"
              onMouseMove={(e) => {
                const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (parentRect) {
                  setTooltip({
                    x: e.clientX - parentRect.left + 15,
                    y: e.clientY - parentRect.top - 15,
                    visible: true,
                    content: (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-100">{p.item.day} Interviews</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Volume: <span className="text-indigo-400 font-bold">{p.item.count}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Pass Rate: <span className="text-emerald-400 font-bold">{p.item.passRate}%</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Fail Rate: <span className="text-rose-400 font-bold">{100 - p.item.passRate}%</span>
                        </span>
                      </div>
                    )
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Invisible touch target column */}
              <rect
                x={p.x - stepX / 2}
                y={paddingTop}
                width={stepX}
                height={plotHeight}
                fill="transparent"
                className="hover:fill-slate-500/5 transition-colors duration-150"
              />

              {/* Pass rate dot */}
              <circle cx={p.x} cy={p.yPass} r="4" className="fill-emerald-500 stroke-white dark:stroke-slate-900 group-hover/node:scale-125 transition-transform" strokeWidth="1.5" />

              {/* Fail rate dot */}
              <circle cx={p.x} cy={p.yFail} r="4" className="fill-rose-500 stroke-white dark:stroke-slate-900 group-hover/node:scale-125 transition-transform" strokeWidth="1.5" />

              {/* X-axis day label */}
              <text x={p.x} y={height - 8} textAnchor={textAnchor} className="fill-slate-400 text-[10px] font-semibold">
                {p.item.day}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {tooltip && tooltip.visible && (
        <div
          className="absolute z-50 bg-slate-900/95 dark:bg-slate-950/95 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-slate-700/80 dark:border-slate-800/80 shadow-md pointer-events-none transition-all duration-75 flex flex-col"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

// --- CUSTOM SVG PIE CHART ---
const PIE_COLORS = [
  '#3B82F6', // Blue (Vibrant)
  '#8B5CF6', // Purple (Vibrant)
  '#06B6D4', // Cyan (Vibrant)
  '#10B981', // Emerald (Vibrant)
  '#14B8A6', // Teal (Vibrant)
  '#F59E0B', // Amber (Vibrant)
  '#EC4899', // Pink (Vibrant)
  '#6366F1', // Indigo (Vibrant)
  '#F97316', // Orange (Vibrant)
  '#F43F5E', // Rose (Vibrant)
];

interface PieChartProps {
  data: any[];
}

const StateDistributionPieChart: React.FC<PieChartProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; content: React.ReactNode; visible: boolean } | null>(null);

  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-slate-400">No data</div>;
  }

  const totalSchools = data.reduce((sum, item) => sum + item.schoolsCount, 0);

  const cx = 250;
  const cy = 250;
  const radius = 200;

  let cumulativePercent = 0;

  const slices = data.map((item, index) => {
    const ratio = totalSchools > 0 ? item.schoolsCount / totalSchools : 0;
    const percent = ratio * 100;

    const thetaStart = (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
    cumulativePercent += percent;
    const thetaEnd = (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
    const thetaMid = (thetaStart + thetaEnd) / 2;

    const xs = cx + radius * Math.cos(thetaStart);
    const ys = cy + radius * Math.sin(thetaStart);
    const xe = cx + radius * Math.cos(thetaEnd);
    const ye = cy + radius * Math.sin(thetaEnd);

    const largeArcFlag = percent > 50 ? 1 : 0;

    let slicePath = '';
    if (percent >= 99.9) {
      slicePath = `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
    } else {
      slicePath = `M ${cx} ${cy} L ${xs} ${ys} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${xe} ${ye} Z`;
    }

    const stateName = STATE_NAMES[item.stateCode] || item.stateName || item.stateCode;
    const color = PIE_COLORS[index % PIE_COLORS.length];

    return {
      item,
      stateName,
      color,
      ratio,
      percent,
      thetaMid,
      slicePath,
    };
  });

  const handleMouseMove = (e: React.MouseEvent, slice: any) => {
    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (parentRect) {
      setTooltip({
        x: e.clientX - parentRect.left + 15,
        y: e.clientY - parentRect.top - 15,
        content: (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-slate-100">{slice.stateName}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {slice.item.schoolsCount} Schools ({Math.round(slice.ratio * 1000) / 10}%)
            </span>
          </div>
        ),
        visible: true,
      });
    }
  };

  return (
    <div className="relative flex flex-col xl:flex-row items-center justify-center gap-6 w-full py-2 bg-transparent">
      {/* SVG Container: resized to 260x260px */}
      <div className="relative w-[260px] h-[260px] flex-shrink-0 bg-transparent">
        <svg viewBox="0 0 500 500" className="w-full h-full bg-transparent">
          {slices.map((slice, index) => {
            const dx = 6 * Math.cos(slice.thetaMid);
            const dy = 6 * Math.sin(slice.thetaMid);

            return (
              <path
                key={slice.item.stateCode}
                d={slice.slicePath}
                fill={slice.color}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  setTooltip(null);
                }}
                onMouseMove={(e) => handleMouseMove(e, slice)}
                className="transition-all duration-300 cursor-pointer stroke-white dark:stroke-slate-900 bg-transparent"
                strokeWidth="1.5"
                style={{
                  transform: hoveredIndex === index ? `translate(${dx}px, ${dy}px)` : 'translate(0px, 0px)',
                  transition: 'transform 0.2s ease-out',
                  opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.7,
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend Container: Compact scrollable list on the right */}
      <div className="w-full xl:w-72 max-h-[260px] overflow-y-auto custom-scrollbar pr-1 space-y-1.5 flex-grow bg-transparent">
        {slices.map((slice, index) => (
          <div
            key={slice.item.stateCode}
            className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl transition-all cursor-pointer ${hoveredIndex === index ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-grow">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300 leading-tight text-[11px] truncate">
                {slice.stateName}
              </span>
            </div>
            <div className="flex items-center font-mono text-[10px] space-x-2 text-slate-500 dark:text-slate-400 flex-shrink-0">
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-bold text-slate-850 dark:text-slate-205">{slice.item.schoolsCount} Schools</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.round(slice.ratio * 1000) / 10}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip Overlay */}
      {tooltip && tooltip.visible && (
        <div
          className="absolute z-50 bg-slate-900/95 dark:bg-slate-950/95 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-slate-700/80 dark:border-slate-800/80 shadow-md pointer-events-none transition-all duration-75 flex flex-col"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};
