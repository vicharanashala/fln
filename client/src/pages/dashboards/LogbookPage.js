import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { logbook } from '../../services/api';

function LogbookPage() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({ action: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await logbook.list({ ...filter, page, limit: 30 });
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchLogs();
  }, [filter, page]);

  return (
    <Layout>
      <div className="page-header">
        <h1>Audit Logbook</h1>
        <p>Track all significant platform actions</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <label>Action Type</label>
          <select value={filter.action} onChange={e => setFilter({...filter, action: e.target.value, page: 1})}>
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="generate_worksheet">Generate Worksheet</option>
            <option value="scan_upload">Scan Upload</option>
            <option value="evaluate_assessment">Evaluate</option>
            <option value="add_student">Add Student</option>
            <option value="create_account">Create Account</option>
            <option value="post_announcement">Announcement</option>
            <option value="submit_feedback">Feedback</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <label>Start Date</label>
          <input type="date" value={filter.startDate} onChange={e => setFilter({...filter, startDate: e.target.value, page: 1})} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <label>End Date</label>
          <input type="date" value={filter.endDate} onChange={e => setFilter({...filter, endDate: e.target.value, page: 1})} />
        </div>
      </div>

      {loading ? <div className="loading">Loading logbook...</div> : (
        <>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td><span className={`badge ${log.action === 'login' ? 'badge-info' : 'badge-warning'}`}>{log.action.replace(/_/g, ' ')}</span></td>
                    <td>{log.performedBy?.name || 'System'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{log.performedByRole?.replace(/_/g, ' ') || '-'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log.description}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No log entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
            <span style={{ padding: '0.5rem', color: '#6b7280' }}>Page {page} of {Math.ceil(total / 30)}</span>
            <button className="btn btn-outline" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </>
      )}
    </Layout>
  );
}

export default LogbookPage;
