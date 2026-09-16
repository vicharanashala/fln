// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 5).
// Note: this move fixes issue #245 as a side effect — the search/classFilter
// useState calls used to live inside PanelViews.tsx's conditional
// `if (panel === 'content')` block (a React hooks-order violation that
// crashed the app when navigating here from another panel). As this
// component's own top-level hooks, they're now called unconditionally.
import React, { useState } from 'react';
import { BookMarked } from 'lucide-react';
import { FLN_LEVELS_LIST } from '../RoleDashboards';

export const ContentPanel: React.FC = () => {
    // Render the full 93-level FLN framework as cards, grouped by class
    // (Preschool 1/2/3 + Class 1/2/3/4). All data comes from
    // FLN_LEVELS_LIST in RoleDashboards — no backend fetch needed since
    // the worksheet HTML is generated on demand by the worksheet engine
    // when the user clicks "Open" / "Print".
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState<string>('ALL');

    const classOrder = ['Preschool 1', 'Preschool 2', 'Preschool 3', 'Class 1', 'Class 2', 'Class 3', 'Class 4'];
    const classesPresent = Array.from(new Set(FLN_LEVELS_LIST.map(l => l.class)))
      .sort((a, b) => classOrder.indexOf(a) - classOrder.indexOf(b));

    const filtered = FLN_LEVELS_LIST.filter(l => {
      if (classFilter !== 'ALL' && l.class !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return l.name.toLowerCase().includes(q) ||
               l.strand.toLowerCase().includes(q) ||
               String(l.id).includes(q);
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookMarked className="h-5 w-5" />
                FLN Level Content Library
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                All {FLN_LEVELS_LIST.length} FLN levels across {classesPresent.length} class groups.
                Click a card to open the level's worksheet template.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search level name or strand..."
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Classes ({FLN_LEVELS_LIST.length})</option>
                {classesPresent.map(c => (
                  <option key={c} value={c}>
                    {c} ({FLN_LEVELS_LIST.filter(l => l.class === c).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1 text-[10px] font-mono">
            {classOrder.filter(c => classesPresent.includes(c)).map(c => (
              <button
                key={c}
                onClick={() => setClassFilter(c)}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  classFilter === c
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                {c} · {FLN_LEVELS_LIST.filter(l => l.class === c).length}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-6">
            {filtered.map(level => (
              <div
                key={level.id}
                className="text-left border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-block text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Level {level.id}
                  </span>
                  <span className="text-[9px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {level.class}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug min-h-[2.5rem]">
                  {level.name}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {level.strand}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-12">
              No levels match your search.
            </div>
          )}

          {filtered.length > 0 && (
            <div className="mt-4 text-[10px] font-mono text-slate-400 dark:text-slate-500 text-right">
              Showing {filtered.length} of {FLN_LEVELS_LIST.length} levels
            </div>
          )}
        </div>
      </div>
    );
};
