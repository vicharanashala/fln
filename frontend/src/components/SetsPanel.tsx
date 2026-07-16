import React, { useState, useEffect } from 'react';
import { Table, Column } from './Table';
import { Layers } from 'lucide-react';

const SET_STATUS_ORDER = [
  'Created',
  'Question Papers Generated',
  'Printed',
  'Dispatched',
  'Delivered to School',
  'Assessment Conducted',
  'Answer Sheets Returned',
  'Scanning Completed',
  'Evaluation Completed',
];

const getNextStatus = (currentStatus: string): string | null => {
  const currentIndex = SET_STATUS_ORDER.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === SET_STATUS_ORDER.length - 1) {
    return null;
  }
  return SET_STATUS_ORDER[currentIndex + 1];
};

export const SetsPanel: React.FC<{ token: string }> = ({ token }) => {
  const [sets, setSets] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    setId: '',
    assessmentName: '',
    schoolId: '',
    classGroup: '',
    status: ''
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  
  const [newSet, setNewSet] = useState({
    name: '',
    assessmentName: '',
    schoolId: '',
    classGroup: ''
  });
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState('');
  const [activeJobs, setActiveJobs] = useState<Record<string, any>>({});

  const fetchSets = () => {
    const queryParams = new URLSearchParams();
    if (filters.setId) queryParams.append('setId', filters.setId);
    if (filters.assessmentName) queryParams.append('assessmentName', filters.assessmentName);
    if (filters.schoolId) queryParams.append('schoolId', filters.schoolId);
    if (filters.classGroup) queryParams.append('classGroup', filters.classGroup);
    if (filters.status) queryParams.append('status', filters.status);

    const url = `/api/sets${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setSets(d);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSchools(d); })
      .catch(console.error);
      
    fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setStudents(d); })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchSets();
  }, [token, filters.setId, filters.assessmentName, filters.schoolId, filters.classGroup, filters.status]);

  const runningJobKeys = Object.entries(activeJobs)
    .filter(([_, j]) => (j as any).status === 'running')
    .map(([id, j]) => `${id}:${(j as any).jobId}`)
    .join(',');

  useEffect(() => {
    const runningEntries = Object.entries(activeJobs).filter(([_, j]) => (j as any).status === 'running');
    if (runningEntries.length === 0) return;

    const interval = setInterval(async () => {
      for (const [setId, job] of runningEntries) {
        try {
          const res = await fetch(`/api/sets/${setId}/generate/${(job as any).jobId}/progress`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setActiveJobs(prev => ({
              ...prev,
              [setId]: data
            }));
          }
        } catch (err) {
          console.error(err);
        }
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [runningJobKeys, token]);

  const handleGenerate = async (setId: string) => {
    try {
      const res = await fetch(`/api/sets/${setId}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveJobs(prev => ({
          ...prev,
          [setId]: { jobId: data.jobId, status: 'running', completed: 0, total: data.total || 1, failures: [] }
        }));
      }
    } catch (err) {
      console.error('Failed to start generation', err);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdateStatus = async (setId: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/sets/${setId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchSets();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      setId: '',
      assessmentName: '',
      schoolId: '',
      classGroup: '',
      status: ''
    });
  };

  const availableStudents = students.filter(
    s => s.schoolId === newSet.schoolId && s.classGroup === newSet.classGroup
  );

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newSet.name || !newSet.assessmentName || !newSet.schoolId || !newSet.classGroup) {
      setFormError('All fields are required.');
      return;
    }

    if (selectedStudents.size === 0) {
      setFormError('Please select at least one student.');
      return;
    }

    try {
      const res = await fetch('/api/sets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newSet,
          studentIds: Array.from(selectedStudents)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create set');
      }

      setIsCreateModalOpen(false);
      setNewSet({ name: '', assessmentName: '', schoolId: '', classGroup: '' });
      setSelectedStudents(new Set());
      fetchSets();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const schoolMap = new Map<string, any>(schools.map(s => [s.id, s]));

  const columns: Column<any>[] = [
    { header: 'Set ID', accessor: 'id', className: 'font-mono text-xs text-slate-500' },
    { header: 'Name', accessor: 'name', className: 'font-semibold text-slate-800 dark:text-slate-100' },
    { header: 'Assessment', accessor: 'assessmentName', className: 'text-sm' },
    { header: 'School', accessor: (row) => schoolMap.get(row.schoolId)?.name || row.schoolId, className: 'text-sm text-slate-500' },
    { header: 'Grade', accessor: 'classGroup', className: 'text-sm' },
    { header: 'Students', accessor: (row) => row.studentIds?.length || 0, className: 'text-sm font-mono' },
    { header: 'Status', accessor: 'status', className: 'text-sm font-semibold' },
    { header: 'Created', accessor: (row) => new Date(row.createdAt).toLocaleDateString(), className: 'text-sm text-slate-500' },
    {
      header: 'Actions',
      accessor: (row) => {
        const job = activeJobs[row.id];
        const nextStatus = getNextStatus(row.status);

        if (job) {
          if (job.status === 'running') {
            const pct = Math.round((job.completed / Math.max(1, job.total)) * 100);
            return (
              <div className="w-32">
                <div className="flex justify-between text-[10px] mb-1 font-mono text-slate-500">
                  <span>Generating</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          }
          if (job.status === 'completed') {
            return (
              <div className="flex flex-col gap-1 items-start w-32">
                <a 
                  href={`/api/sets/${row.id}/download?token=${encodeURIComponent(token)}`} 
                  className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-center w-full block hover:bg-emerald-100 transition-colors font-mono"
                >
                  Download Package
                </a>
                {job.failures && job.failures.length > 0 && (
                  <span className="text-[9px] text-red-500 font-bold block">{job.failures.length} failed</span>
                )}
                {row.status === 'Created' && (
                  <button
                    onClick={() => handleUpdateStatus(row.id, 'Question Papers Generated')}
                    className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 transition-colors w-full cursor-pointer"
                  >
                    Mark: Generated
                  </button>
                )}
              </div>
            );
          }
          if (job.status === 'failed') {
            return <span className="text-[10px] text-red-500 font-bold">Generation failed</span>;
          }
        }

        if (row.status === 'Created') {
          return (
            <button 
              onClick={() => handleGenerate(row.id)}
              className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              Generate Papers
            </button>
          );
        }

        if (nextStatus) {
          return (
            <button
              onClick={() => handleUpdateStatus(row.id, nextStatus)}
              className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Mark: {nextStatus}
            </button>
          );
        }

        return null;
      },
      className: ''
    }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-slate-500 dark:text-slate-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">District Sets</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage and track bulk paper generation batches.</p>
          </div>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          + Create Set
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <input 
          type="text" 
          name="setId"
          placeholder="Filter by Set ID..." 
          value={filters.setId}
          onChange={handleFilterChange}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
        />
        <input 
          type="text" 
          name="assessmentName"
          placeholder="Filter by Assessment..." 
          value={filters.assessmentName}
          onChange={handleFilterChange}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
        />
        <select 
          name="schoolId"
          value={filters.schoolId}
          onChange={handleFilterChange}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
        >
          <option value="">All Schools</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select 
          name="classGroup"
          value={filters.classGroup}
          onChange={handleFilterChange}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
        >
          <option value="">All Grades</option>
          <option value="Class 1">Class 1</option>
          <option value="Class 2">Class 2</option>
          <option value="Class 3">Class 3</option>
          <option value="Class 4">Class 4</option>
        </select>
        <div className="flex gap-2">
          <select 
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="Created">Created</option>
            <option value="Question Papers Generated">Question Papers Generated</option>
            <option value="Printed">Printed</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Delivered to School">Delivered to School</option>
            <option value="Assessment Conducted">Assessment Conducted</option>
            <option value="Answer Sheets Returned">Answer Sheets Returned</option>
            <option value="Scanning Completed">Scanning Completed</option>
            <option value="Evaluation Completed">Evaluation Completed</option>
          </select>
          <button 
            onClick={handleResetFilters}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <Table data={sets} columns={columns} />

      {/* Create Set Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New Set</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Set Name</label>
                  <input required type="text" value={newSet.name} onChange={e => setNewSet({...newSet, name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assessment Name</label>
                  <input required type="text" value={newSet.assessmentName} onChange={e => setNewSet({...newSet, assessmentName: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">School</label>
                  <select required value={newSet.schoolId} onChange={e => setNewSet({...newSet, schoolId: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    <option value="">Select School</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Grade / Class</label>
                  <select required value={newSet.classGroup} onChange={e => setNewSet({...newSet, classGroup: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    <option value="">Select Class</option>
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                    <option value="Class 4">Class 4</option>
                  </select>
                </div>
              </div>

              {newSet.schoolId && newSet.classGroup && (
                <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Select Students ({availableStudents.length} available)</label>
                    <button type="button" onClick={() => setSelectedStudents(new Set(availableStudents.map(s => s.id)))} className="text-xs text-indigo-600 hover:text-indigo-800">Select All</button>
                  </div>
                  
                  {availableStudents.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 p-4 text-center bg-slate-50 dark:bg-slate-800 rounded-lg">
                      No students found for this school and class.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
                      {availableStudents.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{s.id}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateSubmit} disabled={!newSet.name || !newSet.assessmentName || !newSet.schoolId || !newSet.classGroup || selectedStudents.size === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Create Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
