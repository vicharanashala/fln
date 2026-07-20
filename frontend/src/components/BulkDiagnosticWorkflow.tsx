import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { FileText, Download, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface BulkDiagnosticWorkflowProps {
  user: any;
  token: string;
  userRole: UserRole;
  onBack: () => void;
}

interface JobStatus {
  jobId: string;
  classNumber: number;
  totalStudents: number;
  completed: number;
  status: 'running' | 'completed' | 'failed';
  pdfUrl: string;
  templateUrl?: string;
  error: string;
  downloadUrl: string | null;
}

export const BulkDiagnosticWorkflow: React.FC<BulkDiagnosticWorkflowProps> = ({ user, token, userRole, onBack }) => {
  const [classLevel, setClassLevel] = useState<number>(2); // Default to Class 2
  const [totalStudents, setTotalStudents] = useState<number | ''>(30); // Default to 30 students
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Polling bulk job progress
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnostic/bulk/${job.jobId}/progress`);
        if (res.ok) {
          const data = await res.json();
          setJob(data);
          if (data.status !== 'running') {
            clearInterval(interval);
          }
        } else {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [job?.jobId, job?.status]);

  const handleGenerateBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classLevel) {
      setError('Please select a class level.');
      return;
    }
    const count = Number(totalStudents);
    if (!count || count <= 0) {
      setError('Please specify a valid positive number of students.');
      return;
    }

    setLoading(true);
    setError('');
    setJob(null);

    try {
      const res = await fetch('/api/diagnostic/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classNumber: classLevel,
          count
        })
      });
      const data = await res.json();
      if (res.ok) {
        setJob(data);
      } else {
        setError(data.error || 'Failed to start bulk generation job.');
      }
    } catch {
      setError('Network error starting bulk diagnostic generation.');
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = job ? Math.round((job.completed / job.totalStudents) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" id="bulk-diagnostic-workflow">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            Bulk Diagnostic Generator
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Generate scan-ready diagnostic papers with real QR identity, corner markers, and stored ROI template data.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium text-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Batch Control Form */}
      <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleGenerateBulk} className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 block mb-2">
              Baseline Class Level
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setClassLevel(lvl)}
                  className={`py-3 text-center border font-display font-bold text-sm rounded-xl transition-all cursor-pointer ${
                    classLevel === lvl
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  Class {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 block mb-2" htmlFor="total-students">
              Number of Students
            </label>
            <input
              id="total-students"
              type="number"
              min={1}
              max={1000}
              value={totalStudents}
              onChange={(e) => setTotalStudents(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
              placeholder="e.g. 30"
              className="w-full text-base rounded-xl border-zinc-300 dark:border-zinc-600 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-905 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border font-mono"
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
              Accepts 1 - 1000 sheets per diagnostic batch.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || totalStudents === '' || totalStudents <= 0 || job?.status === 'running'}
            className="w-full bg-zinc-950 hover:bg-zinc-850 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Initializing batch...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Generate Scan-Ready Class {classLevel} Papers ({totalStudents || 0} Sets)
              </>
            )}
          </button>
        </form>
      </div>

      {/* Bulk Job Progress / Output Status */}
      {job && (
        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-medium text-zinc-900 dark:text-white">
              Scan-Ready Paper Batch Progress (Class {job.classNumber})
            </h3>
            <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">Job ID: {job.jobId}</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
              <span>Progress: {job.completed} / {job.totalStudents} sheets rendered</span>
              <span
                className={`font-semibold ${
                  job.status === 'running' ? 'text-blue-600' : job.status === 'completed' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {job.status === 'running' ? 'Generating...' : job.status === 'completed' ? 'Ready to Print' : 'Failed'}
              </span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  job.status === 'completed' ? 'bg-green-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-center text-xs font-mono text-zinc-400 dark:text-zinc-500">{progressPercent}% completed</div>
          </div>

          {job.status === 'running' && (
            <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
              <Clock className="w-4 h-4 animate-spin text-blue-500" />
              <span>Generating and compiling baseline mathematics papers. Please keep this browser window open...</span>
            </div>
          )}

          {job.status === 'completed' && job.downloadUrl && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={job.downloadUrl}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm py-2.5 px-5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Scan-Ready PDF ({job.totalStudents} papers)
              </a>
              {job.pdfUrl && (
                <a
                  href={job.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 px-5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Print / Open PDF
                </a>
              )}
              {job.templateUrl && (
                <a
                  href={job.templateUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 font-medium text-sm py-2.5 px-5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Open ROI Template JSON
                </a>
              )}
              <p className="basis-full text-xs text-green-700 font-mono">
                Format: real QR, four page-corner markers, boxed questions, Q anchors, answer ROI coordinates.
              </p>
            </div>
          )}

          {job.status === 'failed' && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>{job.error || 'Generation failed. Please try again.'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
