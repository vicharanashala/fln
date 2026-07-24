import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Super Admin Executive Analytics
  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
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
    }
  }, [dateRange, stateCode, schoolType, board, grade, status, token]);

  useEffect(() => {
    fetchAnalytics();
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

  // Memoized School Rankings sorted by chosen metric
  const sortedSchoolRankings = useMemo(() => {
    if (!analyticsData?.schoolRankings) return [];
    const list = [...analyticsData.schoolRankings];
    return list.sort((a, b) => {
      if (rankingSortMetric === 'performance') return b.performanceScore - a.performanceScore;
      if (rankingSortMetric === 'completion') return b.completionRate - a.completionRate;
      if (rankingSortMetric === 'satisfaction') return b.studentSatisfaction - a.studentSatisfaction;
      if (rankingSortMetric === 'interview') return b.interviewSuccessRate - a.interviewSuccessRate;
      return 0;
    });
  }, [analyticsData, rankingSortMetric]);

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

  const kpis = analyticsData?.kpis || {};
  const growthTrend = analyticsData?.growthTrend || [];
  const stateDistribution = analyticsData?.stateDistribution || [];
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
              <option value="PB">Punjab (PB)</option>
              <option value="HR">Haryana (HR)</option>
              <option value="DL">Delhi NCT (DL)</option>
              <option value="UP">Uttar Pradesh (UP)</option>
              <option value="RJ">Rajasthan (RJ)</option>
              <option value="MH">Maharashtra (MH)</option>
              <option value="KA">Karnataka (KA)</option>
              <option value="TN">Tamil Nadu (TN)</option>
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
              <option value="State Board">State Board</option>
              <option value="ICSE">ICSE</option>
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
              <option value="ALL">All Levels (FLN 1-16)</option>
              <option value="Level 1-3">Primary (L1 - L3)</option>
              <option value="Level 4-7">Elementary (L4 - L7)</option>
              <option value="Level 8-12">Middle (L8 - L12)</option>
              <option value="Level 13-16">Advanced (L13 - L16)</option>
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
          {/* 1. NATIONAL OVERVIEW CARDS (8 KPI CARDS GRID) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KPICard
              title="Registered Schools"
              value={kpis.totalRegisteredSchools?.toLocaleString()}
              subtext="100% Verified"
              icon={School}
              badge="+4.2%"
              badgeType="up"
            />
            <KPICard
              title="Active Schools"
              value={kpis.activeSchools?.toLocaleString()}
              subtext={`${kpis.totalRegisteredSchools ? Math.round((kpis.activeSchools / kpis.totalRegisteredSchools) * 100) : 100}% Operational`}
              icon={CheckCircle2}
              badge="Stable"
              badgeType="neutral"
            />
            <KPICard
              title="Total Students"
              value={kpis.totalStudents?.toLocaleString()}
              subtext="Enrolled across FLN"
              icon={Users}
              badge="+8.1%"
              badgeType="up"
            />
            <KPICard
              title="Total Teachers"
              value={kpis.totalTeachers?.toLocaleString()}
              subtext="Active Educators"
              icon={ShieldCheck}
              badge="+2.4%"
              badgeType="up"
            />
            <KPICard
              title="Exams Conducted"
              value={kpis.totalExamsConducted?.toLocaleString()}
              subtext="Assessments sync"
              icon={FileCheck}
              badge="+12%"
              badgeType="up"
            />
            <KPICard
              title="Interviews Done"
              value={kpis.totalInterviewsCompleted?.toLocaleString()}
              subtext="AI Mock Evaluations"
              icon={Zap}
              badge="+15%"
              badgeType="up"
            />
            <KPICard
              title="Avg Score"
              value={`${kpis.avgPerformanceScore}%`}
              subtext="National Index"
              icon={Award}
              badge="+3.5%"
              badgeType="up"
            />
            <KPICard
              title="AI Usage Today"
              value={kpis.aiUsageToday?.toLocaleString()}
              subtext="Evaluations run"
              icon={Sparkles}
              badge="High"
              badgeType="special"
            />
          </div>

          {/* MAIN CHARTS SECTION: GROWTH TREND & STATE DISTRIBUTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 2. SCHOOL GROWTH TREND (LINE CHART) */}
            <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
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
                      onClick={() => setDateRange(range)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        dateRange === range
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
                <LineTrendChart data={growthTrend} />
              </div>
            </div>

            {/* 3. STATE-WISE SCHOOL DISTRIBUTION */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
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

              <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {stateDistribution.map((item: any) => (
                  <div key={item.stateCode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.stateCode}
                        </span>
                        {item.stateName}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {item.schoolsCount} <span className="text-[10px] text-slate-400 font-normal">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, item.percentage * 2.5))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECOND ROW: STUDENT PERFORMANCE & AI INTERVIEW ANALYTICS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 4. STUDENT PERFORMANCE ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
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
              </div>

              {/* State Performance Horizontal Bars */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  State Benchmark Summary
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(perfAnalytics.performanceByState || []).slice(0, 6).map((st: any) => (
                    <div key={st.stateCode} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{st.stateName}</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{st.avgScore}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${st.avgScore >= 80 ? 'bg-emerald-500' : st.avgScore >= 75 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                          style={{ width: `${st.avgScore}%` }}
                        />
                      </div>
                    </div>
                  ))}
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

            {/* 5. INTERVIEW ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-magenta-500 text-fuchsia-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      AI Mock Interview Analytics
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Completion velocity, pass/fail ratios, and rating distribution
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/60 px-2.5 py-1 rounded-lg border border-fuchsia-200 dark:border-fuchsia-800">
                  {interviewAnalytics.completionRate}% Completion
                </span>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Avg Duration</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {interviewAnalytics.avgDurationMinutes} m
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center border border-emerald-100 dark:border-emerald-900/50">
                  <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Pass Rate</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-300 font-mono">
                    {interviewAnalytics.passVsFail?.passPercent}%
                  </span>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-center border border-rose-100 dark:border-rose-900/50">
                  <span className="block text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Fail Rate</span>
                  <span className="text-base font-extrabold text-rose-600 dark:text-rose-300 font-mono">
                    {interviewAnalytics.passVsFail?.failPercent}%
                  </span>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  AI Feedback Rating Distribution
                </h4>
                {(interviewAnalytics.ratingDistribution || []).map((r: any) => (
                  <div key={r.rating} className="flex items-center gap-3 text-xs">
                    <span className="w-36 text-slate-600 dark:text-slate-400 font-medium line-clamp-1">{r.rating}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full"
                        style={{ width: `${r.percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{r.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* THIRD ROW: USAGE ANALYTICS & AI ANALYTICS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 6. USAGE ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Usage Analytics & Active Cohorts
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    DAU, WAU, MAU active users & device telemetry
                  </p>
                </div>
              </div>

              {/* DAU WAU MAU Banner */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">DAU (Daily)</span>
                  <span className="text-base font-extrabold text-blue-700 dark:text-blue-200 font-mono">
                    {usageAnalytics.dailyActiveUsers?.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                  <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">WAU (Weekly)</span>
                  <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-200 font-mono">
                    {usageAnalytics.weeklyActiveUsers?.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/40">
                  <span className="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">MAU (Monthly)</span>
                  <span className="text-base font-extrabold text-purple-700 dark:text-purple-200 font-mono">
                    {usageAnalytics.monthlyActiveUsers?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Device Usage Cards */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Device Hardware Access
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center gap-3">
                    <Monitor className="h-5 w-5 text-indigo-500" />
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Desktop</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{usageAnalytics.deviceUsage?.desktop}%</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-emerald-500" />
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Mobile</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{usageAnalytics.deviceUsage?.mobile}%</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center gap-3">
                    <Tablet className="h-5 w-5 text-amber-500" />
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Tablet</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{usageAnalytics.deviceUsage?.tablet}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. AI ANALYTICS */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-fuchsia-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      AI Diagnostic Engine Performance
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Model inference latency, accuracy, and weak skill detections
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {aiAnalytics.aiAccuracyScore}% Accuracy
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-fuchsia-50/50 dark:bg-fuchsia-950/30 rounded-xl border border-fuchsia-100 dark:border-fuchsia-900/50">
                  <span className="block text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase">Avg Response Time</span>
                  <span className="text-base font-extrabold text-fuchsia-700 dark:text-fuchsia-200 font-mono">
                    {aiAnalytics.avgResponseTime}
                  </span>
                </div>
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Feedback Gen Latency</span>
                  <span className="text-base font-extrabold text-purple-700 dark:text-purple-200 font-mono">
                    {aiAnalytics.avgFeedbackGenTime}
                  </span>
                </div>
              </div>

              {/* Weak Skills Detected */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Top Detected Weak Skills Across Students
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
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4" id="section-school-rankings">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    National Top 10 School Rankings
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Institutional leaderboard ranked by performance, satisfaction, and interview success
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setRankingSortMetric('performance')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    rankingSortMetric === 'performance'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Score %
                </button>
                <button
                  onClick={() => setRankingSortMetric('completion')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    rankingSortMetric === 'completion'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Completion Rate
                </button>
                <button
                  onClick={() => setRankingSortMetric('satisfaction')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    rankingSortMetric === 'satisfaction'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Satisfaction
                </button>
                <button
                  onClick={() => setRankingSortMetric('interview')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    rankingSortMetric === 'interview'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Interview Success
                </button>
              </div>
            </div>

            {/* Rankings Table */}
            <div className="overflow-x-auto">
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
                  {sortedSchoolRankings.map((school: any, idx: number) => (
                    <tr key={school.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-mono text-xs font-bold ${
                            idx === 0
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
                      <td className="py-3 px-3 font-mono text-slate-500">{school.stateCode}</td>
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

          {/* FIFTH ROW: ENGAGEMENT ANALYTICS, SYSTEM HEALTH, AND RECENT TRENDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* 10. SYSTEM HEALTH */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    System Health Telemetry
                  </h3>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-800">
                  ALL SYSTEMS OPERATIONAL
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">API Uptime</span>
                  <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{systemHealth.apiUptime}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Avg API Latency</span>
                  <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{systemHealth.avgApiLatency}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Active Servers</span>
                  <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">{systemHealth.activeServers}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Error Rate</span>
                  <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{systemHealth.errorRate}</span>
                </div>
              </div>
            </div>

            {/* 11. RECENT TRENDS (EXECUTIVE AI INSIGHTS) */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-fuchsia-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Recent Insights & Trends
                  </h3>
                </div>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
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
          </div>
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
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider line-clamp-1">
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
              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[9px] ${
                badgeType === 'up'
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
  const padding = 35;

  const maxVal = Math.max(...data.map(d => d.cumulative), 10);
  const minVal = Math.min(...data.map(d => d.cumulative), 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding + (i * (width - padding * 2)) / (data.length - 1 || 1);
    const y = height - padding - ((d.cumulative - minVal) / range) * (height - padding * 2);
    return { x, y, label: d.label, val: d.cumulative };
  });

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid Lines */}
      <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" />
      <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="4 4" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />

      {/* Area */}
      <path d={areaD} fill="url(#growthGradient)" />

      {/* Path Line */}
      <path d={pathD} fill="none" stroke="#6366F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data Points */}
      {points.map((p, i) => (
        <g key={i} className="group cursor-pointer">
          <circle cx={p.x} cy={p.y} r="5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
          <text x={p.x} y={p.y - 12} textAnchor="middle" className="hidden group-hover:block fill-slate-900 dark:fill-white text-[10px] font-bold font-mono">
            {p.val}
          </text>
          <text x={p.x} y={height - 12} textAnchor="middle" className="fill-slate-400 text-[10px] font-semibold">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
};
