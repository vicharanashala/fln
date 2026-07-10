import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { classesApi, students, worksheets, evaluations, announcements, tickets } from '../../services/api';
import GenerateQuestionPaper from './GenerateQuestionPaper';
import WorksheetHistory from './WorksheetHistory';

function TeacherOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [announcementList, setAnnouncementList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, worksheets: 0, evaluated: 0, avgScore: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, studentRes, announceRes] = await Promise.all([
          classesApi.list({ teacherId: user._id }),
          students.list(),
          announcements.list()
        ]);
        const studentData = studentRes.data.students || [];
        setClassList(classesRes.data.classes || []);
        setStudentList(studentData);
        setAnnouncementList(announceRes.data.announcements || []);

        // Fetch worksheet/evaluation stats (batch in parallel)
        const wsResults = await Promise.allSettled(
          studentData.map(s => worksheets.getByStudent(s._id).then(r => ({ studentId: s._id, worksheets: r.data.worksheets || [] })).catch(() => ({ studentId: s._id, worksheets: [] })))
        );
        const allWorksheets = wsResults.flatMap(r => r.status === 'fulfilled' ? r.value.worksheets : []);
        const evaluated = allWorksheets.filter(w => w.status === 'evaluated');
        const evalResults = await Promise.allSettled(
          evaluated.map(w => evaluations.getLatest(w.student).then(r => r.data.report?.score || 0).catch(() => 0))
        );
        const totalScore = evalResults.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
        setStats({
          students: studentData.length,
          worksheets: allWorksheets.length,
          evaluated: evaluated.length,
          avgScore: evaluated.length > 0 ? Math.round(totalScore / evaluated.length) : 0
        });
      } catch (err) {
        console.error('Failed to fetch teacher data:', err);
      }
      setLoading(false);
    };
    if (user._id) fetchData();
  }, [user._id]);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <Layout>
      {announcementList.length > 0 && (
        <div className="announcement-bar">
          📢 <strong>{announcementList[0].title}</strong>: {announcementList[0].content}
        </div>
      )}

      <div className="page-header">
        <h1>My Classes</h1>
        <p>Welcome back, {user?.name} — Manage your classes and assessments</p>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-value">{stats.students}</div>
          <div className="card-label">Total Students</div>
        </div>
        <div className="card">
          <div className="card-value">{classList.length}</div>
          <div className="card-label">Classes</div>
        </div>
        <div className="card">
          <div className="card-value" style={{ color: '#e94560' }}>{stats.avgScore}%</div>
          <div className="card-label">Average Score</div>
        </div>
        <div className="card">
          <div className="card-value">{stats.evaluated}</div>
          <div className="card-label">Evaluated</div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/generate')} style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
          📄 Generate Question Paper
        </button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Section</th>
              <th>Grade</th>
              <th>Students</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classList.map((cls) => {
              const count = studentList.filter(s => s.class?._id === cls._id).length;
              return (
                <tr key={cls._id}>
                  <td><strong>{cls.name}</strong></td>
                  <td>{cls.section || '-'}</td>
                  <td>Class {cls.grade}</td>
                  <td>{count} students</td>
                  <td><span className="badge badge-success">Active</span></td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/dashboard/generate?classId=${cls._id}`)}>
                      Generate Paper
                    </button>
                  </td>
                </tr>
              );
            })}
            {classList.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                No classes assigned yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: '2rem 0 1rem' }}>Students Overview</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Class</th>
              <th>Current Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {studentList.slice(0, 20).map((s) => (
              <tr key={s._id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.studentId}</td>
                <td><strong>{s.name}</strong></td>
                <td>{s.class?.name || '-'}</td>
                <td>{s.currentLevel}</td>
                <td><span className="badge badge-info">Active</span></td>
              </tr>
            ))}
            {studentList.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                No students found. Add students to your classes.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function TeacherDashboard() {
  return (
    <Routes>
      <Route path="/" element={<TeacherOverview />} />
      <Route path="/students" element={<TeacherStudents />} />
      <Route path="/generate" element={<GenerateQuestionPaper />} />
      <Route path="/history" element={<WorksheetHistory />} />
      <Route path="/reports" element={<TeacherReports />} />
      <Route path="/tickets" element={<TeacherTickets />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function TeacherStudents() {
  const [studentList, setStudentList] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', age: '', classId: '', section: '', identityType: 'aadhar', identityNumber: '' });
  const [classList, setClassList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentRes, classRes] = await Promise.all([
          students.list(),
          classesApi.list()
        ]);
        setStudentList(studentRes.data.students || []);
        setClassList(classRes.data.classes || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await students.create(newStudent);
      setStudentList([...studentList, res.data.student]);
      setShowAddModal(false);
      setNewStudent({ name: '', age: '', classId: '', section: '', identityType: 'aadhar', identityNumber: '' });
      setSuccess('Student added successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add student');
    }
  };

  const filtered = studentList.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Students</h1>
        <p>Manage your class roster</p>
      </div>

      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <input placeholder="Search students by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Student</button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Age</th>
              <th>Class</th>
              <th>Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s._id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.studentId}</td>
                <td><strong>{s.name}</strong></td>
                <td>{s.age}</td>
                <td>{s.class?.name || '-'}</td>
                <td>{s.currentLevel}</td>
                <td><span className="badge badge-success">Active</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add New Student</h2>
            <form onSubmit={handleAddStudent}>
              <div className="form-group">
                <label>Student Name</label>
                <input required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" required min="4" max="12" value={newStudent.age} onChange={e => setNewStudent({...newStudent, age: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Class</label>
                <select required value={newStudent.classId} onChange={e => setNewStudent({...newStudent, classId: e.target.value})}>
                  <option value="">Select class</option>
                  {classList.map(c => <option key={c._id} value={c._id}>{c.name} - Class {c.grade}{c.section ? ` (${c.section})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Identity Type</label>
                <select value={newStudent.identityType} onChange={e => setNewStudent({...newStudent, identityType: e.target.value})}>
                  <option value="aadhar">Aadhar Card</option>
                  <option value="birth_certificate">Birth Certificate</option>
                </select>
              </div>
              <div className="form-group">
                <label>Identity Number</label>
                <input required value={newStudent.identityNumber} onChange={e => setNewStudent({...newStudent, identityNumber: e.target.value})} placeholder="12-digit Aadhar or BC number" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

function TeacherReports() {
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    students.list().then(res => setStudentList(res.data.students || [])).catch(() => {});
  }, []);

  const loadReport = async (studentId) => {
    setLoading(true);
    try {
      const res = await evaluations.getLatest(studentId);
      setReport(res.data.report);
      setSelectedStudent(studentId);
    } catch {
      setReport(null);
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Reports</h1>
        <p>View student evaluation reports and progress</p>
      </div>

      <div className="form-group" style={{ maxWidth: 400 }}>
        <label>Select Student</label>
        <select onChange={e => e.target.value && loadReport(e.target.value)}>
          <option value="">Choose a student...</option>
          {studentList.map(s => (
            <option key={s._id} value={s._id}>{s.name} ({s.studentId})</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading">Loading report...</div>}

      {report && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2>Evaluation Report</h2>
          <div className="cards-grid" style={{ marginTop: '1rem' }}>
            <div className="card">
              <div className="card-value">{report.correctAnswers}/{report.totalQuestions}</div>
              <div className="card-label">Correct Answers</div>
            </div>
            <div className="card">
              <div className="card-value">{report.score}%</div>
              <div className="card-label">Score</div>
            </div>
            <div className="card">
              <div className="card-value">{report.previousLevel} → {report.assignedLevel}</div>
              <div className="card-label">Level Progression</div>
            </div>
          </div>
          {report.strengths?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Strengths</h3>
              <ul>{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {report.narrativeSummary && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 8 }}>
              <p><em>{report.narrativeSummary}</em></p>
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Select a student to view their latest evaluation report.</p>
      )}
    </Layout>
  );
}

function TeacherTickets() {
  const [ticketList, setTicketList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'general', relatedQuestionId: '' });
  const [success, setSuccess] = useState('');

  useEffect(() => {
    tickets.list().then(res => setTicketList(res.data.tickets || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await tickets.create(form);
      setTicketList([res.data.ticket, ...ticketList]);
      setShowForm(false);
      setForm({ title: '', description: '', type: 'general', relatedQuestionId: '' });
      setSuccess('Feedback submitted successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Submit Feedback</h1>
        <p>Submit general or curriculum feedback tickets</p>
      </div>

      {success && <div className="success-message">{success}</div>}

      <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ marginBottom: '1rem' }}>
        {showForm ? 'Cancel' : '✏️ New Feedback'}
      </button>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Feedback Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="general">General / Process</option>
                <option value="curriculum">Curriculum / Content (Teachers only)</option>
              </select>
            </div>
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
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {ticketList.map(t => (
              <tr key={t._id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.ticketId}</td>
                <td>{t.title}</td>
                <td><span className={`badge ${t.type === 'curriculum' ? 'badge-warning' : 'badge-info'}`}>{t.type}</span></td>
                <td><span className={`badge ${t.status === 'open' ? 'badge-warning' : t.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>{t.status}</span></td>
                <td>{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {ticketList.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No tickets submitted yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export default TeacherDashboard;
export { TeacherStudents, TeacherReports, TeacherTickets, TeacherOverview };
