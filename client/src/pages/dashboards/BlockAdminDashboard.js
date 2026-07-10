import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { schools as schoolsApi, users } from '../../services/api';
import GenerateQuestionPaper from './GenerateQuestionPaper';
import WorksheetHistory from './WorksheetHistory';
import LogbookPage from './LogbookPage';

function BlockAdminOverview() {
  const navigate = useNavigate();
  const [schoolList, setSchoolList] = useState([]);
  const [volunteerList, setVolunteerList] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const schoolRes = await schoolsApi.list();
        setSchoolList(schoolRes.data.schools || []);
        const userRes = await users.list();
        setVolunteerList((userRes.data.users || []).filter(u => u.role === 'volunteer'));
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  const lowStrengthSchools = schoolList.filter(s => s.studentStrength === 'low');
  const highStrengthSchools = schoolList.filter(s => s.studentStrength === 'high');

  return (
    <Layout>
      <div className="page-header">
        <h1>Block Admin Dashboard</h1>
        <p>Block-level coordination — {schoolList.length} schools, {volunteerList.length} volunteers</p>
      </div>

      <div className="cards-grid">
        <div className="card"><div className="card-value">{schoolList.length}</div><div className="card-label">Schools</div></div>
        <div className="card"><div className="card-value">{volunteerList.length}</div><div className="card-label">Volunteers</div></div>
        <div className="card"><div className="card-value">{lowStrengthSchools.length}</div><div className="card-label">Low-Strength Schools</div></div>
        <div className="card"><div className="card-value">{highStrengthSchools.length}</div><div className="card-label">High-Strength Schools</div></div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/generate')} style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
          📄 Generate Question Paper
        </button>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Volunteers</h2>
      <div className="data-table" style={{ marginBottom: '2rem' }}>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {volunteerList.map(v => (
              <tr key={v._id}>
                <td><strong>{v.name}</strong></td>
                <td>{v.email}</td>
                <td><span className="badge badge-success">Active</span></td>
              </tr>
            ))}
            {volunteerList.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center' }}>No volunteers assigned</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Schools</h2>
      <div className="data-table">
        <table>
          <thead><tr><th>School</th><th>Type</th><th>District</th><th>Status</th></tr></thead>
          <tbody>
            {schoolList.map(s => (
              <tr key={s._id}>
                <td><strong>{s.name}</strong></td>
                <td><span className={`badge ${s.studentStrength === 'low' ? 'badge-warning' : 'badge-success'}`}>{s.studentStrength} strength</span></td>
                <td>{s.district}</td>
                <td><span className={`badge ${s.dashboardLocked ? 'badge-danger' : 'badge-success'}`}>{s.dashboardLocked ? 'Locked' : 'Active'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function BlockAdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<BlockAdminOverview />} />
      <Route path="/generate" element={<GenerateQuestionPaper />} />
      <Route path="/history" element={<WorksheetHistory />} />
      <Route path="/logbook" element={<LogbookPage />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default BlockAdminDashboard;
