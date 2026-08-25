// Issue #182: real bulk-request history (was a hardcoded mock array — same
// bug class as FLN-C/#170). Fetches from GET /api/teachers/:id/test-history.
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/apiClient';
import { PageHeader } from './PanelShared';
import { FileText } from 'lucide-react';
import { User } from '../../types';

interface TestHistoryEntry {
  id: string;
  teacherId: string;
  teacherEmail: string;
  requestType: 'diagnostic' | 'practice' | 'remedial' | 'midline' | 'endline';
  timestamp: string;
  studentCount: number;
  classId?: string;
  className?: string;
  schoolId?: string;
}

const REQUEST_TYPE_LABELS: Record<TestHistoryEntry['requestType'], string> = {
  diagnostic: 'Diagnostic',
  practice: 'Practice',
  remedial: 'Remedial',
  midline: 'Midline',
  endline: 'Endline',
};

interface TestHistoryPanelProps {
  currentUser: User;
  token: string;
}

export const TestHistoryPanel: React.FC<TestHistoryPanelProps> = ({ currentUser, token }) => {
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TestHistoryEntry['requestType']>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch(`/api/teachers/${currentUser.id}/test-history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load test history.');
        const data = await res.json();
        if (!cancelled) setHistory(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load test history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser.id, token]);

  const filtered = typeFilter === 'all' ? history : history.filter(h => h.requestType === typeFilter);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
      <PageHeader title="Test History" desc="Your bulk test and worksheet requests" icon={<FileText className="h-5 w-5" />} />

      <div className="flex flex-wrap gap-2">
        {(['all', 'diagnostic', 'practice', 'remedial', 'midline', 'endline'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-[10px] font-mono font-semibold px-2.5 py-1.5 rounded border transition-colors ${
              typeFilter === t
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {t === 'all' ? 'All' : REQUEST_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">No requests yet{typeFilter !== 'all' ? ` of type "${REQUEST_TYPE_LABELS[typeFilter]}"` : ''}.</p>
      )}

      <div className="space-y-3">
        {filtered.map(h => (
          <div key={h.id} className="flex justify-between items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
            <div>
              <div className="font-semibold text-sm">{REQUEST_TYPE_LABELS[h.requestType]}{h.className ? ` — ${h.className}` : ''}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">{new Date(h.timestamp).toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold">{h.studentCount}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">student{h.studentCount === 1 ? '' : 's'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
