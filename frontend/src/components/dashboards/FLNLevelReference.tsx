//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState } from 'react';
import { LEVEL_SKILL_MAP, CORE_SKILLS, stageLabel } from '../../data/skillProgressionMap';

// Issue #570: derive the levels list from LEVEL_SKILL_MAP so it stays in
// sync with the curriculum automatically (was a hardcoded 93-entry array).
function domainForLevel(level: typeof LEVEL_SKILL_MAP[number]): string {
  const firstSkillId = level.primarySkills[0];
  const skill = CORE_SKILLS.find(s => s.id === firstSkillId);
  return skill?.domain ?? 'Cross-cutting';
}

export const FLN_LEVELS_LIST = LEVEL_SKILL_MAP.map(level => ({
  id: level.levelNumber,
  class: stageLabel(level.stage),
  name: level.capability,
  strand: domainForLevel(level),
}));

export const FLNLevelReferenceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');

  if (!isOpen) return null;

  const classesList = ['All', ...Array.from(new Set(FLN_LEVELS_LIST.map((level) => level.class)))];

  const filtered = FLN_LEVELS_LIST.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.strand.toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClass === 'All' || l.class === selectedClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">📖 FLN Levels Framework Reference</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Explore details of the {FLN_LEVELS_LIST.length} curriculum levels spanning Preschool 1 to Class 4</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-650 text-sm font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 p-2 rounded-lg">Close</button>
        </div>

        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900">
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Search Level/Strand</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Addition, shapes, numbers..."
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Filter by Class</label>
            <div className="flex flex-wrap gap-1">
              {classesList.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`text-[10px] font-mono font-semibold px-2 py-1.5 rounded border transition-colors ${selectedClass === c ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <div key={l.id} className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-sm hover:border-zinc-350 dark:hover:border-zinc-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      Level {l.id}
                    </span>
                    <span className="text-[9px] font-mono font-semibold uppercase text-zinc-400 dark:text-zinc-500">
                      {l.class}
                    </span>
                  </div>
                  <h4 className="font-display font-semibold text-zinc-900 dark:text-white text-sm mt-2">{l.name}</h4>
                </div>
                <div className="mt-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                  <span>Strand: <strong className="text-zinc-700 dark:text-zinc-200">{l.strand}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
