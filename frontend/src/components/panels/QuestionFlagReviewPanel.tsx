// Question-Level Auto-Flag & Curriculum Review Queue panel (SRS R-15).
//
// "If 50%+ of students consistently fail an 'easy'-tagged question, the
// system flags it for core-team review." This panel lists all flagged
// questions and lets a Superadmin review each one: dismiss (clear flag),
// revise (clear flag + mark for curriculum revision), or keep (acknowledge
// review, leave flag active). Only Superadmin/Admin can access this panel.
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/apiClient';
import { QuestionBankEntry } from '../../types';
import { PageHeader } from './PanelShared';
import {
  ShieldAlert,
  Check,
  RefreshCw,
  Edit,
  X,
  Loader2,
} from 'lucide-react';

interface FlaggedQuestionRow extends QuestionBankEntry {
  liveAttempts?: number;
  liveFailures?: number;
  liveFailRate?: number;
}

export const QuestionFlagReviewPanel: React.FC<{ token: string }> = ({
  token,
}) => {
  const [rows, setRows] = useState<FlaggedQuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Review dialog state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'dismiss' | 'revise' | 'keep'>('dismiss');
  const [reviewNote, setReviewNote] = useState('');

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/question-flags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load flagged questions');
      setRows((data.questions ?? []).map((q: any) => ({
        ...q,
        liveAttempts: q.liveAttempts ?? 0,
        liveFailures: q.liveFailures ?? 0,
        liveFailRate: q.liveFailRate ?? 0,
      })));
    } catch (e: any) {
      setError(e.message || 'Failed to load flagged questions.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleReview = async (questionId: string, action: 'dismiss' | 'revise' | 'keep') => {
    setReviewingId(questionId);
    setReviewAction(action);
    try {
      const res = await apiFetch(`/api/question-flags/${questionId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reviewNote: reviewNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      setReviewingId(null);
      setReviewAction('dismiss');
      setReviewNote('');
      loadFlags();
    } catch (e: any) {
      setError(e.message || 'Review failed.');
      setReviewingId(null);
    }
  };

  const flaggedCount = rows.length;
  const unreviewedCount = rows.filter((r) => !r.questionFlag?.reviewed).length;
  const reviewedCount = rows.filter((r) => r.questionFlag?.reviewed).length;

  const actionLabel = (a: 'dismiss' | 'revise' | 'keep') => {
    if (a === 'dismiss') return 'Dismiss Flag';
    if (a === 'revise') return 'Mark for Revision';
    return 'Keep Flag Active';
  };

  const actionVariant = (a: 'dismiss' | 'revise' | 'keep') => {
    if (a === 'dismiss') return 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
    if (a === 'revise') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
    return 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-700';
  };

  const reviewDialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReviewingId(null)} />
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Review Question Flag</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Decide how to handle this flagged question. <b>Dismiss</b> clears the
          flag (question stays as-is), <b>Revise</b> clears the flag and marks
          it for curriculum revision, or <b>Keep</b> to acknowledge review while
          leaving the flag active.
        </p>
        <div className="space-y-3">
          <label className="block text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Review Action
          </label>
          <div className="space-y-2">
            {(['dismiss', 'revise', 'keep'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setReviewAction(a)}
                className={`w-full text-left px-3 py-2 text-xs font-mono rounded-lg border transition-colors ${
                  reviewAction === a
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {actionLabel(a)}
              </button>
            ))}
          </div>
          <label className="block text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 mt-3">
            Review Note (optional)
          </label>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Why this decision? (optional)"
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            rows={3}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setReviewingId(null)}
            className="px-4 py-2 text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => handleReview(reviewingId!, reviewAction)}
            disabled={reviewingId === null}
            className={`px-4 py-2 text-xs font-mono rounded-lg ${actionVariant(reviewAction)}`}
          >
            {reviewingId === null ? (
              <span>Disabled</span>
            ) : (
              <>
                {reviewAction === 'dismiss' ? <X className="w-3.5 h-3.5 mr-1.5" /> : null}
                {reviewAction === 'revise' ? <Edit className="w-3.5 h-3.5 mr-1.5" /> : null}
                {actionLabel(reviewAction)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <PageHeader
              title="Question Flag Review"
              desc="Questions where 50%+ of students failed an easy item — review and route to curriculum revision"
              icon={<ShieldAlert className="h-5 w-5 text-amber-500" />}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={loadFlags}
              disabled={loading}
              className="text-xs font-mono border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Summary metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase mb-1">Flagged Questions</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{flaggedCount}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase mb-1">Awaiting Review</div>
            <div className="text-2xl font-bold text-rose-500">{unreviewedCount}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase mb-1">Reviewed</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{reviewedCount}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-800 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Flagged questions table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
            <h3 className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 uppercase">
              Needs Curriculum Review ({flaggedCount})
            </h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
              Loading flagged questions…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No questions currently flagged. All clear.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">
                  <th className="px-4 py-3 font-medium">Question</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Fail Rate</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Flag Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => {
                  const flag = q.questionFlag;
                  const isReviewed = Boolean(flag?.reviewed);
                  const failRate = q.liveFailRate ?? 0;
                  return (
                    <tr
                      key={q.questionId}
                      className={`border-b border-slate-100 dark:border-slate-700 ${!isReviewed ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{q.questionText}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {q.questionId}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        L{q.level}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{q.section}</td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900 dark:text-slate-100">
                        {failRate >= 0.5 ? `${Math.round(failRate * 100)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        {q.liveAttempts ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate" title={flag?.reason || ''}>
                        {flag?.reason || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${
                          isReviewed
                            ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                        }`}>
                          {isReviewed ? 'Reviewed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setReviewingId(q.questionId);
                            setReviewNote('');
                          }}
                          disabled={reviewingId !== null}
                          className={`text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            isReviewed
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-default'
                              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isReviewed ? 'Reviewed' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {reviewingId && reviewDialog}
    </div>
  );
};
