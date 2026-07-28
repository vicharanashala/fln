import React, { useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, CheckCircle2, SlidersHorizontal, Users } from 'lucide-react';

type CompetencyPerformance = {
  competency: string;
  grade: string;
  assessedStudents: number;
  studentsNeedingSupport: number;
  description: string;
};

const COMPETENCY_PERFORMANCE: CompetencyPerformance[] = [
  { competency: 'Borrow Subtraction', grade: 'Class 2', assessedStudents: 126, studentsNeedingSupport: 78, description: 'Regrouping across tens' },
  { competency: 'Pattern Recognition', grade: 'Preschool 3', assessedStudents: 98, studentsNeedingSupport: 58, description: 'Extending and identifying repeating patterns' },
  { competency: 'Place Value', grade: 'Class 3', assessedStudents: 114, studentsNeedingSupport: 36, description: 'Hundreds, tens, and ones' },
  { competency: 'Time and Calendar', grade: 'Class 2', assessedStudents: 107, studentsNeedingSupport: 29, description: 'Reading clocks and sequencing dates' },
  { competency: 'Addition through Objects', grade: 'Preschool 3', assessedStudents: 91, studentsNeedingSupport: 19, description: 'Combining quantities with concrete objects' },
];

const percentage = (value: number, total: number) => Math.round((value / total) * 100);

export const CurriculumFeedback: React.FC = () => {
  const [threshold, setThreshold] = useState(50);
  const flaggedCompetencies = useMemo(
    () => COMPETENCY_PERFORMANCE.filter(item => percentage(item.studentsNeedingSupport, item.assessedStudents) >= threshold),
    [threshold],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Curriculum Feedback</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Automatically flag competencies where a large proportion of assessed students need support, so curriculum designers can review instructional materials.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Based on the latest assessment cycle
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" /> Alert threshold
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Flag a competency when this percentage or more of students need support.</p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              aria-label="Curriculum feedback alert threshold"
              type="range"
              min="20"
              max="80"
              step="5"
              value={threshold}
              onChange={event => setThreshold(Number(event.target.value))}
              className="accent-indigo-600"
            />
            <span className="min-w-12 rounded-md bg-indigo-50 px-2 py-1 text-center font-mono text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">{threshold}%</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Competency review queue</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{flaggedCompetencies.length} competency{flaggedCompetencies.length === 1 ? '' : 'ies'} currently flagged for review.</p>
          </div>
          {flaggedCompetencies.length > 0 && <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {COMPETENCY_PERFORMANCE.map(item => {
            const needsSupport = percentage(item.studentsNeedingSupport, item.assessedStudents);
            const isFlagged = needsSupport >= threshold;

            return (
              <div key={item.competency} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white">{item.competency}</h4>
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.grade}</span>
                    {isFlagged ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Needs curriculum review</span>
                    ) : (
                      <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> On track</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <div className="w-full md:w-56">
                  <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>{needsSupport}% need support</span>
                    <span className="flex items-center gap-1 text-slate-400"><Users className="h-3 w-3" /> {item.assessedStudents}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className={isFlagged ? 'h-full rounded-full bg-amber-500' : 'h-full rounded-full bg-emerald-500'} style={{ width: `${needsSupport}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
