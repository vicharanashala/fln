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

  const [activeTab, setActiveTab] = useState<'general' | 'appeals'>('general');
  const [expandedAppeals, setExpandedAppeals] = useState<string[]>([]);

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

  const handleResolve = async (ticketId: string, nextStatus: string) => {
    try {
      const endpoint = (nextStatus === 'APPROVED' || nextStatus === 'REJECTED') 
        ? `/api/admin/tickets/${ticketId}/resolve` 
        : `/api/tickets/${ticketId}/resolve`;
        
      const method = (nextStatus === 'APPROVED' || nextStatus === 'REJECTED') ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchTickets();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update ticket');
      }
    } catch (err) {
      console.error('Failed to update ticket:', err);
      alert('Failed to connect to server.');
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedAppeals.includes(id)) {
      setExpandedAppeals(expandedAppeals.filter(x => x !== id));
    } else {
      setExpandedAppeals([...expandedAppeals, id]);
    }
  };

  const isAdminRole = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(userRole);
  
  const displayTickets = tickets.filter(t => activeTab === 'general' ? t.type !== 'DEFAULTER_APPEAL' : t.type === 'DEFAULTER_APPEAL');

  return (
    <div className="space-y-6" id="ticket-submission">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">Pedagogical & Process Feedback Tickets</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Submit feedback on syllabus, exam timings, or report inconsistencies. Superadmins review all entries.</p>
        </div>
      </div>
      
      {isAdminRole && (
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-700">
          <button 
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'general' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            onClick={() => setActiveTab('general')}
          >
            General Feedback
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'appeals' ? 'border-red-600 dark:border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            onClick={() => setActiveTab('appeals')}
          >
            Defaulter Appeals
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create ticket form or Admin Notice */}
        {userRole !== UserRole.SUPERADMIN && activeTab === 'general' ? (
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
                className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-1 bg-zinc-900 text-white p-6 border border-zinc-800 rounded-xl shadow-sm h-fit space-y-4">
            <h3 className="text-base font-display font-semibold text-zinc-100 flex items-center gap-2">
              🛡️ {activeTab === 'general' ? 'Superadmin Authority' : 'Appeals Authority'}
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              {activeTab === 'general' 
                ? 'Superadmins act as the final resolution and compliance audit authority. Creating new feedback tickets is restricted at this level.'
                : 'Review teacher grace appeals for locked out accounts. You can inspect their recent logbook activity to verify their technical difficulty claims.'}
            </p>
            <div className="p-3.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50 text-[11px] text-zinc-300 leading-normal">
              💡 {activeTab === 'general' 
                ? 'Select any incoming ticket from the Global Review Queue to review historical comments, modify statuses, or input final resolutions.'
                : 'Approving an appeal automatically clears the teacher\'s strike count and restores their structural access to the platform.'}
            </div>
          </div>
        )}

        {/* Tickets listing */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
            {activeTab === 'appeals' ? 'Pending Defaulter Appeals' : (userRole === UserRole.SUPERADMIN ? 'Global Review Queue' : 'Your Submitted Tickets')}
          </h3>

          {displayTickets.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              No active {activeTab === 'appeals' ? 'appeals' : 'feedback tickets'} found.
            </div>
          ) : (
            <div className="space-y-3">
              {displayTickets.map((t) => (
                <div key={t.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          t.type === 'curriculum' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                          t.type === 'DEFAULTER_APPEAL' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {t.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          t.status === 'Open' ? 'bg-red-100 text-red-800' : 
                          t.status === 'Reviewed' ? 'bg-indigo-100 text-indigo-800' : 
                          t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                          t.status === 'REJECTED' ? 'bg-zinc-100 text-zinc-800' :
                          'bg-green-100 text-green-800'
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

                  <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed bg-zinc-50 dark:bg-slate-800 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">{t.description}</p>
                  
                  {t.type === 'DEFAULTER_APPEAL' && (
                    <div className="mt-4">
                      <button 
                        onClick={() => toggleExpand(t.id)}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
                      >
                        {expandedAppeals.includes(t.id) ? 'Hide Logbook Metadata' : 'View Logbook Metadata'}
                      </button>
                      
                      {expandedAppeals.includes(t.id) && t.metadata?.logbookContext && (
                        <div className="mt-3 space-y-2 border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                          {t.metadata.logbookContext.length === 0 ? (
                            <div className="text-xs text-zinc-500 italic">No recent logbook activity found.</div>
                          ) : (
                            t.metadata.logbookContext.map(log => (
                              <div key={log.id} className="text-[10px] bg-slate-50 dark:bg-slate-800 p-2 rounded flex justify-between">
                                <span className="font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                                <span className={`font-medium ${log.status === 'Success' ? 'text-green-600 dark:text-green-400' : log.status === 'Failed' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>{log.status}</span>
                                <span className="text-slate-700 dark:text-slate-300 w-1/2 truncate" title={log.details}>{log.details}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-700 text-[10px] text-zinc-400 dark:text-zinc-500">
                    <div>
                      Filed by: <span className="font-medium text-zinc-700 dark:text-zinc-200">{t.userName}</span> ({t.userRole})
                      {t.metadata?.schoolId && <span className="ml-2">School: {t.metadata.schoolId}</span>}
                    </div>

                    {(isAdminRole) && t.status !== 'Resolved' && t.status !== 'APPROVED' && t.status !== 'REJECTED' && (
                      <div className="flex gap-2">
                        {t.type === 'DEFAULTER_APPEAL' ? (
                          <>
                            <button
                              onClick={() => handleResolve(t.id, 'APPROVED')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2 py-1 rounded cursor-pointer"
                            >
                              Approve Appeal
                            </button>
                            <button
                              onClick={() => handleResolve(t.id, 'REJECTED')}
                              className="bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-medium px-2 py-1 rounded cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            {t.status === 'Open' && (
                              <button
                                onClick={() => handleResolve(t.id, 'Reviewed')}
                                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium px-2 py-1 rounded cursor-pointer"
                              >
                                Mark Reviewed
                              </button>
                            )}
                            <button
                              onClick={() => handleResolve(t.id, 'Resolved')}
                              className="bg-green-600 hover:bg-green-700 text-white font-medium px-2 py-1 rounded cursor-pointer"
                            >
                              Resolve Issue
                            </button>
                          </>
                        )}
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
