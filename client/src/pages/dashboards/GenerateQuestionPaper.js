import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { classesApi, worksheets, students as studentsApi } from '../../services/api';
import html2pdf from 'html2pdf.js';

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
  const [lockStatus, setLockStatus] = useState(null);

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
        console.error('Failed to fetch classes:', err);
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
    if (!selectedClass || !assessmentCycle) {
      setError('Please select a class and assessment cycle');
      return;
    }
    setGenerating(true);
    setError('');
    setGenerated(null);
    try {
      const res = await worksheets.generateForClass({
        classId: selectedClass,
        assessmentCycle
      });
      setGenerated(res.data);
      // Fetch the generated worksheets
      try {
        const studentRes = await studentsApi.list({ classId: selectedClass });
        const students = studentRes.data.students || [];
        const wsPromises = students.map(s =>
          worksheets.getByStudent(s._id).then(r => r.data.worksheets || []).catch(() => [])
        );
        const wsArrays = await Promise.all(wsPromises);
        setWorksheetsList(wsArrays.flat().filter(ws => ws.assessmentCycle === assessmentCycle));
      } catch (fetchErr) {
        console.error('Failed to fetch generated worksheets:', fetchErr);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setLockStatus(err.response.data);
        setError(`⚠ This class is already locked by ${err.response.data.lockedBy} (${err.response.data.lockedByRole}) for this assessment cycle.`);
      } else {
        setError(err.response?.data?.error || 'Failed to generate question paper');
      }
    }
    setGenerating(false);
  };

  const buildWorksheetHTML = (worksheet) => {
    const questions = worksheet.worksheetJson?.questions || [];
    const schoolName = worksheet.school?.name || worksheet.class?.schoolName || '______________';
    const studentName = worksheet.student?.name || '______________';
    const studentId = worksheet.student?.studentId || '______________';
    const grade = worksheet.worksheetJson?.class || worksheet.class?.grade || '______________';
    const subject = worksheet.worksheetJson?.subject || 'Mathematics';
    const level = worksheet.level || '______________';
    const date = new Date(worksheet.createdAt).toLocaleDateString();
    const wsId = worksheet.worksheetId;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Worksheet - ${wsId}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; padding: 0; }
    .worksheet { max-width: 190mm; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid #1a1a2e; }
    .header h1 { font-size: 16pt; font-weight: 700; color: #1a1a2e; margin-bottom: 0.15rem; }
    .header .school-name { font-size: 11pt; font-weight: 600; color: #e94560; margin-bottom: 0.25rem; }
    .header .subtitle { font-size: 9pt; color: #6b7280; }
    .info-grid { display: flex; flex-wrap: wrap; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 1.25rem; overflow: hidden; }
    .info-item { flex: 1 1 33.33%; padding: 0.5rem 0.75rem; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; font-size: 9pt; }
    .info-item:nth-child(3n) { border-right: none; }
    .info-item:nth-last-child(-n+3) { border-bottom: none; }
    .info-label { font-weight: 600; color: #374151; }
    .info-value { color: #1a1a2e; }
    .questions-section { }
    .question { margin-bottom: 1.25rem; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; page-break-inside: avoid; }
    .question-header { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.35rem; }
    .question-number { font-weight: 700; font-size: 10pt; color: #e94560; min-width: 1.5rem; }
    .question-topic { font-size: 7pt; color: #9ca3af; background: #f3f4f6; padding: 0.1rem 0.4rem; border-radius: 3px; }
    .question-text { font-size: 11pt; margin-bottom: 0.5rem; padding-left: 0.25rem; }
    .answer-space { border-bottom: 1px dashed #d1d5db; height: 2.5rem; margin: 0.5rem 0 0 0.25rem; }
    .footer { text-align: center; font-size: 7pt; color: #9ca3af; margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb; }
    @media print {
      .question { page-break-inside: avoid; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="worksheet">
    <div class="header">
      <div class="school-name">${schoolName}</div>
      <h1>FLN Assessment Worksheet</h1>
      <div class="subtitle">Assessment Cycle: ${worksheet.assessmentCycle} | Worksheet ID: ${wsId}</div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Student Name</div>
        <div class="info-value">${studentName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Grade</div>
        <div class="info-value">${grade}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Subject</div>
        <div class="info-value">${subject}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Student ID</div>
        <div class="info-value">${studentId}</div>
      </div>
      <div class="info-item">
        <div class="info-label">FLN Level</div>
        <div class="info-value">${level}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Date</div>
        <div class="info-value">${date}</div>
      </div>
    </div>

    <div class="questions-section">
      ${questions.map((q, i) => `
        <div class="question">
          <div class="question-header">
            <span class="question-number">Q${i + 1}.</span>
            ${q.topic ? `<span class="question-topic">${q.topic}</span>` : ''}
          </div>
          <div class="question-text">${q.question}</div>
          <div class="answer-space"></div>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      Generated by FLN Assessment Platform | ${new Date().toLocaleDateString()}
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrint = (worksheet) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print worksheets');
      return;
    }
    const html = buildWorksheetHTML(worksheet);
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  const handleDownloadPDF = async (worksheet) => {
    const container = document.createElement('div');
    container.innerHTML = buildWorksheetHTML(worksheet);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = '#fff';
    document.body.appendChild(container);

    try {
      const element = container.querySelector('.worksheet');
      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     `worksheet-${worksheet.worksheetId}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };
      await html2pdf().set(opt).from(element).save();
    } finally {
      document.body.removeChild(container);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Generate Question Paper</h1>
        <p>Role: <strong>{roleLabel[user.role] || user.role}</strong> — Generate AI-personalized question papers for your class</p>
      </div>

      {error && (
        <div className="error-message">
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
        <div className="success-message">
          ✅ Successfully generated {generated.count} question papers for <strong>{generated.class}</strong>
          ({generated.assessmentCycle} cycle)
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div className="form-group">
          <label>Select Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">Choose a class...</option>
            {classList.map(c => (
              <option key={c._id} value={c._id}>
                {c.name} - Class {c.grade}{c.section ? ` (${c.section})` : ''}
              </option>
            ))}
          </select>
          {selectedClass && (
            <small style={{ color: '#6b7280' }}>{studentCount} student(s) in this class</small>
          )}
        </div>

        <div className="form-group">
          <label>Assessment Cycle</label>
          <select value={assessmentCycle} onChange={e => setAssessmentCycle(e.target.value)}>
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
        >
          {generating ? (
            <span>⏳ AI is generating {studentCount} personalized question papers...</span>
          ) : (
            <>📄 Generate Question Paper{studentCount > 0 ? ` (${studentCount} students)` : ''}</>
          )}
        </button>

        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: 8, fontSize: '0.85rem', color: '#065f46' }}>
          <strong>⏱ Exam Timing:</strong> 1-hour print window → 45-min exam (30 min + 15 min buffer) → 1-hour submission window
        </div>
      </div>

      {worksheetsList.length > 0 && (
        <>
          <h2 style={{ marginBottom: '1rem' }}>Recent Worksheets</h2>
          <div className="data-table">
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
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handlePrint(ws)}>
                          🖨 Print
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleDownloadPDF(ws)}>
                          ⬇ PDF
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
