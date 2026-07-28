/**
 * CurriculumFeedback.tsx
 * 
 * Automatically flags competencies where a large proportion of students
 * perform poorly. Helps curriculum designers review instructional materials.
 */

import React, { useState, useMemo } from 'react';
import { EvaluationReport, Student } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  TrendingDown,
  Filter,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BarChart3,
  Info,
} from 'lucide-react';

interface CurriculumFeedbackProps {
  reports: EvaluationReport[];
  students: Student[];
}

type SeverityLevel = 'critical' | 'warning' | 'watch';

interface CompetencyAnalysis {
  topic: string;
  totalAssessed: number;
  strongCount: number;
  satisfactoryCount: number;
  needsPracticeCount: number;
  needsPracticeRate: number;
  severity: SeverityLevel;
  affectedStudents: string[];
  recommendation: string;
}

const RECOMMENDATIONS: Record<string, string> = {
  'Subtraction': 'Consider introducing subtraction with visual manipulatives (e.g., base-10 blocks). Focus on borrowing concepts through step-by-step guided practice before moving to abstract problems.',
  'Shapes': 'Incorporate hands-on activities with 3D models and real-world shape identification walks. Use pattern blocks and tangrams to reinforce geometric reasoning.',
  'Patterns': 'Use repetitive visual and auditory pattern exercises. Introduce bead stringing, clapping patterns, and color-based sequences before advancing to number patterns.',
  'Division': 'Introduce division as equal sharing with concrete objects before transitioning to symbolic notation. Use array models and repeated subtraction strategies.',
  'Measurement': 'Provide hands-on measuring activities with both standard and non-standard units. Use real-world contexts like classroom objects, body measurements, and cooking.',
  'Fractions': 'Use fraction bars, pie models, and paper folding activities. Connect fractions to real-life sharing scenarios before introducing formal notation.',
  'Number Sense': 'Strengthen number sense through counting games, number line activities, and place value exercises using bundling sticks and base-10 blocks.',
  'Addition': 'Reinforce addition concepts with visual aids, number bonds, and fact family exercises. Progress from concrete to pictorial to abstract representations.',
  'Multiplication': 'Build multiplication understanding through arrays, skip counting, and repeated addition. Use times tables songs and interactive games for fluency.',
  'Place Value': 'Use place value charts, expanded form exercises, and trading games. Connect to real-world money concepts for deeper understanding.',
  'Comparison': 'Practice comparison with concrete objects first, then transition to number line placement and symbol usage (<, >, =).',
  'Money': 'Use play money for hands-on transactions. Set up classroom shops for practical application of addition, subtraction, and making change.',
  'Data Handling': 'Introduce data collection through class surveys and tally marks. Progress from pictographs to bar graphs using familiar contexts.',
};

function getRecommendation(topic: string): string {
  return RECOMMENDATIONS[topic] || `Review and strengthen instructional materials for "${topic}". Consider incorporating more hands-on activities and differentiated practice exercises to address student gaps.`;
}

function getSeverity(rate: number): SeverityLevel {
  if (rate >= 60) return 'critical';
  if (rate >= 40) return 'warning';
  return 'watch';
}

function getSeverityConfig(severity: SeverityLevel) {
  switch (severity) {
    case 'critical':
      return {
        label: 'Critical',
        bgColor: 'bg-red-50 dark:bg-red-950/40',
        borderColor: 'border-red-200 dark:border-red-800',
        textColor: 'text-red-700 dark:text-red-300',
        badgeBg: 'bg-red-100 dark:bg-red-900/60',
        badgeText: 'text-red-800 dark:text-red-200',
        barColor: 'bg-red-500',
        iconColor: 'text-red-500 dark:text-red-400',
        glowColor: 'shadow-red-500/10',
      };
    case 'warning':
      return {
        label: 'Needs Attention',
        bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        borderColor: 'border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-700 dark:text-amber-300',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
        badgeText: 'text-amber-800 dark:text-amber-200',
        barColor: 'bg-amber-500',
        iconColor: 'text-amber-500 dark:text-amber-400',
        glowColor: 'shadow-amber-500/10',
      };
    case 'watch':
      return {
        label: 'Monitor',
        bgColor: 'bg-blue-50 dark:bg-blue-950/40',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-700 dark:text-blue-300',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
        badgeText: 'text-blue-800 dark:text-blue-200',
        barColor: 'bg-blue-500',
        iconColor: 'text-blue-500 dark:text-blue-400',
        glowColor: 'shadow-blue-500/10',
      };
  }
}

export const CurriculumFeedback: React.FC<CurriculumFeedbackProps> = ({ reports, students }) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | SeverityLevel>('all');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);

  const competencyData = useMemo<CompetencyAnalysis[]>(() => {
    const topicMap = new Map<string, { strong: number; satisfactory: number; needsPractice: number; students: Set<string> }>();

    reports.forEach((report) => {
      Object.entries(report.conceptMastery).forEach(([topic, mastery]) => {
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { strong: 0, satisfactory: 0, needsPractice: 0, students: new Set() });
        }
        const entry = topicMap.get(topic)!;
        if (mastery === 'Strong') entry.strong++;
        else if (mastery === 'Satisfactory') entry.satisfactory++;
        else entry.needsPractice++;

        if (mastery === 'Needs Practice') {
          const student = students.find((s) => s.id === report.studentId);
          if (student) entry.students.add(student.name);
        }
      });
    });

    return Array.from(topicMap.entries())
      .map(([topic, data]) => {
        const total = data.strong + data.satisfactory + data.needsPractice;
        const rate = total > 0 ? Math.round((data.needsPractice / total) * 100) : 0;
        return {
          topic,
          totalAssessed: total,
          strongCount: data.strong,
          satisfactoryCount: data.satisfactory,
          needsPracticeCount: data.needsPractice,
          needsPracticeRate: rate,
          severity: getSeverity(rate),
          affectedStudents: Array.from(data.students),
          recommendation: getRecommendation(topic),
        };
      })
      .sort((a, b) => b.needsPracticeRate - a.needsPracticeRate);
  }, [reports, students]);

  const filteredData = useMemo(() => {
    let data = competencyData;
    if (filterSeverity !== 'all') {
      data = data.filter((c) => c.severity === filterSeverity);
    }
    if (showOnlyFlagged) {
      data = data.filter((c) => c.needsPracticeRate >= 30);
    }
    return data;
  }, [competencyData, filterSeverity, showOnlyFlagged]);

  const flaggedCount = competencyData.filter((c) => c.needsPracticeRate >= 40).length;
  const criticalCount = competencyData.filter((c) => c.severity === 'critical').length;
  const avgNeedsPracticeRate = competencyData.length > 0
    ? Math.round(competencyData.reduce((a, c) => a + c.needsPracticeRate, 0) / competencyData.length)
    : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Curriculum Feedback</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated analysis of competency gaps across student evaluations. Flagged areas indicate where instructional materials may need revision.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{competencyData.length}</div>
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mt-1">Competencies Tracked</div>
          </div>
          <div className={`rounded-xl p-4 border ${flaggedCount > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'}`}>
            <div className={`text-2xl font-bold ${flaggedCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{flaggedCount}</div>
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mt-1">Flagged (≥40% Weak)</div>
          </div>
          <div className={`rounded-xl p-4 border ${criticalCount > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700'}`}>
            <div className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{criticalCount}</div>
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mt-1">Critical (≥60% Weak)</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{avgNeedsPracticeRate}%</div>
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mt-1">Avg. Weak Rate</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-semibold">Filters:</span>
        </div>
        {(['all', 'critical', 'warning', 'watch'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              filterSeverity === sev
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
          >
            {sev === 'all' ? 'All' : sev === 'critical' ? '🔴 Critical' : sev === 'warning' ? '🟡 Needs Attention' : '🔵 Monitor'}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFlagged}
            onChange={(e) => setShowOnlyFlagged(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-indigo-600"
          />
          Show only flagged
        </label>
      </div>

      {/* Competency Cards */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No competencies match the current filter</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Adjust filters above to explore more data</p>
          </div>
        ) : (
          filteredData.map((comp) => {
            const config = getSeverityConfig(comp.severity);
            const isExpanded = expandedTopic === comp.topic;
            const strongPct = comp.totalAssessed > 0 ? Math.round((comp.strongCount / comp.totalAssessed) * 100) : 0;
            const satPct = comp.totalAssessed > 0 ? Math.round((comp.satisfactoryCount / comp.totalAssessed) * 100) : 0;
            const weakPct = comp.needsPracticeRate;

            return (
              <div
                key={comp.topic}
                className={`bg-white dark:bg-slate-900 border rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${
                  comp.needsPracticeRate >= 40
                    ? `${config.borderColor} shadow-lg ${config.glowColor}`
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Card Header */}
                <button
                  onClick={() => setExpandedTopic(isExpanded ? null : comp.topic)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor} ${config.borderColor} border`}>
                    {comp.severity === 'critical' ? (
                      <AlertTriangle className={`w-5 h-5 ${config.iconColor}`} />
                    ) : comp.severity === 'warning' ? (
                      <TrendingDown className={`w-5 h-5 ${config.iconColor}`} />
                    ) : (
                      <Info className={`w-5 h-5 ${config.iconColor}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{comp.topic}</h3>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${config.badgeBg} ${config.badgeText}`}>
                        {config.label}
                      </span>
                      {comp.needsPracticeRate >= 40 && (
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 uppercase tracking-wider animate-pulse">
                          ⚠ Flagged
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {comp.totalAssessed} assessment{comp.totalAssessed !== 1 ? 's' : ''} · {comp.needsPracticeCount} underperforming
                    </p>
                  </div>

                  {/* Distribution Bar */}
                  <div className="w-40 shrink-0 hidden sm:block">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500 mb-1">
                      <span>Distribution</span>
                      <span>{weakPct}% weak</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${strongPct}%` }} />
                      <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${satPct}%` }} />
                      <div className={`h-full ${config.barColor} transition-all duration-500`} style={{ width: `${weakPct}%` }} />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-mono">●Strong {strongPct}%</span>
                      <span className="text-[8px] text-blue-500 dark:text-blue-400 font-mono">●OK {satPct}%</span>
                      <span className={`text-[8px] font-mono ${config.textColor}`}>●Weak {weakPct}%</span>
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />}
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-5 space-y-5 animate-fadeIn">
                    {/* Mobile Distribution Bar */}
                    <div className="sm:hidden">
                      <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500 mb-1">
                        <span>Mastery Distribution</span>
                        <span>{weakPct}% weak</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${strongPct}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${satPct}%` }} />
                        <div className={`h-full ${config.barColor}`} style={{ width: `${weakPct}%` }} />
                      </div>
                      <div className="flex gap-3 mt-1.5">
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono">● Strong {strongPct}%</span>
                        <span className="text-[9px] text-blue-500 dark:text-blue-400 font-mono">● Satisfactory {satPct}%</span>
                        <span className={`text-[9px] font-mono ${config.textColor}`}>● Needs Practice {weakPct}%</span>
                      </div>
                    </div>

                    {/* Breakdown Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900">
                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{comp.strongCount}</div>
                        <div className="text-[10px] font-mono font-bold uppercase text-emerald-500 dark:text-emerald-400 mt-0.5">Strong</div>
                      </div>
                      <div className="text-center bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900">
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{comp.satisfactoryCount}</div>
                        <div className="text-[10px] font-mono font-bold uppercase text-blue-500 dark:text-blue-400 mt-0.5">Satisfactory</div>
                      </div>
                      <div className={`text-center rounded-lg p-3 border ${config.bgColor} ${config.borderColor}`}>
                        <div className={`text-xl font-bold ${config.textColor}`}>{comp.needsPracticeCount}</div>
                        <div className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 mt-0.5">Needs Practice</div>
                      </div>
                    </div>

                    {/* Affected Students */}
                    {comp.affectedStudents.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">
                          Affected Students ({comp.affectedStudents.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {comp.affectedStudents.map((name) => (
                            <span
                              key={name}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${config.bgColor} ${config.borderColor} ${config.textColor}`}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider">
                          Curriculum Recommendation
                        </h4>
                      </div>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        {comp.recommendation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Legend */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Legend</span>
        </div>
        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 dark:text-slate-400">
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Critical: ≥60% students scored "Needs Practice"</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Needs Attention: 40–59% students scored "Needs Practice"</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Monitor: &lt;40% but showing some weakness</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Strong: Majority of students demonstrate mastery</span>
        </div>
      </div>
    </div>
  );
};
