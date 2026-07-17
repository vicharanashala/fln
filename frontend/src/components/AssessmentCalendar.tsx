import React, { useState } from 'react';
import { Calendar, Clock, Download, FileText, CheckCircle, Info } from 'lucide-react';

export const AssessmentCalendar: React.FC = () => {
  const [activeCycle, setActiveCycle] = useState<'baseline' | 'midyear' | 'endyear'>('baseline');
  const [activeTab, setActiveTab] = useState<'timeline' | 'grid' | 'guidelines'>('timeline');

  const cycles = {
    baseline: {
      name: 'Baseline Assessment (Cycle 1)',
      period: 'July 1 - July 15, 2026',
      status: 'In Progress',
      color: 'amber',
      milestones: [
        { phase: 'Question Paper Customization', dates: 'July 1 - July 3', desc: 'Teachers review and lock generative mathematics worksheets', completed: true },
        { phase: 'Print & Distribution Window', dates: 'July 4 - July 6', desc: 'School administration downloads PDFs and prints physical sheets', completed: true },
        { phase: 'Assessment Conduct Period', dates: 'July 7 - July 10', desc: 'On-site paper examination for Classes 2-4', completed: false, current: true },
        { phase: 'ICR Ingestion & Scan Upload', dates: 'July 11 - July 13', desc: 'Scribing or scanning student solution sheets to automated engine', completed: false },
        { phase: 'Evaluation Report Release', dates: 'July 14 - July 15', desc: 'Dynamic level mapping and student progress scorecard broadcast', completed: false }
      ],
      days: [
        { date: 1, label: 'Customization Start', event: 'Paper Gen', type: 'prep' },
        { date: 2, label: '', event: '', type: '' },
        { date: 3, label: 'Review Deadline', event: 'Locking', type: 'prep' },
        { date: 4, label: 'Print Window', event: 'PDF Print', type: 'print' },
        { date: 5, label: '', event: 'PDF Print', type: 'print' },
        { date: 6, label: '', event: 'Distribution', type: 'print' },
        { date: 7, label: 'Conduct Day 1', event: 'Baseline Exam', type: 'exam' },
        { date: 8, label: 'Conduct Day 2', event: 'Baseline Exam', type: 'exam' },
        { date: 9, label: 'Conduct Day 3', event: 'Baseline Exam', type: 'exam' },
        { date: 10, label: 'Conduct Day 4', event: 'Baseline Exam', type: 'exam' },
        { date: 11, label: 'Ingestion Start', event: 'ICR Scanning', type: 'scan' },
        { date: 12, label: '', event: 'ICR Scanning', type: 'scan' },
        { date: 13, label: 'Ingestion End', event: 'Uploads', type: 'scan' },
        { date: 14, label: 'Evaluation Phase', event: 'AI Scoring', type: 'eval' },
        { date: 15, label: 'Cycle Concluded', event: 'Report Out', type: 'eval' }
      ]
    },
    midyear: {
      name: 'Mid-Year Assessment (Cycle 2)',
      period: 'November 1 - November 15, 2026',
      status: 'Upcoming',
      color: 'indigo',
      milestones: [
        { phase: 'Question Paper Customization', dates: 'Nov 1 - Nov 3', desc: 'Adaptive generation of progressive targets for Classes 2-4', completed: false },
        { phase: 'Print & Distribution Window', dates: 'Nov 4 - Nov 6', desc: 'Physical production of student assessment packets', completed: false },
        { phase: 'Assessment Conduct Period', dates: 'Nov 7 - Nov 10', desc: 'Classroom evaluation and oral evaluations for low-strength settings', completed: false },
        { phase: 'ICR Ingestion & Scan Upload', dates: 'Nov 11 - Nov 13', desc: 'Optical character reading of student answers', completed: false },
        { phase: 'Evaluation Report Release', dates: 'Nov 14 - Nov 15', desc: 'Comprehensive mid-year competency review and feedback loop', completed: false }
      ],
      days: [
        { date: 1, label: 'Customization Start', event: 'Paper Gen', type: 'prep' },
        { date: 3, label: 'Review Deadline', event: 'Locking', type: 'prep' },
        { date: 4, label: 'Print Window', event: 'PDF Print', type: 'print' },
        { date: 6, label: 'Distribution', event: 'Packets', type: 'print' },
        { date: 7, label: 'Conduct Day 1', event: 'Midterm Exam', type: 'exam' },
        { date: 10, label: 'Conduct End', event: 'Midterm Exam', type: 'exam' },
        { date: 11, label: 'Ingestion Start', event: 'ICR Scanning', type: 'scan' },
        { date: 13, label: 'Ingestion End', event: 'Uploads', type: 'scan' },
        { date: 14, label: 'Evaluation Phase', event: 'AI Scoring', type: 'eval' },
        { date: 15, label: 'Reports Active', event: 'Card Release', type: 'eval' }
      ]
    },
    endyear: {
      name: 'End-of-Year Assessment (Cycle 3)',
      period: 'March 1 - March 15, 2027',
      status: 'Scheduled',
      color: 'emerald',
      milestones: [
        { phase: 'Question Paper Customization', dates: 'March 1 - March 3', desc: 'Summative mastery targets aligned to Class levels', completed: false },
        { phase: 'Print & Distribution Window', dates: 'March 4 - March 6', desc: 'School printing and local block dispatch', completed: false },
        { phase: 'Assessment Conduct Period', dates: 'March 7 - March 10', desc: 'Final classroom exams and diagnostic verification', completed: false },
        { phase: 'ICR Ingestion & Scan Upload', dates: 'March 11 - March 13', desc: 'Final verification uploads', completed: false },
        { phase: 'Evaluation Report Release', dates: 'March 14 - March 15', desc: 'FLN Certification compliance awards and level upgrade summaries', completed: false }
      ],
      days: [
        { date: 1, label: 'Customization Start', event: 'Final Gen', type: 'prep' },
        { date: 3, label: 'Review Deadline', event: 'Locking', type: 'prep' },
        { date: 4, label: 'Print Window', event: 'PDF Print', type: 'print' },
        { date: 6, label: 'Distribution', event: 'Packets', type: 'print' },
        { date: 7, label: 'Final Exams', event: 'Summative Exam', type: 'exam' },
        { date: 10, label: 'Conduct End', event: 'Summative Exam', type: 'exam' },
        { date: 11, label: 'Ingestion Start', event: 'ICR Scanning', type: 'scan' },
        { date: 13, label: 'Ingestion End', event: 'Uploads', type: 'scan' },
        { date: 14, label: 'Certification Phase', event: 'AI Audit', type: 'eval' },
        { date: 15, label: 'Graduation Day', event: 'Awards Release', type: 'eval' }
      ]
    }
  };

  const selectedCycle = cycles[activeCycle];

  return (
    <div className="space-y-6" id="assessment-calendar">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white tracking-tight">
            Academic Assessment Calendar
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Official FLN framework schedule outlining question generation, locks, printing, and grading milestones.
          </p>
        </div>

        {/* Cycle selector buttons */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit self-start">
          <button
            onClick={() => setActiveCycle('baseline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeCycle === 'baseline' ? 'bg-white dark:bg-slate-800 text-zinc-900 dark:text-white shadow-sm font-semibold' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Baseline (July)
          </button>
          <button
            onClick={() => setActiveCycle('midyear')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeCycle === 'midyear' ? 'bg-white dark:bg-slate-800 text-zinc-900 dark:text-white shadow-sm font-semibold' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Mid-Year (Nov)
          </button>
          <button
            onClick={() => setActiveCycle('endyear')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeCycle === 'endyear' ? 'bg-white dark:bg-slate-800 text-zinc-900 dark:text-white shadow-sm font-semibold' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            End-of-Year (Mar)
          </button>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 gap-6">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 text-sm font-display font-medium border-b-2 transition-all ${
            activeTab === 'timeline' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          Phase-by-Phase Timeline
        </button>
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-3 text-sm font-display font-medium border-b-2 transition-all ${
            activeTab === 'grid' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          Dynamic Calendar Grid
        </button>
        <button
          onClick={() => setActiveTab('guidelines')}
          className={`pb-3 text-sm font-display font-medium border-b-2 transition-all ${
            activeTab === 'guidelines' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          Conduct Guidelines & SLA
        </button>
      </div>

      {/* Content Rendering */}
      {activeTab === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500">Assessment Phases</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                  activeCycle === 'baseline' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : activeCycle === 'midyear' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300' : 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300'
                }`}>
                  {selectedCycle.status}
                </span>
              </div>
              <h3 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">{selectedCycle.name}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Complete window: {selectedCycle.period}
              </p>

              {/* Milestones list */}
              <div className="relative border-l-2 border-zinc-150 pl-5 ml-2.5 py-3 space-y-6">
                {selectedCycle.milestones.map((m, idx) => (
                  <div key={idx} className="relative">
                    {/* Ring dot indicator */}
                    <div className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 bg-white transition-all ${
                      m.completed ? 'border-green-600 bg-green-500' : m.current ? 'border-amber-600 animate-pulse bg-amber-500' : 'border-zinc-300'
                    }`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-medium text-sm text-zinc-900 dark:text-white">{m.phase}</span>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">
                          {m.dates}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SLA Sidepanel Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-zinc-900 text-white rounded-xl p-6 space-y-4 shadow-sm border-none">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">FLN Mandate SLA §12</span>
              <h4 className="font-display font-medium text-base text-zinc-100">Immutable Timeline Window Rules</h4>
              <p className="text-zinc-300 text-xs leading-relaxed">
                As per national standards, question paper locks trigger <strong>72 hours before the conduct hour</strong>. Delay logs are triggered if ICR grading sheet ingestion exceeds 72 hours from examination date.
              </p>
              <div className="p-3 bg-zinc-800 rounded-lg space-y-2 border border-zinc-700">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block font-bold">Automatic Locker Warning</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Locking systems verify teacher customizations automatically. Unresolved changes will fall back to national templates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'grid' && (
        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-150 dark:border-zinc-700 pb-4">
            <div>
              <h4 className="font-display font-semibold text-zinc-950 dark:text-white text-base">{selectedCycle.name}</h4>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-0.5">Assigned calendar blocks for key activities.</p>
            </div>
            
            {/* Legend indicators */}
            <div className="flex flex-wrap gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-300 block" /> Preparation</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 block" /> Printing</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-300 block" /> Conducting Exam</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-300 block" /> ICR Ingestion</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 block" /> AI Grading</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {selectedCycle.days.map((day, index) => {
              let bg = 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
              let badgeText = '';
              let badgeColor = '';
              
              if (day.type === 'prep') {
                bg = 'bg-blue-50/50 border-blue-200 text-blue-900';
                badgeText = 'Prep';
                badgeColor = 'bg-blue-100 text-blue-800';
              } else if (day.type === 'print') {
                bg = 'bg-amber-50/50 border-amber-200 text-amber-900';
                badgeText = 'Print';
                badgeColor = 'bg-amber-100 text-amber-800';
              } else if (day.type === 'exam') {
                bg = 'bg-rose-50/50 border-rose-200 text-rose-900';
                badgeText = 'Exam';
                badgeColor = 'bg-rose-100 text-rose-800';
              } else if (day.type === 'scan') {
                bg = 'bg-indigo-50/50 border-indigo-200 text-indigo-900';
                badgeText = 'ICR Ingest';
                badgeColor = 'bg-indigo-100 text-indigo-800';
              } else if (day.type === 'eval') {
                bg = 'bg-emerald-50/50 border-emerald-200 text-emerald-900';
                badgeText = 'AI Grading';
                badgeColor = 'bg-emerald-100 text-emerald-800';
              }

              return (
                <div key={index} className={`border p-4 rounded-xl flex flex-col justify-between h-24 shadow-sm transition-all hover:scale-[1.01] ${bg}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-sm font-bold">Day {day.date}</span>
                    {badgeText && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider font-bold ${badgeColor}`}>
                        {badgeText}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block truncate">{day.event || 'Standard Schedule'}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono block truncate">{day.label || 'Framework Window'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'guidelines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-display font-semibold text-zinc-900 dark:text-white text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-500 dark:text-zinc-400" /> Principal & Grader Conduct Guidelines
            </h4>
            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p className="font-medium text-zinc-800 dark:text-zinc-100">Please review key operational requirements for conducting examinations:</p>
              <ul className="list-disc pl-5 space-y-2.5">
                <li><strong>No Internet Setting:</strong> Schools with poor network flags are authorized to download PDF papers early, or request printed block dispatch 5 days in advance.</li>
                <li><strong>Oral Scribing:</strong> Scribing answers manually is approved for Class 2 students when physical scanning is unavailable.</li>
                <li><strong>Aadhar Obfuscation:</strong> Ensure physical worksheets masking procedures are followed before upload. Strictly avoid raw identity exposures.</li>
                <li><strong>Lock Override:</strong> In emergencies, Block Admins can authorize manual locks overrides up to 12 hours before assessment schedule starts.</li>
              </ul>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-display font-semibold text-zinc-900 dark:text-white text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-zinc-500 dark:text-zinc-400" /> SLA Thresholds & Penalties
            </h4>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono uppercase text-[10px]">
                  <th className="p-2">Milestone Phase</th>
                  <th className="p-2">SLA Window</th>
                  <th className="p-2">Delayed Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                <tr>
                  <td className="p-2 font-medium text-zinc-900 dark:text-white">Worksheet Customization</td>
                  <td className="p-2 text-zinc-700 dark:text-zinc-200">Lock at T-72 Hours</td>
                  <td className="p-2 text-red-600 font-mono">Rollback to Default</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900 dark:text-white">Paper Printing</td>
                  <td className="p-2 text-zinc-700 dark:text-zinc-200">T-48 to T-24 Hours</td>
                  <td className="p-2 text-amber-600 font-mono">Warn Admin</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900 dark:text-white">Grade Sheet Upload</td>
                  <td className="p-2 text-zinc-700 dark:text-zinc-200">Assessment Day +72 hrs</td>
                  <td className="p-2 text-red-600 font-mono">Log SLA Violation</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900 dark:text-white">Report Delivery</td>
                  <td className="p-2 text-zinc-700 dark:text-zinc-200">Assessment Day +96 hrs</td>
                  <td className="p-2 text-zinc-500 dark:text-zinc-400 font-mono">Escalate Tech</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
