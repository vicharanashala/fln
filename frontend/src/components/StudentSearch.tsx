import React, { useState, useRef, useEffect } from 'react';
import { Student, School } from '../types';
import { Search, X, User, ArrowRight } from 'lucide-react';

interface StudentSearchProps {
  token: string;
  onSelectStudent: (studentId: string) => void;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({ token, onSelectStudent }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/students', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setStudents(d); }).catch(() => {});
    fetch('/api/schools', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setSchools(d); }).catch(() => {});
  }, [token]);

  const filtered = query.trim().length >= 2
    ? students.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.id.toLowerCase().includes(query.toLowerCase()) ||
        s.classGroup.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isOpen && (document.activeElement as HTMLElement)?.tagName !== 'INPUT' && (document.activeElement as HTMLElement)?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSchoolName = (schoolId: string) => schools.find(s => s.id === schoolId)?.name || '';

  return (
    <div ref={wrapperRef} className="relative">
      {!isOpen ? (
        <button
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Search students...</span>
          <kbd className="ml-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 dark:text-slate-500 hidden md:inline">/</kbd>
        </button>
      ) : (
        <div className="w-72">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-indigo-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type name, ID, or class..."
              className="w-full rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 py-2 pl-9 pr-8 text-xs text-slate-900 dark:text-white outline-none ring-2 ring-indigo-100 dark:ring-indigo-900"
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {query.trim().length >= 2 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">No students found matching "{query}"</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map(s => {
                    const schoolName = getSchoolName(s.schoolId);
                    return (
                      <button
                        key={s.id}
                        onClick={() => { onSelectStudent(s.id); setIsOpen(false); setQuery(''); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors group"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 flex-wrap">
                            <span className="font-mono">{s.id}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span>{s.classGroup} - {s.section}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="font-mono font-bold">L{s.currentLevel}</span>
                            {schoolName && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="truncate">{schoolName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 text-center">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} &middot; Press <kbd className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-1 py-0.5 font-mono text-[9px]">Esc</kbd> to close
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
