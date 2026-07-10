import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { worksheets } from '../../services/api';
import { buildWorksheetHTML } from '../../utils/worksheetHtml';
import html2pdf from 'html2pdf.js';

function WorksheetHistory() {
  const { user } = useAuth();
  const [worksheetList, setWorksheetList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & filters
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // View modal
  const [viewWorksheet, setViewWorksheet] = useState(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort: sortOrder };
      if (search) params.search = search;
      if (gradeFilter) params.grade = gradeFilter;
      if (levelFilter) params.level = levelFilter;
      if (cycleFilter) params.assessmentCycle = cycleFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await worksheets.history(params);
      setWorksheetList(res.data.worksheets || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load worksheet history');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [sortOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleClearFilters = () => {
    setSearch('');
    setGradeFilter('');
    setLevelFilter('');
    setCycleFilter('');
    setStartDate('');
    setEndDate('');
    setSortOrder('latest');
  };

  const handlePrint = (ws) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print worksheets');
      return;
    }
    const html = buildWorksheetHTML(ws);
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  const handleDownloadPDF = async (ws) => {
    const container = document.createElement('div');
    container.innerHTML = buildWorksheetHTML(ws);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = '#fff';
    document.body.appendChild(container);
    try {
      const element = container.querySelector('.worksheet');
      const opt = {
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `worksheet-${ws.worksheetId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      await html2pdf().set(opt).from(element).save();
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleView = async (ws) => {
    try {
      const res = await worksheets.get(ws._id);
      setViewWorksheet(res.data.worksheet);
    } catch (err) {
      setError('Failed to load worksheet');
    }
  };

  const handleRegenerate = async (ws) => {
    setError('');
    setSuccess('');
    try {
      const res = await worksheets.regenerate(ws._id);
      const newWs = res.data.worksheet;
      setWorksheetList([newWs, ...worksheetList]);
      setSuccess(`New worksheet generated for ${newWs.student?.name || 'student'}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate worksheet');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    setSuccess('');
    try {
      await worksheets.delete(deleteTarget._id);
      setWorksheetList(worksheetList.filter(w => w._id !== deleteTarget._id));
      setSuccess('Worksheet deleted successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete worksheet');
    }
    setDeleteTarget(null);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Worksheet History</h1>
        <p>View, print, regenerate, or delete previously generated question papers</p>
      </div>

      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Search & Filters */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label>Search</label>
              <input
                placeholder="Search by student name or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: '0 1 100px', marginBottom: 0 }}>
              <label>Grade</label>
              <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                <option value="">All</option>
                {[1,2,3,4,5].map(g => <option key={g} value={g}>Class {g}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 120px', marginBottom: 0 }}>
              <label>FLN Level</label>
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                <option value="">All</option>
                {[1,2,3,4,5,6,7,8].map(l => <option key={l} value={`Level${l}`}>Level {l}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 140px', marginBottom: 0 }}>
              <label>Cycle</label>
              <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}>
                <option value="">All</option>
                <option value="practice">Practice</option>
                <option value="baseline">Baseline</option>
                <option value="mid_year">Mid-Year</option>
                <option value="end_year">End-Year</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 130px', marginBottom: 0 }}>
              <label>From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 130px', marginBottom: 0 }}>
              <label>To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 100px', marginBottom: 0 }}>
              <label>Sort</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1px' }}>
              <button type="submit" className="btn btn-primary btn-sm">🔍 Search</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleClearFilters}>Clear</button>
            </div>
          </div>
        </form>
      </div>

      {/* Loading */}
      {loading && <div className="loading">Loading worksheet history...</div>}

      {/* Empty state */}
      {!loading && worksheetList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No worksheets found</p>
          <p>Generate question papers to see them here.</p>
        </div>
      )}

      {/* Table */}
      {!loading && worksheetList.length > 0 && (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Grade</th>
                <th>Subject</th>
                <th>FLN Level</th>
                <th>Questions</th>
                <th>Cycle</th>
                <th>Created</th>
                <th>Generated By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {worksheetList.map(ws => (
                <tr key={ws._id}>
                  <td><strong>{ws.student?.name || 'N/A'}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{ws.student?.studentId || 'N/A'}</td>
                  <td>Class {ws.worksheetJson?.class || ws.class?.grade || '?'}</td>
                  <td>{ws.worksheetJson?.subject || 'Mathematics'}</td>
                  <td><span className="badge badge-info">{ws.level}</span></td>
                  <td>{ws.worksheetJson?.total_questions || ws.worksheetJson?.questions?.length || 0}</td>
                  <td><span className="badge badge-warning">{ws.assessmentCycle}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(ws.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontSize: '0.8rem' }}>{ws.generatedBy?.name || 'N/A'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleView(ws)} title="View">👁</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handlePrint(ws)} title="Print">🖨</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleDownloadPDF(ws)} title="Download PDF">⬇</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleRegenerate(ws)} title="Regenerate">🔄</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(ws)} title="Delete">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewWorksheet && (
        <div className="modal-overlay" onClick={() => setViewWorksheet(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', overflow: 'auto' }}>
            <h2>Worksheet - {viewWorksheet.worksheetId}</h2>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
              <strong>Student:</strong> {viewWorksheet.student?.name} | <strong>Level:</strong> {viewWorksheet.level} | <strong>Cycle:</strong> {viewWorksheet.assessmentCycle}
            </div>
            {viewWorksheet.worksheetJson?.questions?.map((q, i) => (
              <div key={i} style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <div style={{ fontWeight: 700, color: '#e94560', marginBottom: '0.15rem' }}>Q{i + 1}. {q.topic && <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>({q.topic})</span>}</div>
                <div>{q.question}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>Answer: <strong>{q.answer}</strong></div>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { handlePrint(viewWorksheet); setViewWorksheet(null); }}>🖨 Print</button>
              <button className="btn btn-secondary" onClick={() => setViewWorksheet(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete Worksheet</h2>
            <p>Are you sure you want to delete the worksheet for <strong>{deleteTarget.student?.name || 'this student'}</strong>?</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem' }}>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default WorksheetHistory;
