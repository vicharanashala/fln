/**
 * PerformanceTrendIndicator.tsx
 *
 * Categorizes students as Improving / Stable / Declining based on their
 * level history. Helps teachers prioritize follow-up actions.
 */

import React, { useState, useMemo } from 'react';
import { Student } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Filter,
  Search,
  ArrowUpDown,
  Activity,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface PerformanceTrendIndicatorProps {
  students: Student[];
  compact?: boolean;
}

export type TrendCategory = 'improving' | 'stable' | 'declining' | 'insufficient_data';

interface StudentTrend {
  student: Student;
  trend: TrendCategory;
  levelChange: number;
  assessmentCount: number;
  latestAssessmentDate: string | null;
  details: string;
}

/**
 * Analyzes a student's levelHistory to determine their performance trend.
 *
 * Logic:
 * - If a student has ≥2 level history entries, compare the most recent
 *   level to the earliest level.
 * - If the level increased → Improving
 * - If the level stayed the same → Stable
 * - If the level decreased → Declining
 * - If only 1 entry or 0 entries → Insufficient Data (shown as "New/Pending")
 */
function computeTrend(student: Student): StudentTrend {
  const history = student.levelHistory;

  if (!history || history.length < 2) {
    return {
      student,
      trend: 'insufficient_data',
      levelChange: 0,
      assessmentCount: history?.length ?? 0,
      latestAssessmentDate: history?.length > 0 ? history[history.length - 1].date : null,
      details: history?.length === 0
        ? 'No assessments recorded. Diagnostic placement pending.'
        : 'Only one assessment on record. Need more data points to determine trend.',
    };
  }

  // Sort by date to ensure chronological order
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const levelChange = latest.level - earliest.level;

  let trend: TrendCategory;
  let details: string;

  if (levelChange > 0) {
    trend = 'improving';
    details = `Progressed ${levelChange} level${levelChange > 1 ? 's' : ''} from L${earliest.level} → L${latest.level} since ${new Date(earliest.date).toLocaleDateString()}.`;
  } else if (levelChange === 0) {
    trend = 'stable';
    details = `Remained at L${latest.level} across ${sorted.length} assessment${sorted.length > 1 ? 's' : ''}. No upward or downward movement detected.`;
  } else {
    trend = 'declining';
    details = `Dropped ${Math.abs(levelChange)} level${Math.abs(levelChange) > 1 ? 's' : ''} from L${earliest.level} → L${latest.level}. Intervention recommended.`;
  }

  return {
    student,
    trend,
    levelChange,
    assessmentCount: sorted.length,
    latestAssessmentDate: latest.date,
    details,
  };
}

function getTrendConfig(trend: TrendCategory) {
  switch (trend) {
    case 'improving':
      return {
        label: 'Improving',
        emoji: '📈',
        icon: TrendingUp,
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
        badgeText: 'text-emerald-800 dark:text-emerald-200',
        badgeBorder: 'border-emerald-200 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
        summaryIcon: ArrowUpCircle,
        summaryBg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
        summaryBorder: 'border-emerald-200 dark:border-emerald-800',
        description: 'Actively progressing through FLN levels',
      };
    case 'stable':
      return {
        label: 'Stable',
        emoji: '➡️',
        icon: Minus,
        bgColor: 'bg-blue-50 dark:bg-blue-950/40',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-700 dark:text-blue-300',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
        badgeText: 'text-blue-800 dark:text-blue-200',
        badgeBorder: 'border-blue-200 dark:border-blue-800',
        dotColor: 'bg-blue-500',
        summaryIcon: MinusCircle,
        summaryBg: 'bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30',
        summaryBorder: 'border-blue-200 dark:border-blue-800',
        description: 'No change in FLN level across assessments',
      };
    case 'declining':
      return {
        label: 'Declining',
        emoji: '📉',
        icon: TrendingDown,
        bgColor: 'bg-red-50 dark:bg-red-950/40',
        borderColor: 'border-red-200 dark:border-red-800',
        textColor: 'text-red-700 dark:text-red-300',
        badgeBg: 'bg-red-100 dark:bg-red-900/60',
        badgeText: 'text-red-800 dark:text-red-200',
        badgeBorder: 'border-red-200 dark:border-red-800',
        dotColor: 'bg-red-500',
        summaryIcon: ArrowDownCircle,
        summaryBg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
        summaryBorder: 'border-red-200 dark:border-red-800',
        description: 'Level has decreased — needs immediate follow-up',
      };
    case 'insufficient_data':
      return {
        label: 'New / Pending',
        emoji: '🆕',
        icon: AlertTriangle,
        bgColor: 'bg-slate-50 dark:bg-slate-800/40',
        borderColor: 'border-slate-200 dark:border-slate-700',
        textColor: 'text-slate-500 dark:text-slate-400',
        badgeBg: 'bg-slate-100 dark:bg-slate-800/60',
        badgeText: 'text-slate-600 dark:text-slate-300',
        badgeBorder: 'border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-400',
        summaryIcon: AlertTriangle,
        summaryBg: 'bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-900/30 dark:to-zinc-950/30',
        summaryBorder: 'border-slate-200 dark:border-slate-700',
        description: 'Insufficient data to determine trend',
      };
  }
}

type SortKey = 'name' | 'trend' | 'level' | 'change' | 'date';

const TREND_ORDER: Record<TrendCategory, number> = {
  declining: 0,
  stable: 1,
  improving: 2,
  insufficient_data: 3,
};

export const PerformanceTrendIndicator: React.FC<PerformanceTrendIndicatorProps> = ({
  students,
  compact = false,
}) => {
  const [filterTrend, setFilterTrend] = useState<'all' | TrendCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('trend');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const studentTrends = useMemo<StudentTrend[]>(() => {
    return students.map(computeTrend);
  }, [students]);

  const filtered = useMemo(() => {
    let data = studentTrends;

    if (filterTrend !== 'all') {
      data = data.filter((st) => st.trend === filterTrend);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (st) =>
          st.student.name.toLowerCase().includes(q) ||
          st.student.id.toLowerCase().includes(q) ||
          st.student.classGroup.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.student.name.localeCompare(b.student.name);
          break;
        case 'trend':
          cmp = TREND_ORDER[a.trend] - TREND_ORDER[b.trend];
          break;
        case 'level':
          cmp = a.student.currentLevel - b.student.currentLevel;
          break;
        case 'change':
          cmp = a.levelChange - b.levelChange;
          break;
        case 'date':
          cmp =
            new Date(a.latestAssessmentDate || 0).getTime() -
            new Date(b.latestAssessmentDate || 0).getTime();
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [studentTrends, filterTrend, searchQuery, sortKey, sortAsc]);

  const counts = useMemo(() => {
    const c = { improving: 0, stable: 0, declining: 0, insufficient_data: 0 };
    studentTrends.forEach((st) => c[st.trend]++);
    return c;
  }, [studentTrends]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortButton: React.FC<{ label: string; sortKeyValue: SortKey; className?: string }> = ({
    label,
    sortKeyValue,
    className = '',
  }) => (
    <button
      onClick={() => handleSort(sortKeyValue)}
      className={`flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${
        sortKey === sortKeyValue ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
      } ${className}`}
    >
      {label}
      {sortKey === sortKeyValue && (
        <ArrowUpDown className={`w-3 h-3 transition-transform ${sortAsc ? '' : 'rotate-180'}`} />
      )}
    </button>
  );

  // Compact: used when embedded inside existing Performance panel
  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Activity className="h-4 w-4 text-indigo-500" />
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Performance Trend Indicators</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Student trajectory based on level history analysis</p>
          </div>
        </div>

        {/* Mini summary */}
        <div className="grid grid-cols-4 gap-2">
          {(['improving', 'stable', 'declining', 'insufficient_data'] as TrendCategory[]).map((trend) => {
            const config = getTrendConfig(trend);
            return (
              <div key={trend} className={`text-center rounded-lg p-2 border ${config.bgColor} ${config.borderColor}`}>
                <div className={`text-lg font-bold ${config.textColor}`}>{counts[trend]}</div>
                <div className="text-[9px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500">{config.label}</div>
              </div>
            );
          })}
        </div>

        {/* Compact student list */}
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {studentTrends
            .sort((a, b) => TREND_ORDER[a.trend] - TREND_ORDER[b.trend])
            .map((st) => {
              const config = getTrendConfig(st.trend);
              const Icon = config.icon;
              return (
                <div
                  key={st.student.id}
                  className="flex items-center gap-3 p-2.5 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full ${config.dotColor} shrink-0`} />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">{st.student.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">L{st.student.currentLevel}</span>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} flex items-center gap-1`}>
                    <Icon className="w-2.5 h-2.5" />
                    {config.label}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // Full view (standalone panel)
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Performance Trend Indicators</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each student is categorized based on their level progression history to help prioritize follow-up actions.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {(['improving', 'stable', 'declining', 'insufficient_data'] as TrendCategory[]).map((trend) => {
            const config = getTrendConfig(trend);
            const SummaryIcon = config.summaryIcon;
            const isActive = filterTrend === trend;
            return (
              <button
                key={trend}
                onClick={() => setFilterTrend(filterTrend === trend ? 'all' : trend)}
                className={`text-left rounded-xl p-4 border transition-all duration-200 ${config.summaryBg} ${
                  isActive
                    ? `${config.summaryBorder} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ${
                        trend === 'improving'
                          ? 'ring-emerald-400'
                          : trend === 'stable'
                            ? 'ring-blue-400'
                            : trend === 'declining'
                              ? 'ring-red-400'
                              : 'ring-slate-400'
                      }`
                    : config.summaryBorder
                } hover:shadow-md`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <SummaryIcon className={`w-4 h-4 ${config.textColor}`} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {config.label}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${config.textColor}`}>{counts[trend]}</div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{config.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students by name, ID, or class..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 dark:focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-semibold">Quick filter:</span>
        </div>
        {(['all', 'declining', 'stable', 'improving'] as const).map((f) => {
          const labels: Record<string, string> = {
            all: 'All Students',
            declining: '📉 Declining',
            stable: '➡️ Stable',
            improving: '📈 Improving',
          };
          return (
            <button
              key={f}
              onClick={() => setFilterTrend(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                filterTrend === f
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Student Trend Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_100px_80px_90px_100px_44px] gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
          <SortButton label="Student" sortKeyValue="name" />
          <SortButton label="Trend" sortKeyValue="trend" />
          <SortButton label="Level" sortKeyValue="level" />
          <SortButton label="Change" sortKeyValue="change" />
          <SortButton label="Last Assessed" sortKeyValue="date" />
          <span />
        </div>

        {/* Table Body */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No students match the current filters</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((st) => {
              const config = getTrendConfig(st.trend);
              const Icon = config.icon;
              const isExpanded = expandedId === st.student.id;

              return (
                <div key={st.student.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : st.student.id)}
                    className="w-full grid grid-cols-[1fr_100px_80px_90px_100px_44px] gap-3 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors items-center"
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                        {st.student.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate block">{st.student.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{st.student.classGroup} - {st.student.section}</span>
                      </div>
                    </div>

                    {/* Trend Badge */}
                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-full border inline-flex items-center gap-1 w-fit ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>

                    {/* Current Level */}
                    <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                      L{st.student.currentLevel}
                    </span>

                    {/* Level Change */}
                    <span className={`font-mono font-bold text-sm ${
                      st.levelChange > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : st.levelChange < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {st.levelChange > 0 ? `+${st.levelChange}` : st.levelChange === 0 ? '—' : st.levelChange}
                    </span>

                    {/* Last Date */}
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {st.latestAssessmentDate
                        ? new Date(st.latestAssessmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </span>

                    {/* Expand */}
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Trend Details */}
                        <div className={`rounded-lg p-4 border ${config.bgColor} ${config.borderColor}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${config.textColor}`} />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Trend Analysis
                            </span>
                          </div>
                          <p className={`text-xs leading-relaxed ${config.textColor}`}>{st.details}</p>
                        </div>

                        {/* Assessment Summary */}
                        <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Assessment History
                          </span>
                          <div className="mt-2 space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Assessments</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{st.assessmentCount}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Current Level</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">L{st.student.currentLevel}.{st.student.currentSubLevel ?? 0}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Target Level</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">L{st.student.targetLevel}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Current Streak</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{st.student.streak} 🔥</span>
                            </div>
                          </div>
                        </div>

                        {/* Level History Timeline */}
                        <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Level History
                          </span>
                          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto pr-1">
                            {st.student.levelHistory.length === 0 ? (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No history entries</p>
                            ) : (
                              [...st.student.levelHistory]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((h, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`} />
                                    <span className="font-mono text-slate-600 dark:text-slate-300">L{h.level}</span>
                                    <span className="text-slate-400 dark:text-slate-500">·</span>
                                    <span className="text-slate-400 dark:text-slate-500">{new Date(h.date).toLocaleDateString('en-IN')}</span>
                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${config.badgeBg} ${config.badgeText}`}>{h.reason}</span>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">How Trends Are Computed</span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Trends are calculated by comparing a student's earliest and most recent FLN level entries. <strong>Improving</strong>: level increased over time. <strong>Stable</strong>: level unchanged across assessments. <strong>Declining</strong>: level decreased, requiring intervention. Students with fewer than 2 assessments are shown as <strong>New/Pending</strong> until more data is available.
        </p>
      </div>
    </div>
  );
};
