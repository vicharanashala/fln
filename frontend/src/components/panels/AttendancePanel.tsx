// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 4).
import React from 'react';
import { Student, EvaluationReport } from '../../types';
import { PageHeader } from './PanelShared';
import { MetricCard } from '../Card';
import { Users, FileText, BarChart3, Award, Calendar, CheckCircle2, XCircle } from 'lucide-react';

export const AttendancePanel: React.FC<{ students: Student[]; reportsList: EvaluationReport[] }> = ({ students, reportsList }) => {
    const examAttendance = students.map(s => {
      const reports = reportsList.filter(r => r.studentId === s.id);
      const examsGiven = reports.length;
      const lastExam = examsGiven > 0 ? new Date(Math.max(...reports.map(r => new Date(r.timestamp).getTime()))).toLocaleDateString() : 'N/A';
      const avgScore = examsGiven > 0 ? Math.round(reports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / examsGiven) : 0;
      return { student: s.name, class: `${s.classGroup} - ${s.section}`, examsGiven, lastExam, avgScore, placed: s.levelHistory.length > 0 };
    });
    const totalExams = examAttendance.reduce((a, e) => a + e.examsGiven, 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Students" value={examAttendance.length} subtext="Assigned roster" icon={Users} />
          <MetricCard title="Exams Conducted" value={totalExams} subtext="Across all students" icon={FileText} />
          <MetricCard title="Avg Exams/Student" value={`${(totalExams / examAttendance.length).toFixed(1)}`} subtext="Participation rate" icon={BarChart3} />
          <MetricCard title="Placed Students" value={examAttendance.filter(e => e.placed).length} subtext="Have level history" icon={Award} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title="Exam Attendance Records" desc="Track which students have appeared for assessments and their performance" icon={<Calendar className="h-5 w-5" />} />
          <div className="space-y-2 mt-4">{examAttendance.map(a => (
            <div key={a.student} className="flex items-center gap-4 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
              <div className="flex items-center gap-3 w-8">{a.examsGiven > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600" />}</div>
              <div className="flex-1 min-w-0"><span className="text-sm font-medium">{a.student}</span><span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{a.class}</span></div>
              <div className="flex items-center gap-6 text-sm shrink-0">
                <div className="text-center"><div className="font-bold text-slate-900 dark:text-white">{a.examsGiven}</div><div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase">Exams</div></div>
                <div className="text-center"><div className={`font-bold ${a.avgScore >= 70 ? 'text-emerald-600' : a.avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{a.examsGiven > 0 ? `${a.avgScore}%` : '—'}</div><div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase">Avg Score</div></div>
                <div className="text-center"><div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{a.lastExam}</div><div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase">Last Exam</div></div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${a.placed ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{a.placed ? 'Placed' : 'Pending'}</span>
              </div>
            </div>
          ))}</div>
        </div>
      </div>
    );
};
