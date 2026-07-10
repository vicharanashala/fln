import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { schools as schoolsApi, tickets } from '../../services/api';
import GenerateQuestionPaper from './GenerateQuestionPaper';
import LogbookPage from './LogbookPage';

function VolunteerOverview() {
  const navigate = useNavigate();
  const [schoolList, setSchoolList] = useState([]);

  useEffect(() => {
    schoolsApi.list().then(res => setSchoolList(res.data.schools || [])).catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="page-header">
        <h1>Volunteer Dashboard</h1>
        <p>Assigned schools — Conduct assessments for low-strength schools</p>
      </div>

      <div className="cards-grid">
        <div className="card"><div className="card-value">{schoolList.length}</div><div className="card-label">Assigned Schools</div></div>
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/generate')} style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
          📄 Generate Question Paper
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/scan')}>
          📷 Scan & Upload
        </button>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>My Assigned Schools</h2>
      <div className="data-table">
        <table>
          <thead><tr><th>School</th><th>District</th><th>Block</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {schoolList.map(s => (
              <tr key={s._id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.district}</td>
                <td>{s.block}</td>
                <td><span className={`badge ${s.dashboardLocked ? 'badge-danger' : 'badge-success'}`}>{s.dashboardLocked ? 'Locked' : 'Active'}</span></td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard/generate')}>
                    Generate Paper
                  </button>
                </td>
              </tr>
            ))}
            {schoolList.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No schools assigned yet</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function VolunteerScan() {
  return (
    <Layout>
      <div className="page-header">
        <h1>Scan & Upload</h1>
        <p>Upload ICR-scanned answer sheets</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🖨</div>
        <h2 style={{ marginBottom: '1rem' }}>Connect ICR Scanner</h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Connect your ICR scanner hardware to ingest answer sheets in bulk (40-50 sheets in 2-3 minutes)</p>
        <button className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
          🔗 Connect Scanner
        </button>

        <div className="data-table" style={{ marginTop: '2rem' }}>
          <table>
            <thead><tr><th>Date</th><th>School</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td colSpan="4" style={{ textAlign: 'center', color: '#6b7280' }}>No scan history yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function VolunteerTickets() {
  const [form, setForm] = useState({ title: '', description: '', type: 'general' });
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await tickets.create(form);
      setSuccess('Feedback submitted successfully!');
      setForm({ title: '', description: '', type: 'general' });
    } catch (err) { console.error(err); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Submit Feedback</h1>
        <p>Report issues or submit feedback</p>
      </div>

      {success && <div className="success-message">{success}</div>}

      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={4} required value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary">Submit Feedback</button>
        </form>
      </div>
    </Layout>
  );
}

function VolunteerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<VolunteerOverview />} />
      <Route path="/generate" element={<GenerateQuestionPaper />} />
      <Route path="/scan" element={<VolunteerScan />} />
      <Route path="/tickets" element={<VolunteerTickets />} />
      <Route path="/logbook" element={<LogbookPage />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default VolunteerDashboard;
