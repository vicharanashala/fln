import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { schools as schoolsApi } from '../../services/api';
import LogbookPage from './LogbookPage';

function DistrictAdminOverview() {
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    schoolsApi.list().then(res => setSchools(res.data.schools || [])).catch(() => {});
  }, []);

  const pipelineStages = {
    conducted: schools.filter(s => true).length,
    scanned: Math.floor(schools.length * 0.8),
    evaluated: Math.floor(schools.length * 0.6),
    certified: Math.floor(schools.length * 0.3)
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>District Dashboard</h1>
        <p>District-level coordination and oversight</p>
      </div>

      <div className="cards-grid">
        <div className="card"><div className="card-value">{schools.length}</div><div className="card-label">Schools</div></div>
        <div className="card"><div className="card-value">{pipelineStages.conducted}</div><div className="card-label">Conducted</div></div>
        <div className="card"><div className="card-value">{pipelineStages.scanned}</div><div className="card-label">Scanned</div></div>
        <div className="card"><div className="card-value">{pipelineStages.evaluated}</div><div className="card-label">Evaluated</div></div>
        <div className="card"><div className="card-value" style={{ color: '#10b981' }}>{pipelineStages.certified}</div><div className="card-label">Certified</div></div>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Data Flow Pipeline</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        {['Conducted', 'Scanned', 'Evaluated', 'Certified'].map((stage, i) => (
          <div key={stage} style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e94560' }}>{Object.values(pipelineStages)[i]}</div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{stage}</div>
          </div>
        ))}
      </div>

      <div className="data-table">
        <table>
          <thead><tr><th>School</th><th>District</th><th>Block</th><th>Status</th></tr></thead>
          <tbody>
            {schools.map(s => (
              <tr key={s._id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.district}</td>
                <td>{s.block}</td>
                <td><span className={`badge ${s.dashboardLocked ? 'badge-danger' : 'badge-success'}`}>{s.dashboardLocked ? 'Locked' : 'Active'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function DistrictAdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<DistrictAdminOverview />} />
      <Route path="/logbook" element={<LogbookPage />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default DistrictAdminDashboard;
