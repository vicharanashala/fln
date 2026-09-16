import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/apiClient';
import { Award, AlertCircle, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

/**
 * Per-student certification history block (SRS R-7, Phase 5).
 *
 * Fetches GET /api/certifications?studentId=<id> and renders one card per
 * (classNumber, level) bucket with the current status. The card mounts
 * fresh each time the panel unmounts (e.g. teacher navigates away), so the
 * useRef cache is scoped to the panel's lifetime — no cross-session
 * staleness risk.
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
}

interface Props {
  studentId: string;
  token: string;
}

function statusBadge(status: CertificationStatus) {
  if (status === 'active') return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', icon: ShieldCheck, label: 'Certified' };
  if (status === 'review_needed') return { color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800', icon: ShieldAlert, label: 'Review needed' };
  return { color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800', icon: ShieldX, label: 'Revoked' };
}

export const CertificationHistoryCard: React.FC<Props> = ({ studentId, token }) => {
  const [certs, setCerts] = useState<Certification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cache is scoped to this card's mount lifetime. useRef survives re-renders
  // but resets on unmount — exactly the staleness guarantee we want.
  const cacheRef = useRef<Map<string, Certification[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    if (cacheRef.current.has(studentId)) {
      setCerts(cacheRef.current.get(studentId)!);
      setError(null);
      return;
    }
    setCerts(null);
    setError(null);
    apiFetch(`/api/certifications?studentId=${encodeURIComponent(studentId)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Certification[]) => {
        if (cancelled) return;
        cacheRef.current.set(studentId, data);
        setCerts(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, token]);

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          Failed to load certification history.
        </div>
      </div>
    );
  }

  if (certs === null) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm animate-pulse">
        <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded mb-2" />
        <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (certs.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-4 w-4 text-slate-400" />
          <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Certification History</h4>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Not yet eligible — engine has not completed a re-evaluation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-slate-400" />
        <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Certification History</h4>
      </div>
      <div className="space-y-2">
        {certs.map((c) => {
          const badge = statusBadge(c.status);
          const BadgeIcon = badge.icon;
          return (
            <div
              key={c.id}
              className={`border rounded-lg p-3 ${badge.color}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeIcon className="h-4 w-4" />
                  <span className="font-bold text-sm">Class {c.classNumber} · Level {c.level}</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/60 dark:bg-black/30 border border-current/30">
                  v{c.version}
                </span>
              </div>
              <div className="mt-1 text-xs">
                <span className="font-mono uppercase tracking-wide opacity-70">{badge.label}</span>
                {c.issuedAt && (
                  <span className="opacity-70 ml-2">· issued {new Date(c.issuedAt).toLocaleDateString()}</span>
                )}
                {c.decisionSnapshot.outcome && (
                  <span className="opacity-70 ml-2">· verdict: {c.decisionSnapshot.outcome.replace('_', ' ')}</span>
                )}
              </div>
              {c.reviewReason && (
                <div className="mt-1 text-xs opacity-80">
                  Review reason: {c.reviewReason}
                </div>
              )}
              {c.reviewedBy && c.reviewedAt && (
                <div className="mt-1 text-xs opacity-70">
                  Resolved by {c.reviewedBy} on {new Date(c.reviewedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};