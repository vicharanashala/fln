import React, { useState, useEffect } from 'react';
import { Ticket, UserRole } from '../types';

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

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets', {
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

  useEffect(() => {
    fetchTickets();
  }, [token]);

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
      const res = await fetch('/api/tickets/create', {
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

  const handleResolve = async (ticketId: string, nextStatus: 'Reviewed' | 'Resolved') => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to update ticket:', err);
    }
  };

  return (
    <div className="space-y-6" id="ticket-submission">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">Pedagogical & Process Feedback Tickets</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Submit feedback on syllabus, exam timings, or report inconsistencies. Superadmins review all entries.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create ticket form or Admin Notice */}
        {userRole !== UserRole.SUPERADMIN ? (
          <div className="lg:col-span-1 h-fit rounded-[28px] border border-zinc-200/80 bg-white/90 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-zinc-700/80 dark:bg-slate-900/80">
            <h3 className="mb-4 text-lg font-display font-medium text-zinc-900 dark:text-white">Raise a New Ticket</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
              {success && <div className="rounded-2xl border border-green-200 bg-green-50/90 p-3 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">{success}</div>}

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-600 dark:text-zinc-300">Ticket Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'general' | 'curriculum')}
                  className="w-full rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-2.75 text-sm text-zinc-900 shadow-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                >
                  <option value="general">General / Process (All Roles)</option>
                  {(userRole === UserRole.TEACHER || userRole === UserRole.VOLUNTEER) && (
                    <option value="curriculum">Curriculum / Content Feedback</option>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-600 dark:text-zinc-300">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full rounded-2xl border border-zinc-200/80 bg-white/90 p-2.75 text-sm text-zinc-900 shadow-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700/80 dark:bg-slate-800/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-600 dark:text-zinc-300">Detailed Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Elaborate on the topic, syllabus reference, or observed issue..."
                  className="w-full rounded-[20px] border border-zinc-200/80 bg-white/90 p-2.75 text-sm text-zinc-900 shadow-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700/80 dark:bg-slate-800/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-zinc-900 px-4 py-2.75 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.95)] transition-all duration-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-1 bg-zinc-900 text-white p-6 border border-zinc-800 rounded-xl shadow-sm h-fit space-y-4">
            <h3 className="text-base font-display font-semibold text-zinc-100 flex items-center gap-2">
              🛡️ Superadmin Authority
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Superadmins act as the final resolution and compliance review authority. Creating new feedback tickets is restricted at this level.
            </p>
            <div className="p-3.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50 text-[11px] text-zinc-300 leading-normal">
              💡 Select any incoming ticket from the <strong>Global Review Queue</strong> to review historical comments, modify statuses, or input final resolutions.
            </div>
          </div>
        )}

        {/* Tickets listing */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
            {userRole === UserRole.SUPERADMIN ? 'Global Review Queue' : 'Your Submitted Tickets'}
          </h3>

          {tickets.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              No active feedback tickets found.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          t.type === 'curriculum' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {t.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          t.status === 'Open' ? 'bg-red-100 text-red-800' : t.status === 'Reviewed' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <h4 className="font-display font-medium text-zinc-900 dark:text-white mt-2">{t.subject}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">{t.description}</p>

                  <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-700 text-[10px] text-zinc-400 dark:text-zinc-500">
                    <div>
                      Filed by: <span className="font-medium text-zinc-700 dark:text-zinc-200">{t.userName}</span> ({t.userRole})
                    </div>

                    {userRole === UserRole.SUPERADMIN && t.status !== 'Resolved' && (
                      <div className="flex gap-2">
                        {t.status === 'Open' && (
                          <button
                            onClick={() => handleResolve(t.id, 'Reviewed')}
                            className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium px-2 py-1 rounded"
                          >
                            Mark Reviewed
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(t.id, 'Resolved')}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium px-2 py-1 rounded"
                        >
                          Resolve Issue
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
