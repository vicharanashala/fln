import React, { useState, useMemo } from 'react';
import { Student } from '../types';
import { computeStudentRisk, summarizeRiskDistribution, RiskCategory } from '../utils/riskDetector';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Search, 
  Sparkles, 
  UserCheck, 
  FileText, 
  ArrowUpRight,
  ShieldAlert,
  GraduationCap,
  BookOpen,
  ChevronRight,
  TrendingDown,
  Layers
} from 'lucide-react';

interface LearningRiskViewProps {
  students: Student[];
  onSelectStudent?: (student: Student) => void;
  onGenerateWorksheet?: (student: Student) => void;
}

export const LearningRiskView: React.FC<LearningRiskViewProps> = ({
  students,
  onSelectStudent,
  onGenerateWorksheet
}) => {
  const [selectedCategory, setSelectedCategory] = useState<RiskCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [activeModalStudent, setActiveModalStudent] = useState<Student | null>(null);

  // Compute risk for all students
  const evaluatedStudents = useMemo(() => {
    return students.map(s => {
      const risk = computeStudentRisk(s);
      return {
        student: s,
        risk
      };
    });
  }, [students]);

  // Summarize distribution
  const summary = useMemo(() => {
    return summarizeRiskDistribution(students);
  }, [students]);

  // Extract unique classes
  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    students.forEach(s => {
      if (s.classGroup) classes.add(s.classGroup);
    });
    return Array.from(classes).sort();
  }, [students]);

  // Filter students
  const filteredList = useMemo(() => {
    return evaluatedStudents.filter(({ student, risk }) => {
      const matchesSearch = 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.aadharMasked && student.aadharMasked.includes(searchQuery));
      
      const matchesCategory = selectedCategory === 'All' || risk.category === selectedCategory;
      const matchesClass = classFilter === 'All' || student.classGroup === classFilter;

      return matchesSearch && matchesCategory && matchesClass;
    });
  }, [evaluatedStudents, searchQuery, selectedCategory, classFilter]);

  const getCategoryBadge = (category: RiskCategory) => {
    switch (category) {
      case 'High Priority':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            High Priority
          </span>
        );
      case 'Moderate Priority':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Moderate Priority
          </span>
        );
      case 'Stable Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Stable Progress
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Feature 3: Early Academic Support
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-white">
              Learning Risk Detection
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Automatically identifies students who consistently require academic support. Categorizes learners into <strong className="text-rose-300">High Priority</strong>, <strong className="text-amber-300">Moderate Priority</strong>, and <strong className="text-emerald-300">Stable Progress</strong> to guide targeted early intervention.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto bg-white/5 backdrop-blur-md p-3 rounded-xl border border-white/10">
            <GraduationCap className="w-10 h-10 text-indigo-400" />
            <div>
              <div className="text-2xl font-bold text-white font-mono">{summary.total}</div>
              <div className="text-xs text-slate-400">Evaluated Students</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* High Priority Card */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'High Priority' ? 'All' : 'High Priority')}
          className={`text-left p-5 rounded-xl border transition-all duration-200 ${
            selectedCategory === 'High Priority'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-md ring-2 ring-rose-400/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> High Priority
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
              {summary.highPriorityPercentage}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {summary.highPriorityCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Urgent Support</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Students lagging $\ge 4$ levels or scoring low. Needs 1-on-1 remediation.
          </p>
        </button>

        {/* Moderate Priority Card */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'Moderate Priority' ? 'All' : 'Moderate Priority')}
          className={`text-left p-5 rounded-xl border transition-all duration-200 ${
            selectedCategory === 'Moderate Priority'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-md ring-2 ring-amber-400/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Moderate Priority
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
              {summary.moderatePriorityPercentage}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {summary.moderatePriorityCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Guided Help</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Students 2-3 levels behind target. Recommended targeted worksheet sets.
          </p>
        </button>

        {/* Stable Progress Card */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'Stable Progress' ? 'All' : 'Stable Progress')}
          className={`text-left p-5 rounded-xl border transition-all duration-200 ${
            selectedCategory === 'Stable Progress'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Stable Progress
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
              {summary.stableProgressPercentage}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {summary.stableProgressCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">On Track</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Meeting grade benchmarks ($\le 1$ level gap). Steady academic advancement.
          </p>
        </button>

        {/* All Students Card */}
        <button
          onClick={() => setSelectedCategory('All')}
          className={`text-left p-5 rounded-xl border transition-all duration-200 ${
            selectedCategory === 'All'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-400/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Total Roster
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              100%
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {summary.total}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Students</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Showing all student risk profiles across enrolled classes.
          </p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Categories</option>
              <option value="High Priority">High Priority 🔴</option>
              <option value="Moderate Priority">Moderate Priority 🟡</option>
              <option value="Stable Progress">Stable Progress 🟢</option>
            </select>
          </div>

          {/* Class Filter */}
          {uniqueClasses.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Class:</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Classes</option>
                {uniqueClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Student Risk List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            Student Risk Detection Roster ({filteredList.length})
          </h2>
          {selectedCategory !== 'All' && (
            <button
              onClick={() => setSelectedCategory('All')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              Clear Filter ({selectedCategory})
            </button>
          )}
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-medium text-base">No students match the selected filter criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search query or category filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-mono text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Student</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Current / Target Level</th>
                  <th className="py-3.5 px-4">Risk Category</th>
                  <th className="py-3.5 px-6">Recommended Early Intervention</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map(({ student, risk }) => (
                  <tr 
                    key={student.id} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{student.name}</span>
                        {student.streak > 0 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-mono" title={`${student.streak} day practice streak`}>
                            🔥 {student.streak}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        ID: {student.id} {student.aadharMasked && `• ${student.aadharMasked}`}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {student.classGroup} {student.section && `- ${student.section}`}
                    </td>

                    <td className="py-4 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">L{student.currentLevel}</span>
                        <span className="text-slate-400 text-xs">/ Target L{student.targetLevel}</span>
                      </div>
                      {risk.levelGap > 0 ? (
                        <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 block mt-0.5">
                          {risk.levelGap} level(s) behind
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          Meeting benchmark
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {getCategoryBadge(risk.category)}
                    </td>

                    <td className="py-4 px-6 max-w-md">
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {risk.recommendation}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {risk.reasoning}
                      </p>
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => setActiveModalStudent(student)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Details
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {onGenerateWorksheet && (
                        <button
                          onClick={() => onGenerateWorksheet(student)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <FileText className="w-3.5 h-3.5" /> Remedial Worksheets
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Early Intervention Modal */}
      {activeModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                  Early Intervention Profile
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {activeModalStudent.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {activeModalStudent.classGroup} • ID: {activeModalStudent.id}
                </p>
              </div>
              {getCategoryBadge(computeStudentRisk(activeModalStudent).category)}
            </div>

            {/* Modal Body */}
            {(() => {
              const riskInfo = computeStudentRisk(activeModalStudent);
              return (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">Current Level</span>
                      <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        L{activeModalStudent.currentLevel}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">Target Level</span>
                      <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        L{activeModalStudent.targetLevel}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">Level Lag Gap</span>
                      <span className={`text-base font-bold font-mono ${riskInfo.levelGap >= 3 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {riskInfo.levelGap} Level(s)
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">Calculated Risk Index</span>
                      <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {riskInfo.riskScore} / 100
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 font-mono mb-1">Risk Evaluation Reasoning</h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                      {riskInfo.reasoning}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 font-mono mb-1">Recommended Action Plan</h4>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/50">
                      {riskInfo.recommendation}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveModalStudent(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              {onGenerateWorksheet && (
                <button
                  onClick={() => {
                    const stu = activeModalStudent;
                    setActiveModalStudent(null);
                    onGenerateWorksheet(stu);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Generate Targeted Worksheets
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
