import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { analytics, announcements, tickets } from '../../services/api';
import LogbookPage from './LogbookPage';

function SuperadminOverview() {
  const [stats, setStats] = useState({ totalSchools: 0, totalStudents: 0, totalAssessments: 0, nationalFLNScore: 0 });
  const [announcementList, setAnnouncementList] = useState([]);
  const [ticketList, setTicketList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, announceRes, ticketRes] = await Promise.all([
          analytics.national(),
          announcements.list(),
          tickets.list({ status: 'open' })
        ]);
        setStats(statsRes.data);
        setAnnouncementList(announceRes.data.announcements || []);
        setTicketList(ticketRes.data.tickets || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <Layout><div className="loading">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <h1>Superadmin Dashboard</h1>
        <p>National-level oversight — All India FLN Analytics</p>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-value">{stats.totalSchools?.toLocaleString() || 0}</div>
          <div className="card-label">Total Schools</div>
        </div>
        <div className="card">
          <div className="card-value">{stats.totalStudents?.toLocaleString() || 0}</div>
          <div className="card-label">Total Students</div>
        </div>
        <div className="card">
          <div className="card-value">{stats.totalAssessments?.toLocaleString() || 0}</div>
          <div className="card-label">Total Assessments</div>
        </div>
        <div className="card">
          <div className="card-value" style={{ color: '#10b981' }}>{stats.nationalFLNScore || 0}%</div>
          <div className="card-label">National FLN Score</div>
        </div>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Open Tickets ({ticketList.length})</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Submitted By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ticketList.slice(0, 10).map(t => (
              <tr key={t._id}>
                <td style={{ fontFamily: 'monospace' }}>{t.ticketId}</td>
                <td>{t.title}</td>
                <td><span className="badge badge-warning">{t.type}</span></td>
                <td>{t.submittedBy?.name}</td>
                <td><span className="badge badge-warning">{t.status}</span></td>
              </tr>
            ))}
            {ticketList.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center' }}>No open tickets</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function SuperadminAnnouncements() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', isUrgent: false, emailEscalation: false });

  useEffect(() => {
    announcements.list().then(res => setList(res.data.announcements || [])).catch(() => {});
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    try {
      const res = await announcements.create(form);
      setList([res.data.announcement, ...list]);
      setForm({ title: '', content: '', isUrgent: false, emailEscalation: false });
    } catch (err) { console.error(err); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Announcements</h1>
        <p>Post announcements visible on all dashboards</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handlePost}>
          <div className="form-group">
            <label>Title</label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Content</label>
            <textarea rows={3} required value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={form.isUrgent} onChange={e => setForm({...form, isUrgent: e.target.checked})} />
              Mark as Urgent
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={form.emailEscalation} onChange={e => setForm({...form, emailEscalation: e.target.checked})} />
              Email Escalation
            </label>
          </div>
          <button type="submit" className="btn btn-primary">📢 Post Announcement</button>
        </form>
      </div>

      <div className="data-table">
        <table>
          <thead><tr><th>Title</th><th>Content</th><th>Urgent</th><th>Date</th></tr></thead>
          <tbody>
            {list.map(a => (
              <tr key={a._id}>
                <td><strong>{a.title}</strong></td>
                <td>{a.content}</td>
                <td>{a.isUrgent ? <span className="badge badge-danger">Urgent</span> : '-'}</td>
                <td>{new Date(a.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function SuperadminTickets() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    tickets.list({ status: filter }).then(res => setList(res.data.tickets || [])).catch(() => {});
  }, [filter]);

  const handleReview = async (id, status, reviewNotes) => {
    try {
      await tickets.review(id, { status, reviewNotes: reviewNotes || 'Reviewed by Superadmin' });
      setList(list.filter(t => t._id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Ticket Review Queue</h1>
        <p>Review and approve/reject curriculum and general feedback tickets</p>
      </div>

      <div className="form-group" style={{ maxWidth: 300 }}>
        <label>Filter by Status</label>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr><th>ID</th><th>Title</th><th>Type</th><th>From</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list.map(t => (
              <tr key={t._id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.ticketId}</td>
                <td>{t.title}</td>
                <td><span className="badge badge-info">{t.type}</span></td>
                <td>{t.submittedBy?.name} ({t.submittedByRole})</td>
                <td><span className="badge badge-warning">{t.status}</span></td>
                <td>
                  {t.status === 'open' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleReview(t._id, 'approved')}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReview(t._id, 'rejected')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function SuperadminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<SuperadminOverview />} />
      <Route path="/announcements" element={<SuperadminAnnouncements />} />
      <Route path="/tickets" element={<SuperadminTickets />} />
      <Route path="/logbook" element={<LogbookPage />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default SuperadminDashboard;
