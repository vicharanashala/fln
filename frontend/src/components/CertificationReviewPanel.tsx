import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { apiFetch } from '../services/apiClient';
import { Table, Column } from './Table';
import { User, UserRole } from '../types';
import { ShieldCheck, ShieldX, AlertCircle, RefreshCw, X } from 'lucide-react';

/**
 * Admin certification review queue (SRS R-7, Phase 5).
 *
 * Lists certifications filtered by status (default `review_needed`),
 * with Confirm/Revoke action buttons. Revoke opens a local modal that
 * collects a required reason. Survives role-switch via cache invalidation.
 */

type CertificationStatus = 'active' | 'review_needed' | 'revoked';

interface Certification {
  id: string;
  studentId: string;
  classNumber: number;
  level: number;
  decisionSnapshot: {
    outcome: 'eligible' | 'not_eligible' | 'insufficient_evidence';
    evaluatedAt: string;
    metTopics: string[];
    missingTopics: string[];
    unassessedTopics: string[];
  };
  status: CertificationStatus;
  version: number;
  issuedAt?: string;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  studentName?: string;
  classGroup?: string;
}

interface Student {
  id: string;
  name: string;
  classGroup: string;
  schoolId: string;
}

type QueueRow = Certification & { studentName: string; className: string };

interface Props {
  currentUser: User;
  token: string;
}

export const CertificationReviewPanel: React.FC<Props> = ({ currentUser, token }) => {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'review_needed' | 'all'>('review_needed');
  const [revokingCert, setRevokingCert] = useState<Certification | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cache invalidation: clear local state if role changes mid-session
  // (defends against the demo role-switcher).
  const prevRoleRef = useRef(currentUser.role);
  useEffect(() => {
    if (prevRoleRef.current !== currentUser.role) {
      prevRoleRef.current = currentUser.role;
      setRows([]);
      setError(null);
      setSuccessMsg(null);
    }
  }, [currentUser.role]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = view === 'all' ? '' : `?status=review_needed`;
      const certsRes = await apiFetch(`/api/certifications${statusParam}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!certsRes.ok) throw new Error(`HTTP ${certsRes.status}`);
      const certs: Certification[] = await certsRes.json();

      const joined: QueueRow[] = certs.map((c) => ({
        ...c,
        studentName: c.studentName ?? `Unknown (${c.studentId})`,
        className: c.classGroup ?? '—',
      }));
      setRows(joined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view, token]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-clear success toast after 5 seconds (matches the postAnnouncement
  // pattern at RoleDashboards.tsx:603-608).
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const handleConfirm = async (cert: Certification) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/certification/review/${encodeURIComponent(cert.id)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ decision: 'confirm' }),
      });
      if (res.status === 409) {
        setError('Another admin already resolved this. Refreshing.');
        await fetchQueue();
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      setSuccessMsg(`Confirmed certification for student ${cert.studentId}.`);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed.');
    }
  };

  const handleRevoke = async (cert: Certification, reason: string) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/certification/review/${encodeURIComponent(cert.id)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ decision: 'revoke', reason }),
      });
      if (res.status === 409) {
        setError('Another admin already resolved this. Refreshing.');
        await fetchQueue();
        setRevokingCert(null);
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      setSuccessMsg(`Revoked certification for student ${cert.studentId}.`);
      setRevokingCert(null);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed.');
      setRevokingCert(null);
    }
  };

  const columns: Column<QueueRow>[] = useMemo(() => [
    {
      header: 'Student',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-sm">{row.studentName}</div>
          <div className="text-[10px] font-mono text-slate-400">{row.studentId}</div>
        </div>
      ),
      sortKey: 'studentName',
    },
    { header: 'Class', accessor: 'className', sortKey: 'className' },
    { header: 'Level', accessor: 'level', sortKey: 'level' },
    {
      header: 'Version',
      accessor: (row) => <span className="font-mono text-xs">v{row.version}</span>,
      sortKey: 'version',
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusBadgeClass(row.status)}`}>
          {row.status.toUpperCase()}
        </span>
      ),
      sortKey: 'status',
    },
    {
      header: 'Review reason',
      accessor: (row) => (
        <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md truncate" title={row.reviewReason ?? ''}>
          {row.reviewReason ?? '—'}
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleConfirm(row)}
            disabled={row.status !== 'review_needed'}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="h-3 w-3" />
            Confirm
          </button>
          <button
            onClick={() => setRevokingCert(row)}
            disabled={row.status !== 'review_needed'}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldX className="h-3 w-3" />
            Revoke
          </button>
        </div>
      ),
    },
  ], [token]);

  const allowed = currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.ADMIN;
  if (!allowed) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4" />
          Forbidden: certification review requires Superadmin or Admin role.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Certification Reviews</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resolve <code>review_needed</code> certs. Active and revoked history visible via the toggle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('review_needed')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${view === 'review_needed' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
          >
            Awaiting review
          </button>
          <button
            onClick={() => setView('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${view === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
          >
            All
          </button>
          <button
            onClick={() => fetchQueue()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {successMsg}
        </div>
      )}

      <Table
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage={view === 'review_needed' ? 'No certifications awaiting review. Great work — the queue is clear.' : 'No certifications found.'}
        searchPlaceholder="Search by student, class, or reason..."
        searchKey={(row) => `${row.studentName} ${row.className} ${row.reviewReason ?? ''} ${row.status}`}
      />

      {revokingCert && (
        <RevokeModal
          cert={revokingCert}
          onCancel={() => setRevokingCert(null)}
          onConfirm={(reason) => handleRevoke(revokingCert, reason)}
        />
      )}
    </div>
  );
};

function statusBadgeClass(status: CertificationStatus): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
  if (status === 'review_needed') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
}

interface RevokeModalProps {
  cert: Certification;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const RevokeModal: React.FC<RevokeModalProps> = ({ cert, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea on open, close on Esc, click-outside to dismiss.
  useEffect(() => {
    textareaRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel, submitting]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !submitting) onCancel();
  };

  const handleSubmit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="revoke-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Revoke certification
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Student <span className="font-mono">{cert.studentId}</span> · Class {cert.classNumber} · Level {cert.level}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label htmlFor="revoke-reason" className="block text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
          Reason (required)
        </label>
        <textarea
          id="revoke-reason"
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
          placeholder="e.g. OCR misread confirmed by teacher; re-evaluation pending."
          rows={4}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      </div>
    </div>
  );
};
