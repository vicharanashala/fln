import { apiFetch } from '../services/apiClient';
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
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Reviewed' | 'Resolved'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'general' | 'curriculum'>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority_high' | 'priority_low'>('newest')

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

  useEffect(() => {
    fetchTickets();
  }, [token]);

  const priorityRank: Record<Ticket['priority'], number> = {
    Low: 1,
    Medium: 2,
    High: 3,
    Urgent: 4,
  };

  const visibleTickets = React.useMemo(() => {
    let result = tickets.filter(
      t =>
        (statusFilter === 'All' || t.status === statusFilter) &&
        (typeFilter === 'All' || t.type === typeFilter)
    );

    result = [...result].sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

        case 'priority_high':
          return priorityRank[b.priority] - priorityRank[a.priority];

        case 'priority_low':
          return priorityRank[a.priority] - priorityRank[b.priority];

        default:
          return 0;
      }
    });

    return result;
  }, [tickets, statusFilter, typeFilter, sortOrder]);

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
        body: JSON.stringify({ type, subject, description, priority })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Ticket raised successfully and routed to Superadmin review queue.');
        setSubject('');
        setDescription('');
        fetchTickets();
        setTimeout(() => setSuccess(''), 4000);
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
      const res = await apiFetch(`/api/tickets/${ticketId}/resolve`, {
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
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'Low' | 'Medium' | 'High' | 'Urgent')}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 focus:border-zinc-500 focus:ring-0 outline-none text-zinc-900 dark:text-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
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
                className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
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
              Superadmins act as the final resolution and compliance audit authority. Creating new feedback tickets is restricted at this level.
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
          {userRole === UserRole.SUPERADMIN && (
            <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              {/* Status Filter */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as 'All' | 'Open' | 'Reviewed' | 'Resolved'
                    )
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="All">All</option>
                  <option value="Open">Open</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(
                      e.target.value as 'All' | 'general' | 'curriculum'
                    )
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="All">All</option>
                  <option value="general">General</option>
                  <option value="curriculum">Curriculum</option>
                </select>
              </div>

              {/* Sort Filter */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Sort By
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(
                      e.target.value as
                      | 'newest'
                      | 'oldest'
                      | 'priority_high'
                      | 'priority_low'
                    )
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="priority_high">Priority (High → Low)</option>
                  <option value="priority_low">Priority (Low → High)</option>
                </select>
              </div>

              {/* Clear Filters */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('All');
                  setTypeFilter('All');
                  setSortOrder('newest');
                }}
                className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              >
                Clear Filters
              </button>

              {/* Results Count */}
              <div className="ml-auto text-sm text-zinc-500 dark:text-zinc-400">
                Showing <span className="font-semibold">{visibleTickets.length}</span>{' '}
                {visibleTickets.length === 1 ? 'ticket' : 'tickets'}
              </div>
            </div>
          )}
          {visibleTickets.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              No tickets exist
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTickets.map((t) => (
                <div key={t.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${t.type === 'curriculum' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                          {t.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${t.status === 'Open' ? 'bg-red-100 text-red-800' : t.status === 'Reviewed' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
                          }`}>
                          {t.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${t.priority === 'Urgent' ? 'bg-red-600 text-white' :
                          t.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                            t.priority === 'Low' ? 'bg-slate-100 text-slate-600' :
                              'bg-yellow-100 text-yellow-800'
                          }`}>
                          {t.priority || 'Medium'}
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
