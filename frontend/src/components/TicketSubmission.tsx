import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { Ticket, UserRole } from '../types';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Layers,
  Check,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Tag,
  Clock,
  UserCheck,
  Edit3,
  RotateCcw
} from 'lucide-react';

interface TicketSubmissionProps {
  token: string;
  userRole: UserRole;
}

export const TicketSubmission: React.FC<TicketSubmissionProps> = ({ token, userRole }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'general' | 'curriculum'>('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-flag filter & scan states
  const [activeTab, setActiveTab] = useState<'all' | 'autoflag' | 'easy' | 'medium' | 'actions_taken' | 'pending' | 'curriculum' | 'general'>('all');
  const [scanning, setScanning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

  const [auditSummary, setAuditSummary] = useState<{
    totalFlagged: number;
    openFlags: number;
    reviewedFlags: number;
    resolvedFlags: number;
    criticalFlagsCount: number;
    easyFlagsCount?: number;
    mediumFlagsCount?: number;
    averageFailureRate: number;
  } | null>(null);

  const fetchTickets = async () => {
    try {
      const res = await apiFetch('/api/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTickets(data);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    }
  };

  const fetchAuditSummary = async () => {
    if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMIN) return;
    try {
      const res = await apiFetch('/api/governance/auto-flag/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditSummary(data);
      }
    } catch (err) {
      console.error('Error fetching audit summary:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchAuditSummary();
  }, [token, userRole]);

  const toggleExpand = (ticketId: string) => {
    setExpandedTickets(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
  };

  const isTicketExpanded = (t: Ticket) => {
    if (expandedTickets[t.id] !== undefined) {
      return expandedTickets[t.id];
    }
    return t.status !== 'Resolved';
  };

  const handleResetAuditState = async () => {
    if (!window.confirm('Reset all pedagogical auto-flags and test student records for a clean test?')) return;
    setResetting(true);
    setScanMessage('');
    try {
      const res = await apiFetch('/api/governance/auto-flag/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setScanMessage('Dashboard reset successfully! Ready for fresh student testing.');
        fetchTickets();
        fetchAuditSummary();
      } else {
        setScanMessage(`Reset error: ${data.error || 'Failed to reset'}`);
      }
    } catch (err) {
      setScanMessage('Failed to execute reset.');
    } finally {
      setResetting(false);
    }
  };

  const handleRunAuditScan = async () => {
    setScanning(true);
    setScanMessage('');
    try {
      const res = await apiFetch('/api/governance/auto-flag/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ minAttempts: 3, failureThreshold: 0.50, mediumFailureThreshold: 0.70 })
      });
      const data = await res.json();
      if (res.ok) {
        setScanMessage(`Audit Scan Complete: ${data.createdCount} new flag(s) identified, ${data.updatedCount} updated.`);
        fetchTickets();
        fetchAuditSummary();
      } else {
        setScanMessage(`Scan error: ${data.error || 'Failed to complete scan'}`);
      }
    } catch (err: any) {
      setScanMessage('Failed to execute quality audit scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) {
      setError('Please fill in all ticket fields.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/tickets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, subject, description })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Ticket raised successfully and routed to Superadmin review queue.');
        setSubject('');
        setDescription('');
        fetchTickets();
      } else {
        setError(data.error || 'Failed to submit ticket.');
      }
    } catch (err) {
      setError('Network error submitting ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveWithAction = async (
    ticketId: string,
    nextStatus: 'Reviewed' | 'Resolved',
    reclassifiedBand?: 'easy' | 'medium' | 'hard' | 'confirmed',
    actionTakenLabel?: string,
    resolutionNote?: string
  ) => {
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: nextStatus,
          reclassifiedBand,
          actionTaken: actionTakenLabel,
          resolutionNote: resolutionNote || actionTakenLabel
        })
      });
      if (res.ok) {
        setExpandedTickets(prev => ({ ...prev, [ticketId]: false }));
        setEditingTicketId(null);
        fetchTickets();
        fetchAuditSummary();
      }
    } catch (err) {
      console.error('Failed to update ticket:', err);
    }
  };

  /**
   * Derives the explicit Action Taken label, badge colors, and category
   */
  const getActionMetadata = (t: Ticket) => {
    const diff = (t.flagDetails?.difficulty || 'easy').toUpperCase();
    const origDiff = (t.flagDetails?.originalDifficulty || (t.reclassifiedBand === 'medium' ? 'Easy' : (t.reclassifiedBand === 'hard' ? 'Medium' : t.flagDetails?.difficulty || 'easy'))).toUpperCase();
    const isResolved = t.status === 'Resolved';
    const isReviewed = t.status === 'Reviewed';

    if (!isResolved && !isReviewed) {
      return {
        hasAction: false,
        actionLabel: 'PENDING ACTION',
        actionTitle: 'Pending Superadmin Review',
        badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800',
        pillBg: 'bg-amber-500 text-white',
        description: 'Awaiting pedagogical evaluation and action by Superadmin.'
      };
    }

    if (isReviewed && !isResolved) {
      return {
        hasAction: true,
        actionLabel: 'ACTION: MARKED REVIEWED',
        actionTitle: 'Marked as Reviewed',
        badgeBg: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800',
        pillBg: 'bg-indigo-600 text-white',
        description: t.actionTaken || 'Preliminary review complete; pending final curriculum decision.'
      };
    }

    // Specific Reclassifications
    if (t.reclassifiedBand === 'medium') {
      return {
        hasAction: true,
        actionLabel: 'ACTION: RECLASSIFIED TO MEDIUM',
        actionTitle: `Reclassified from ${origDiff} to Medium`,
        badgeBg: 'bg-violet-100 text-violet-900 dark:bg-violet-950/80 dark:text-violet-200 border-violet-300 dark:border-violet-800',
        pillBg: 'bg-violet-600 text-white',
        description: `Question difficulty successfully elevated to Medium in the active curriculum pool.`
      };
    }

    if (t.reclassifiedBand === 'hard') {
      return {
        hasAction: true,
        actionLabel: 'ACTION: RECLASSIFIED TO HARD',
        actionTitle: `Reclassified from ${origDiff} to Hard`,
        badgeBg: 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-800',
        pillBg: 'bg-rose-600 text-white',
        description: `Question difficulty reclassified to Hard due to severe student failure rate (≥85%).`
      };
    }

    if (t.reclassifiedBand === 'easy') {
      return {
        hasAction: true,
        actionLabel: 'ACTION: RECLASSIFIED TO EASY',
        actionTitle: `Reclassified to Easy`,
        badgeBg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
        pillBg: 'bg-emerald-600 text-white',
        description: `Question reclassified to Easy for Foundational Literacy & Numeracy.`
      };
    }

    if (t.reclassifiedBand === 'confirmed') {
      return {
        hasAction: true,
        actionLabel: `ACTION: CONFIRMED AS ${diff}`,
        actionTitle: `Confirmed & Retained as ${diff}`,
        badgeBg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
        pillBg: 'bg-emerald-600 text-white',
        description: `Current ${diff} placement confirmed by Superadmin. Retained in current grade cohort.`
      };
    }

    // Custom or general action note
    const customText = t.actionTaken || t.resolutionNote || 'Verified & Resolved';
    return {
      hasAction: true,
      actionLabel: `ACTION: ${customText.toUpperCase()}`,
      actionTitle: customText,
      badgeBg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
      pillBg: 'bg-emerald-600 text-white',
      description: customText
    };
  };

  // Filter tickets by active tab
  const filteredTickets = tickets.filter(t => {
    const isAuto = t.isAutoFlag || t.subject.startsWith('[AUTO-FLAG');
    const diff = (t.flagDetails?.difficulty || '').toLowerCase();
    const isResolved = t.status === 'Resolved';
    const isReviewed = t.status === 'Reviewed';

    if (activeTab === 'autoflag') return isAuto;
    if (activeTab === 'easy') return isAuto && diff === 'easy';
    if (activeTab === 'medium') return isAuto && diff === 'medium';
    if (activeTab === 'actions_taken') return isResolved || isReviewed;
    if (activeTab === 'pending') return !isResolved && !isReviewed;
    if (activeTab === 'curriculum') return t.type === 'curriculum' && !isAuto;
    if (activeTab === 'general') return t.type === 'general';
    return true;
  });

  const autoFlagCount = tickets.filter(t => t.isAutoFlag || t.subject.startsWith('[AUTO-FLAG')).length;
  const easyFlagCount = tickets.filter(t => (t.isAutoFlag || t.subject.startsWith('[AUTO-FLAG')) && (t.flagDetails?.difficulty || '').toLowerCase() === 'easy').length;
  const mediumFlagCount = tickets.filter(t => (t.isAutoFlag || t.subject.startsWith('[AUTO-FLAG')) && (t.flagDetails?.difficulty || '').toLowerCase() === 'medium').length;
  const actionsTakenCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Reviewed').length;
  const pendingCount = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Reviewed').length;

  return (
    <div className="space-y-6" id="ticket-submission">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            Pedagogical Review & Action Governance Queue
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Superadmin oversight portal for curriculum tickets, anomaly reclassifications, and recorded pedagogical actions.
          </p>
        </div>

        {userRole === UserRole.SUPERADMIN && (
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleResetAuditState}
              disabled={resetting || scanning}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 transition disabled:opacity-50 cursor-pointer"
              title="Reset all auto-flags and demo student records for a clean test"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span>{resetting ? 'Resetting...' : '↺ Reset Quality Audit Data'}</span>
            </button>
            <button
              onClick={handleRunAuditScan}
              disabled={scanning || resetting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning Student Cohorts...' : 'Run Quality Audit Scan'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Superadmin Quality Audit KPI Banner (SRS Rule R-15 & Multi-Tier QA) */}
      {userRole === UserRole.SUPERADMIN && auditSummary && (
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-violet-500/10 border border-amber-300 dark:border-amber-700/50 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400 text-sm font-bold tracking-wide uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Automated Pedagogical Quality Audit (SRS Rule R-15 & Action Tracking)
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Monitors live student error rates: flags Easy questions (≥ 50% fail) and Medium questions (≥ 70% fail) for Superadmin reclassification and action recording.
              </p>
              {scanMessage && (
                <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 pt-1">
                  ℹ️ {scanMessage}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center min-w-[85px]">
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{auditSummary.totalFlagged}</div>
                <div className="text-[10px] text-zinc-500 uppercase font-medium">Total Flags</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center min-w-[85px]">
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{auditSummary.easyFlagsCount ?? easyFlagCount}</div>
                <div className="text-[10px] text-zinc-500 uppercase font-medium">Easy (≥50%)</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center min-w-[85px]">
                <div className="text-lg font-bold text-violet-600 dark:text-violet-400">{auditSummary.mediumFlagsCount ?? mediumFlagCount}</div>
                <div className="text-[10px] text-zinc-500 uppercase font-medium">Medium (≥70%)</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center min-w-[85px]">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{actionsTakenCount}</div>
                <div className="text-[10px] text-zinc-500 uppercase font-medium">Actions Taken</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center min-w-[85px]">
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {auditSummary.averageFailureRate}%
                </div>
                <div className="text-[10px] text-zinc-500 uppercase font-medium">Avg Fail Rate</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create ticket form or Admin Notice */}
        {userRole !== UserRole.SUPERADMIN ? (
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm h-fit">
            <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-4">Raise a New Ticket</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded border border-red-100 dark:border-red-800">{error}</div>}
              {success && <div className="p-3 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded border border-green-100 dark:border-green-800">{success}</div>}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Ticket Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'general' | 'curriculum')}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:ring-0 outline-none text-zinc-900 dark:text-white"
                >
                  <option value="general">General / Process (All Roles)</option>
                  {(userRole === UserRole.TEACHER || userRole === UserRole.VOLUNTEER) && (
                    <option value="curriculum">Curriculum / Content Feedback</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 focus:border-zinc-500 focus:ring-0 outline-none bg-white dark:bg-slate-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Detailed Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Elaborate on the topic, syllabus reference, or observed issue..."
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 focus:border-zinc-500 focus:ring-0 outline-none bg-white dark:bg-slate-800 text-zinc-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-1 bg-zinc-900 text-white p-6 border border-zinc-800 rounded-xl shadow-sm h-fit space-y-4">
            <h3 className="text-base font-display font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>Superadmin Action Authority</span>
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Every decision executed here is logged as an official pedagogical action in the national logbook. The interface displays the exact decision taken (such as reclassification or cohort confirmation).
            </p>
            <div className="p-3.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50 text-[11px] text-zinc-300 leading-normal space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">⚡ Rule R-15:</span>
                <span>Flags Easy questions with failure rates ≥ 50% and Medium questions ≥ 70%.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">🎯 Action View:</span>
                <span>Cards display the exact action taken (e.g. <em>Reclassified to Medium</em>, <em>Confirmed in Cohort</em>) instead of generic status.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tickets listing with Filter Tabs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
              {userRole === UserRole.SUPERADMIN ? 'Action & Review Queue' : 'Your Submitted Tickets'}
            </h3>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                All ({tickets.length})
              </button>
              <button
                onClick={() => setActiveTab('autoflag')}
                className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 cursor-pointer ${
                  activeTab === 'autoflag'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                }`}
              >
                <span>⚠️ Auto-Flags ({autoFlagCount})</span>
              </button>
              <button
                onClick={() => setActiveTab('actions_taken')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 cursor-pointer ${
                  activeTab === 'actions_taken'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-green-700 dark:text-green-400 hover:text-green-800'
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                <span>Actions Taken ({actionsTakenCount})</span>
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-700 dark:text-amber-400 hover:text-amber-800'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setActiveTab('easy')}
                className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
                  activeTab === 'easy'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                }`}
              >
                Easy ({easyFlagCount})
              </button>
              <button
                onClick={() => setActiveTab('medium')}
                className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
                  activeTab === 'medium'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-violet-700 dark:text-violet-400 hover:text-violet-800'
                }`}
              >
                Medium ({mediumFlagCount})
              </button>
              <button
                onClick={() => setActiveTab('curriculum')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                  activeTab === 'curriculum'
                    ? 'bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Curriculum
              </button>
              <button
                onClick={() => setActiveTab('general')}
                className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                  activeTab === 'general'
                    ? 'bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                General
              </button>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              No matching tickets found in this view.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((t) => {
                const isAutoFlag = t.isAutoFlag || t.subject.startsWith('[AUTO-FLAG');
                const flagDetails = t.flagDetails;
                const diff = (flagDetails?.difficulty || 'easy').toUpperCase();
                const isMediumFlag = diff === 'MEDIUM';
                const expanded = isTicketExpanded(t);
                const isResolved = t.status === 'Resolved';
                const failureRate = flagDetails?.failureRate || 0;
                const isSevereAnomaly = failureRate >= 85;
                const actionMeta = getActionMetadata(t);
                const isEditingThis = editingTicketId === t.id;

                return (
                  <div
                    key={t.id}
                    className={`bg-white dark:bg-slate-900 border rounded-xl shadow-sm transition overflow-hidden ${
                      isResolved
                        ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/15 dark:bg-emerald-950/10'
                        : isAutoFlag
                        ? isMediumFlag
                          ? 'border-violet-300 dark:border-violet-700/60 bg-violet-50/20 dark:bg-violet-950/10'
                          : 'border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    {/* Header Row (Always visible, displays action taken prominently) */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onClick={() => toggleExpand(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(t.id);
                        }
                      }}
                      className="p-4 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-slate-800/40 transition flex items-start justify-between gap-3 select-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-t-xl"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {isAutoFlag ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase text-white tracking-wider flex items-center gap-1 ${
                              isMediumFlag ? 'bg-violet-600' : 'bg-amber-500'
                            }`}>
                              <span>⚠️ {isMediumFlag ? 'AUTO-FLAG: MEDIUM' : 'AUTO-FLAG (R-15)'}</span>
                              {flagDetails?.failureRate !== undefined && (
                                <span className={`${isMediumFlag ? 'bg-violet-800' : 'bg-amber-700'} px-1 py-0.2 rounded text-[9px]`}>
                                  {flagDetails.failureRate}% Fail
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                              t.type === 'curriculum' ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {t.type}
                            </span>
                          )}

                          {/* ACTION TAKEN BADGE (Replaces plain "Resolved" status badge) */}
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border flex items-center gap-1 shadow-xs ${actionMeta.badgeBg}`}>
                            {actionMeta.hasAction ? (
                              <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            )}
                            <span>{actionMeta.actionLabel}</span>
                          </span>

                          {flagDetails?.level && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              Level {flagDetails.level}
                            </span>
                          )}

                          {/* Recommendation badge if unresolved */}
                          {!isResolved && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              isSevereAnomaly
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                            }`}>
                              {isSevereAnomaly
                                ? `Recommend: Reclassify to ${isMediumFlag ? 'HARD' : 'MEDIUM'}`
                                : 'Recommend: Keep in Cohort'}
                            </span>
                          )}
                        </div>

                        <h4 className="font-display font-medium text-zinc-900 dark:text-white text-sm">
                          {t.subject}
                        </h4>

                        {!expanded && (
                          <div className="text-xs truncate flex items-center gap-2">
                            {isResolved ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <strong>Action Taken:</strong> {actionMeta.actionTitle}
                              </span>
                            ) : (
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {flagDetails?.questionText ? `"${flagDetails.questionText}"` : t.description.slice(0, 100)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-400">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                          title={expanded ? "Collapse Request" : "Expand Full Request"}
                        >
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Body */}
                    {expanded && (
                      <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
                        {/* Auto-flag structured diagnostic pillbox */}
                        {isAutoFlag && flagDetails && (
                          <div className={`mt-3 border rounded-xl p-4 text-xs space-y-3 bg-white dark:bg-slate-800/90 ${
                            isResolved
                              ? 'border-emerald-200 dark:border-emerald-800/60'
                              : isMediumFlag
                              ? 'border-violet-200 dark:border-violet-800/60'
                              : 'border-amber-200 dark:border-amber-800/60'
                          }`}>
                            {/* Summary Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-150 dark:border-zinc-700/50">
                                <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Question ID</span>
                                <strong className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{flagDetails.questionId}</strong>
                              </div>
                              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-150 dark:border-zinc-700/50">
                                <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Difficulty Band</span>
                                <span className={`font-bold uppercase text-xs ${
                                  isMediumFlag ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}>{flagDetails.difficulty}</span>
                              </div>
                              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-150 dark:border-zinc-700/50">
                                <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Cohort Attempts</span>
                                <strong className="text-xs text-zinc-800 dark:text-zinc-200">{flagDetails.attempts} students</strong>
                              </div>
                              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-150 dark:border-zinc-700/50">
                                <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Failure Rate</span>
                                <strong className="text-xs text-red-600 dark:text-red-400 font-bold">{flagDetails.failureRate}% ({flagDetails.failures} failed)</strong>
                              </div>
                            </div>

                            {/* Question Prompt Box */}
                            {flagDetails.questionText && (
                              <div className="bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700/50 space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Question Prompt</span>
                                <p className="text-zinc-900 dark:text-zinc-100 font-medium text-xs leading-relaxed italic">
                                  "{flagDetails.questionText}"
                                </p>
                              </div>
                            )}

                            {/* Expected Key */}
                            {flagDetails.expectedAnswer && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-medium">Expected Key:</span>
                                <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded font-mono font-bold text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                  {flagDetails.expectedAnswer}
                                </code>
                              </div>
                            )}

                            {/* PEDAGOGICAL ACTION TAKEN HIGHLIGHT BOX (When Resolved) */}
                            {isResolved ? (
                              <div className="mt-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Pedagogical Action Taken: {actionMeta.actionTitle}</span>
                                  </div>
                                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                    {actionMeta.description}
                                  </p>
                                  {t.actionTakenAt && (
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                      Recorded on {new Date(t.actionTakenAt).toLocaleString()}
                                    </div>
                                  )}
                                </div>

                                {userRole === UserRole.SUPERADMIN && !isEditingThis && (
                                  <button
                                    onClick={() => setEditingTicketId(t.id)}
                                    className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-200 font-semibold rounded-md border border-emerald-300 dark:border-emerald-700 text-xs transition cursor-pointer flex items-center gap-1 shrink-0 self-start sm:self-auto"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Change Action</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              /* Recommendation Banner for Unresolved Anomalies */
                              <div className={`text-xs font-semibold px-3 py-2 rounded-md border flex items-center gap-2 ${
                                isSevereAnomaly
                                  ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800'
                                  : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800'
                              }`}>
                                {isSevereAnomaly ? (
                                  <>
                                    <span>⚠️ Severe Anomaly (≥ 85% Failed):</span>
                                    <span className="underline uppercase font-bold">
                                      Recommend Reclassifying to {isMediumFlag ? 'HARD' : 'MEDIUM'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span>ℹ️ Moderate Anomaly (&lt; 85% Failed):</span>
                                    <span className="underline font-bold">
                                      Recommend Keeping in Current Cohort ({diff})
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Description (for non-autoflag or additional context) */}
                        {!isAutoFlag && (
                          <div className="text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-lg border border-zinc-150 dark:border-zinc-700/50">
                            {t.description}
                          </div>
                        )}

                        {/* Footer & Action Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                          <div className="text-zinc-500 text-[11px]">
                            Filed by: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{t.userName}</span> ({t.userRole})
                          </div>

                          {/* Approval / Reclassification Actions for Superadmin */}
                          {userRole === UserRole.SUPERADMIN && (!isResolved || isEditingThis) && (
                            <div className="flex flex-wrap items-center gap-2">
                              {isEditingThis && (
                                <button
                                  onClick={() => setEditingTicketId(null)}
                                  className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg text-xs transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}

                              {/* Reclassification Controls for Easy Questions */}
                              {isAutoFlag && diff === 'EASY' && (
                                <>
                                  <button
                                    onClick={() => handleResolveWithAction(t.id, 'Resolved', 'medium', 'Reclassified from Easy to Medium')}
                                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Set action: Reclassify from Easy to Medium"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Take Action: Reclassify to Medium</span>
                                  </button>
                                  <button
                                    onClick={() => handleResolveWithAction(t.id, 'Resolved', 'hard', 'Reclassified from Easy to Hard')}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Set action: Reclassify from Easy to Hard"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Take Action: Reclassify to Hard</span>
                                  </button>
                                  <button
                                    onClick={() => handleResolveWithAction(t.id, 'Resolved', 'confirmed', 'Confirmed & Retained in Easy Cohort')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Set action: Confirm and Keep as Easy"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Take Action: Keep as Easy</span>
                                  </button>
                                </>
                              )}

                              {/* Reclassification Controls for Medium Questions */}
                              {isAutoFlag && diff === 'MEDIUM' && (
                                <>
                                  <button
                                    onClick={() => handleResolveWithAction(t.id, 'Resolved', 'hard', 'Reclassified from Medium to Hard')}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Set action: Reclassify from Medium to Hard"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Take Action: Reclassify to Hard</span>
                                  </button>
                                  <button
                                    onClick={() => handleResolveWithAction(t.id, 'Resolved', 'confirmed', 'Confirmed & Retained in Medium Cohort')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Set action: Confirm and Keep as Medium"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Take Action: Keep as Medium</span>
                                  </button>
                                </>
                              )}

                              {/* General Non-Autoflag Ticket Actions */}
                              {!isAutoFlag && (
                                <>
                                  {t.status === 'Open' && (
                                    <button
                                      onClick={() => handleResolveWithAction(t.id, 'Reviewed', undefined, 'Marked as Reviewed')}
                                      className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition"
                                    >
                                      Mark Reviewed
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleResolveWithAction(t.id, 'Resolved', 'confirmed', 'Curriculum Issue Resolved')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer transition flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Take Action: Resolve Issue</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
