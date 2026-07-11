import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { classesApi, worksheets, students as studentsApi } from '../../services/api';
import { handlePrint, handleDownloadPDF } from '../../utils/worksheetActions';
import { validateGeneration, getErrorMessage } from '../../utils/validation';
import Toast from '../../components/Toast';
import Spinner from '../../components/Spinner';

function GenerateQuestionPaper() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedClassId = searchParams.get('classId');

  const [classList, setClassList] = useState([]);
  const [selectedClass, setSelectedClass] = useState(preselectedClassId || '');
  const [assessmentCycle, setAssessmentCycle] = useState('practice');
  const [studentCount, setStudentCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState('');
  const [worksheetsList, setWorksheetsList] = useState([]);
  const [personalizationInfo, setPersonalizationInfo] = useState(null);
  const [lockStatus, setLockStatus] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [fieldErrors, setFieldErrors] = useState({});

  const roleLabel = {
    teacher: 'Teacher',
    school: 'School (Principal)',
    volunteer: 'Volunteer',
    block_admin: 'Block Admin'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await classesApi.list();
        let classes = res.data.classes || [];
        if (user.role === 'school') {
          classes = classes.filter(c => c.school?._id === user.school || c.school === user.school);
        }
        setClassList(classes);
      } catch (err) {
        setToast({ message: getErrorMessage(err), type: 'error' });
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      studentsApi.list({ classId: selectedClass }).then(res => {
        setStudentCount(res.data.students?.length || 0);
      }).catch(() => {});
    }
  }, [selectedClass]);

  const handleGenerate = async () => {
    setFieldErrors({});
    const validationErrors = validateGeneration({ selectedClass, assessmentCycle, classList });
    if (validationErrors.length > 0) {
      const errors = {};
      validationErrors.forEach(err => { errors.general = err; });
      setError(validationErrors.join('. '));
      return;
    }
    setGenerating(true);
    setError('');
    setGenerated(null);
    setLockStatus(null);
    try {
      const res = await worksheets.generateForClass({
        classId: selectedClass,
        assessmentCycle
      });
      setGenerated(res.data);
      setPersonalizationInfo(res.data.worksheets || null);
      setToast({ message: `Successfully generated ${res.data.count} personalized question papers`, type: 'success' });
      const studentRes = await studentsApi.list({ classId: selectedClass });
      const students = studentRes.data.students || [];
      const wsPromises = students.map(s =>
        worksheets.getByStudent(s._id).then(r => r.data.worksheets || []).catch(() => [])
      );
      const wsArrays = await Promise.all(wsPromises);
      setWorksheetsList(wsArrays.flat().filter(ws => ws.assessmentCycle === assessmentCycle));
    } catch (err) {
      setGenerating(false);
      if (err.response?.status === 409) {
        setLockStatus(err.response.data);
        setError(`This class is already locked by ${err.response.data.lockedBy} (${err.response.data.lockedByRole}) for this assessment cycle.`);
      } else {
        setError(getErrorMessage(err));
      }
    }
    setGenerating(false);
  };

  return (
    <Layout>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div className="page-header">
        <h1>Generate Question Paper</h1>
        <p>Role: <strong>{roleLabel[user.role] || user.role}</strong> — Generate AI-personalized question papers for your class</p>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
          {lockStatus && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Locked at: {new Date(lockStatus.lockedAt).toLocaleString()}<br />
              The lock will auto-release when the exam cycle closes.
            </div>
          )}
        </div>
      )}

      {generated && (
        <div className="success-message" role="status">
          Successfully generated {generated.count} personalized question papers for <strong>{generated.class}</strong>
          ({generated.assessmentCycle} cycle)
        </div>
      )}

      {personalizationInfo && personalizationInfo.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Personalized Worksheets Generated</h3>
          <div className="data-table table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>FLN Level</th>
                  <th>Question Preview</th>
                </tr>
              </thead>
              <tbody>
                {personalizationInfo.map(ws => (
                  <tr key={ws._id}>
                    <td><strong>{ws.student?.name || 'N/A'}</strong></td>
                    <td><span className="badge badge-info">{ws.level}</span></td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 400 }}>
                      {ws.questionPreview?.slice(0, 2).map((q, i) => (
                        <div key={i} style={{ marginBottom: '0.25rem' }}>
                          {i + 1}. {q.question} <span style={{ color: '#6b7280' }}>({q.topic}, {q.difficulty})</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div className="form-group">
          <label htmlFor="class-select">Select Class</label>
          <select
            id="class-select"
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setFieldErrors({}); }}
            aria-describedby="class-desc"
          >
            <option value="">Choose a class...</option>
            {classList.map(c => (
              <option key={c._id} value={c._id}>
                {c.name} - Class {c.grade}{c.section ? ` (${c.section})` : ''}
              </option>
            ))}
          </select>
          {selectedClass && (
            <small id="class-desc" style={{ color: '#6b7280' }}>{studentCount} student(s) in this class</small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="cycle-select">Assessment Cycle</label>
          <select
            id="cycle-select"
            value={assessmentCycle}
            onChange={e => setAssessmentCycle(e.target.value)}
          >
            <option value="practice">Practice Worksheet</option>
            <option value="baseline">Baseline Assessment</option>
            <option value="mid_year">Mid-Year Assessment</option>
            <option value="end_year">End-Year Assessment</option>
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating || !selectedClass}
          style={{ fontSize: '1rem', padding: '0.875rem 2rem', width: '100%', justifyContent: 'center' }}
          aria-busy={generating}
        >
          {generating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 20, height: 20 }}>
                <span className="spinner-blade" style={{ width: 20, height: 20, borderWidth: 2 }} />
              </span>
              AI is generating {studentCount} personalized question papers...
            </span>
          ) : (
            <>Generate Question Paper{studentCount > 0 ? ` (${studentCount} students)` : ''}</>
          )}
        </button>

        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: 8, fontSize: '0.85rem', color: '#065f46' }}>
          <strong>Exam Timing:</strong> 1-hour print window → 45-min exam (30 min + 15 min buffer) → 1-hour submission window
        </div>
      </div>

      {worksheetsList.length > 0 && (
        <>
          <h2 style={{ marginBottom: '1rem' }}>Recent Worksheets</h2>
          <div className="data-table table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Worksheet ID</th>
                  <th>Student</th>
                  <th>Level</th>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {worksheetsList.map(ws => (
                  <tr key={ws._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{ws.worksheetId}</td>
                    <td>{ws.student?.name || 'N/A'}</td>
                    <td>{ws.level}</td>
                    <td><span className="badge badge-info">{ws.assessmentCycle}</span></td>
                    <td><span className={`badge ${ws.status === 'evaluated' ? 'badge-success' : 'badge-warning'}`}>{ws.status}</span></td>
                    <td>{new Date(ws.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-outline btn-sm" onClick={() => handlePrint(ws)} title="Print worksheet" aria-label="Print worksheet">
                          Print
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleDownloadPDF(ws)} title="Download PDF" aria-label="Download worksheet as PDF">
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}

export default GenerateQuestionPaper;
