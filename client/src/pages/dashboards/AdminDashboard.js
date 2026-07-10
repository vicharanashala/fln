import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { schools as schoolsApi, students as studentsApi } from '../../services/api';
import LogbookPage from './LogbookPage';

function AdminOverview() {
  const [schoolList, setSchoolList] = useState([]);
  const [stats, setStats] = useState({ schools: 0, students: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const schoolRes = await schoolsApi.list();
        setSchoolList(schoolRes.data.schools || []);
        const studentRes = await studentsApi.list();
        setStats({ schools: schoolRes.data.schools?.length || 0, students: studentRes.data.students?.length || 0 });
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="page-header">
        <h1>State Dashboard</h1>
        <p>State/UT-level management and oversight</p>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-value">{stats.schools}</div>
          <div className="card-label">Schools</div>
        </div>
        <div className="card">
          <div className="card-value">{stats.students}</div>
          <div className="card-label">Students</div>
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead><tr><th>School ID</th><th>Name</th><th>District</th><th>Block</th><th>Status</th></tr></thead>
          <tbody>
            {schoolList.map(s => (
              <tr key={s._id}>
                <td style={{ fontFamily: 'monospace' }}>{s.schoolId}</td>
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

function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<AdminOverview />} />
      <Route path="/logbook" element={<LogbookPage />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default AdminDashboard;
