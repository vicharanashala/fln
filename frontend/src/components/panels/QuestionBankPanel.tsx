import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Eye,
  RefreshCw,
  X,
  FileQuestion,
  Layers,
  Database,
  Code
} from 'lucide-react';
import { User } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { MOCK_QUESTIONS_BANK } from '../../constants';
import {
  runQuestionBankAudit,
  AuditResult,
  AuditIssue,
  IssueCategory,
  CATEGORY_LABELS,
} from '../../utils/questionBankAudit';

interface QuestionBankPanelProps {
  currentUser?: User;
  token?: string;
}

export const QuestionBankPanel: React.FC<QuestionBankPanelProps> = ({ currentUser, token }) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | IssueCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectingIssue, setInspectingIssue] = useState<AuditIssue | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Load question data
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/questions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data);
          const result = runQuestionBankAudit(data);
          setAuditResult(result);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not fetch /api/admin/questions, falling back to local questions pool.', err);
    }

    // Fallback to local question bank data if backend route returns empty or not present
    const fallbackData = MOCK_QUESTIONS_BANK.map((q: any, idx: number) => ({
      ...q,
      questionText: q.text || q.question,
      answer: q.expectedAnswer || q.answer,
      questionNumber: idx + 1,
    }));

    setQuestions(fallbackData);
    const result = runQuestionBankAudit(fallbackData);
    setAuditResult(result);
    setLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const result = runQuestionBankAudit(questions);
      setAuditResult(result);
      setIsAuditing(false);
    }, 200);
  };

  const filteredIssues = useMemo(() => {
    if (!auditResult) return [];
    return auditResult.issues.filter((issue) => {
      if (selectedCategory !== 'ALL' && issue.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = issue.questionId.toLowerCase().includes(q);
        const matchesSnippet = issue.questionSnippet.toLowerCase().includes(q);
        const matchesMsg = issue.message.toLowerCase().includes(q);
        const matchesCategory = issue.categoryLabel.toLowerCase().includes(q);
        return matchesId || matchesSnippet || matchesMsg || matchesCategory;
      }
      return true;
    });
  }, [auditResult, selectedCategory, searchQuery]);

  const categoriesList: Array<{ key: 'ALL' | IssueCategory; label: string; count: number }> = useMemo(() => {
    if (!auditResult) return [];
    return [
      { key: 'ALL', label: 'All Issues', count: auditResult.issueCount },
      { key: 'MISSING_TEXT', label: 'Missing Question', count: auditResult.categoryCounts.MISSING_TEXT },
      { key: 'MISSING_ANSWER', label: 'Missing Answer', count: auditResult.categoryCounts.MISSING_ANSWER },
      { key: 'INVALID_CHOICES', label: 'Invalid Choices', count: auditResult.categoryCounts.INVALID_CHOICES },
      { key: 'DUPLICATE_TEXT', label: 'Duplicate Question', count: auditResult.categoryCounts.DUPLICATE_TEXT },
      { key: 'INVALID_LEVEL', label: 'Invalid Level', count: auditResult.categoryCounts.INVALID_LEVEL },
      { key: 'MALFORMED_SVG', label: 'Malformed SVG', count: auditResult.categoryCounts.MALFORMED_SVG },
    ];
  }, [auditResult]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Question Bank Audit & Integrity Check
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                  Client-Side Analysis
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Non-destructive integrity validator inspecting question prompt completeness, valid answer definitions, choices sanity, duplicate detection, level bounds, and SVG markup.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAudit}
              disabled={loading || isAuditing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'Auditing Dataset…' : 'Run Integrity Audit'}
            </button>
          </div>
        </div>

        {/* Scorecards */}
        {auditResult && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            {/* Total Questions */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Questions</span>
                <Database className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {auditResult.total.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Loaded dataset pool</div>
            </div>

            {/* Valid Questions */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Valid Questions</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {auditResult.valid.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">100% Passed all checks</div>
            </div>

            {/* Issues Found */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Issues Found</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                {auditResult.issueCount.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">Flagged for inspection</div>
            </div>

            {/* Integrity Health Score */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Integrity Health</span>
                <ShieldCheck className={`h-4 w-4 ${auditResult.healthScore >= 95 ? 'text-emerald-500' : auditResult.healthScore >= 80 ? 'text-amber-500' : 'text-rose-500'}`} />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono flex items-baseline gap-1">
                <span className={auditResult.healthScore >= 95 ? 'text-emerald-600 dark:text-emerald-400' : auditResult.healthScore >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
                  {auditResult.healthScore.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                (Valid / Total Questions)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown & Filter Pills */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" />
              Category Issue Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filter the issues table by clicking any integrity rule below.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, text, reason…"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {categoriesList.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-indigo-800/80 text-white'
                      : cat.count > 0
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Integrity Issues Log
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({filteredIssues.length} {filteredIssues.length === 1 ? 'issue' : 'issues'})
            </span>
          </div>

          <div className="text-xs text-slate-400">
            {selectedCategory !== 'ALL' && (
              <button
                onClick={() => setSelectedCategory('ALL')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Reset filter <X className="h-3 w-3 inline" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
            Loading and auditing questions dataset…
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-12 text-center">
            {auditResult?.issueCount === 0 ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Zero Integrity Issues Detected
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  All {auditResult.total} questions passed static verification across prompt text, answer definitions, choice arrays, level numbers, and SVG markup.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Filter className="h-8 w-8 text-slate-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No issues found matching the selected filter/search criteria.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4 w-24">Severity</th>
                  <th className="py-3 px-4 w-36">Category</th>
                  <th className="py-3 px-4 w-28">Question ID</th>
                  <th className="py-3 px-4 w-20">Level</th>
                  <th className="py-3 px-4">Question Snippet & Reason</th>
                  <th className="py-3 px-4 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredIssues.map((issue) => {
                  const isCritical = issue.severity === 'critical';
                  return (
                    <tr
                      key={issue.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Severity */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {isCritical ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {issue.severity}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {issue.categoryLabel}
                      </td>

                      {/* Question ID */}
                      <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        {issue.questionId}
                      </td>

                      {/* Level */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {issue.level !== null ? `L${issue.level}` : '—'}
                      </td>

                      {/* Snippet & Reason */}
                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1">
                          {issue.questionSnippet}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <span className="text-rose-600 dark:text-rose-400 font-medium">Issue:</span>
                          {issue.message}
                        </div>
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInspectingIssue(issue)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded border border-indigo-200 dark:border-indigo-800 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Read-Only Question Inspector Modal */}
      {inspectingIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Inspect Question Record
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                  Read-Only
                </span>
              </div>
              <button
                onClick={() => setInspectingIssue(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Alert Box Explaining Issue */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  inspectingIssue.severity === 'critical'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                }`}
              >
                {inspectingIssue.severity === 'critical' ? (
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                )}
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>{inspectingIssue.categoryLabel}</span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/60 dark:bg-black/40">
                      {inspectingIssue.severity}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed">{inspectingIssue.message}</p>
                </div>
              </div>

              {/* Question Properties Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Question ID</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {inspectingIssue.questionId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">FLN Level</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {inspectingIssue.level !== null ? `Level ${inspectingIssue.level}` : '(None)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Answer Type</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {inspectingIssue.rawQuestion?.answer_type || 'text/open'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Expected Answer</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {inspectingIssue.rawQuestion?.answer !== undefined
                      ? String(inspectingIssue.rawQuestion.answer)
                      : inspectingIssue.rawQuestion?.expectedAnswer !== undefined
                      ? String(inspectingIssue.rawQuestion.expectedAnswer)
                      : '(Missing)'}
                  </span>
                </div>
              </div>

              {/* Question Prompt */}
              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">
                  Question Text / Prompt
                </label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 leading-relaxed font-sans">
                  {inspectingIssue.rawQuestion?.questionText ||
                    inspectingIssue.rawQuestion?.question ||
                    inspectingIssue.rawQuestion?.text || (
                      <span className="text-rose-500 italic">(Empty question prompt)</span>
                    )}
                </div>
              </div>

              {/* Choices (if applicable) */}
              {Array.isArray(inspectingIssue.rawQuestion?.choices) && (
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">
                    Choice Options ({inspectingIssue.rawQuestion.choices.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {inspectingIssue.rawQuestion.choices.map((choice: any, cIdx: number) => (
                      <span
                        key={cIdx}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300"
                      >
                        {String(choice)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON details */}
              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Code className="h-3 w-3" /> Raw Question JSON
                </label>
                <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto max-h-40 border border-slate-800">
                  {JSON.stringify(inspectingIssue.rawQuestion, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setInspectingIssue(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
