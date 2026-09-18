import React, { useState } from 'react';
import { BookMarked, ArrowRight } from 'lucide-react';
import { FLN_LEVELS_LIST } from '../RoleDashboards';
import { LevelDetailModal } from '../LevelDetailModal';

export const ContentPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [strandFilter, setStrandFilter] = useState<string>('ALL');
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [showLevelDetail, setShowLevelDetail] = useState<boolean>(false);

  const classOrder = ['Preschool 1', 'Preschool 2', 'Preschool 3', 'Class 1', 'Class 2', 'Class 3', 'Class 4'];
  const classesPresent = Array.from(new Set(FLN_LEVELS_LIST.map(l => l.class)))
    .sort((a, b) => classOrder.indexOf(a) - classOrder.indexOf(b));

  const strandsPresent = Array.from(new Set(FLN_LEVELS_LIST.map(l => l.strand))).sort();

  const filtered = FLN_LEVELS_LIST.filter(l => {
    if (classFilter !== 'ALL' && l.class !== classFilter) return false;
    if (strandFilter !== 'ALL' && l.strand !== strandFilter) return false;
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
              <BookMarked className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              FLN Level & Curriculum Explorer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Explore all {FLN_LEVELS_LIST.length} FLN levels across {classesPresent.length} class groups.
              Click any level card to inspect learning objectives, sub-levels, and live question bank items.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search level name, strand, or ID..."
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
            <select
              value={strandFilter}
              onChange={(e) => setStrandFilter(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Strands ({strandsPresent.length})</option>
              {strandsPresent.map(s => (
                <option key={s} value={s}>
                  {s} ({FLN_LEVELS_LIST.filter(l => l.strand === s).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 text-[10px] font-mono">
          <button
            onClick={() => { setClassFilter('ALL'); setStrandFilter('ALL'); }}
            className={`px-2.5 py-1 rounded-full border transition-colors ${
              classFilter === 'ALL' && strandFilter === 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
            }`}
          >
            All Levels ({FLN_LEVELS_LIST.length})
          </button>
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
            <button
              key={level.id}
              onClick={() => {
                setSelectedLevelId(level.id);
                setShowLevelDetail(true);
              }}
              className="group text-left border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-block text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 uppercase tracking-wider">
                    Level {level.id}
                  </span>
                  <span className="text-[9px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {level.class}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-900 dark:group-hover:text-indigo-200 leading-snug min-h-[2.5rem]">
                  {level.name}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[70%]">
                  {level.strand}
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  Inspect <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-12">
            No levels match your search or filter criteria.
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-4 text-[10px] font-mono text-slate-400 dark:text-slate-500 text-right">
            Showing {filtered.length} of {FLN_LEVELS_LIST.length} levels (Click any card to inspect)
          </div>
        )}
      </div>

      {/* Level Detail Modal Dialog */}
      <LevelDetailModal
        isOpen={showLevelDetail}
        onClose={() => setShowLevelDetail(false)}
        levelId={selectedLevelId}
      />
    </div>
  );
};
