import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { worksheets } from '../../services/api';
import { handlePrint, handleDownloadPDF } from '../../utils/worksheetActions';
import { getErrorMessage } from '../../utils/validation';
import Toast from '../../components/Toast';
import Spinner from '../../components/Spinner';

function WorksheetHistory() {
  const [worksheetList, setWorksheetList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [regeneratingId, setRegeneratingId] = useState(null);

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [viewWorksheet, setViewWorksheet] = useState(null);
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
      setError(getErrorMessage(err));
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

  const handleView = async (ws) => {
    try {
      const res = await worksheets.get(ws._id);
      setViewWorksheet(res.data.worksheet);
    } catch (err) {
      setToast({ message: getErrorMessage(err), type: 'error' });
    }
  };

  const handleRegenerate = async (ws) => {
    setRegeneratingId(ws._id);
    setError('');
    try {
      const res = await worksheets.regenerate(ws._id);
      const newWs = res.data.worksheet;
      setWorksheetList([newWs, ...worksheetList]);
      setToast({ message: `New worksheet generated for ${newWs.student?.name || 'student'}`, type: 'success' });
    } catch (err) {
      setToast({ message: getErrorMessage(err), type: 'error' });
    }
    setRegeneratingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await worksheets.delete(deleteTarget._id);
      setWorksheetList(worksheetList.filter(w => w._id !== deleteTarget._id));
      setToast({ message: 'Worksheet deleted successfully', type: 'success' });
    } catch (err) {
      setToast({ message: getErrorMessage(err), type: 'error' });
    }
    setDeleteTarget(null);
  };

  return (
    <Layout>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div className="page-header">
        <h1>Worksheet History</h1>
        <p>View, print, regenerate, or delete previously generated question papers</p>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}

      <div className="filter-card" style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label htmlFor="history-search">Search</label>
              <input
                id="history-search"
                placeholder="Search by student name or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: '0 1 100px', marginBottom: 0 }}>
              <label htmlFor="filter-grade">Grade</label>
              <select id="filter-grade" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                <option value="">All</option>
                {[1,2,3,4,5].map(g => <option key={g} value={g}>Class {g}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 120px', marginBottom: 0 }}>
              <label htmlFor="filter-level">FLN Level</label>
              <select id="filter-level" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                <option value="">All</option>
                {[1,2,3,4,5,6,7,8].map(l => <option key={l} value={`Level${l}`}>Level {l}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 140px', marginBottom: 0 }}>
              <label htmlFor="filter-cycle">Cycle</label>
              <select id="filter-cycle" value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}>
                <option value="">All</option>
                <option value="practice">Practice</option>
                <option value="baseline">Baseline</option>
                <option value="mid_year">Mid-Year</option>
                <option value="end_year">End-Year</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 130px', marginBottom: 0 }}>
              <label htmlFor="filter-start">From</label>
              <input id="filter-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 130px', marginBottom: 0 }}>
              <label htmlFor="filter-end">To</label>
              <input id="filter-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 100px', marginBottom: 0 }}>
              <label htmlFor="filter-sort">Sort</label>
              <select id="filter-sort" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1px' }}>
              <button type="submit" className="btn btn-primary btn-sm">Search</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleClearFilters}>Clear</button>
            </div>
          </div>
        </form>
      </div>

      {loading && (
        <Spinner size="lg" text="Loading worksheet history..." />
      )}

      {!loading && worksheetList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No worksheets found</p>
          <p>Generate question papers to see them here.</p>
        </div>
      )}

      {!loading && worksheetList.length > 0 && (
        <div className="data-table table-wrapper">
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
                    <div className="btn-group">
                      <button className="btn btn-outline btn-sm" onClick={() => handleView(ws)} title="View worksheet" aria-label="View worksheet">View</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handlePrint(ws)} title="Print worksheet" aria-label="Print worksheet">Print</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleDownloadPDF(ws)} title="Download PDF" aria-label="Download worksheet as PDF">PDF</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleRegenerate(ws)} disabled={regeneratingId === ws._id} title="Regenerate worksheet" aria-label="Regenerate worksheet">
                        {regeneratingId === ws._id ? '...' : 'Regen'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(ws)} title="Delete worksheet" aria-label="Delete worksheet">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewWorksheet && (
        <div className="modal-overlay" onClick={() => setViewWorksheet(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', overflow: 'auto' }} role="dialog" aria-label="View worksheet">
            <h2>Worksheet - {viewWorksheet.worksheetId}</h2>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
              <strong>Student:</strong> {viewWorksheet.student?.name} | <strong>Level:</strong> {viewWorksheet.level} | <strong>Cycle:</strong> {viewWorksheet.assessmentCycle}
            </div>
            {viewWorksheet.worksheetJson?.questions?.map((q, i) => (
              <div key={i} style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <div style={{ fontWeight: 700, color: '#e94560', marginBottom: '0.15rem' }}>
                  Q{i + 1}. {q.topic && <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>({q.topic})</span>}
                </div>
                <div>{q.question}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>Answer: <strong>{q.answer}</strong></div>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { handlePrint(viewWorksheet); setViewWorksheet(null); }}>Print</button>
              <button className="btn btn-secondary" onClick={() => setViewWorksheet(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Delete worksheet">
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
