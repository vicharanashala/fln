import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { classesApi, students as studentsApi, schools as schoolsApi } from '../../services/api';
import GenerateQuestionPaper from './GenerateQuestionPaper';
import WorksheetHistory from './WorksheetHistory';

function SchoolOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, studentRes] = await Promise.all([
          classesApi.list(),
          studentsApi.list()
        ]);
        setClassList(classRes.data.classes || []);
        setStudentList(studentRes.data.students || []);
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="page-header">
        <h1>School Dashboard</h1>
        <p>Manage teachers, classes, and student performance</p>
      </div>

      <div className="cards-grid">
        <div className="card"><div className="card-value">{classList.length}</div><div className="card-label">Classes</div></div>
        <div className="card"><div className="card-value">{studentList.length}</div><div className="card-label">Students</div></div>
        <div className="card"><div className="card-value">{teacherList.length}</div><div className="card-label">Teachers</div></div>
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/generate')}>
          📄 Generate Question Paper
        </button>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Classes</h2>
      <div className="data-table">
        <table>
          <thead><tr><th>Class</th><th>Grade</th><th>Students</th><th>Teacher</th></tr></thead>
          <tbody>
            {classList.map(c => (
              <tr key={c._id}>
                <td><strong>{c.name}</strong></td>
                <td>Class {c.grade}</td>
                <td>{studentList.filter(s => s.class?._id === c._id).length}</td>
                <td>{c.teacher?.name || 'Unassigned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function SchoolDashboard() {
  return (
    <Routes>
      <Route path="/" element={<SchoolOverview />} />
      <Route path="/generate" element={<GenerateQuestionPaper />} />
      <Route path="/history" element={<WorksheetHistory />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default SchoolDashboard;
