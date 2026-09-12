// ==========================================
// SHARED PANEL PRESENTATIONAL COMPONENTS
// ==========================================
// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 1).
// PageHeader is used by all panel files, EmptyStudents by StudentListPanel.
import React from 'react';
import { Student } from '../../types';
import { Table, Column } from '../Table';
import { LevelBadge } from '../RoleDashboards';

export function PageHeader({ title, desc, icon }: { title: string; desc: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
      {icon && <div className="text-slate-500 dark:text-slate-400">{icon}</div>}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

export function EmptyStudents({ students, loading }: { students: Student[]; loading?: boolean }) {
  const cols: Column<Student>[] = [
    { header: 'ID', accessor: (s) => s.displayId || s.id, className: 'font-mono text-xs text-slate-400 dark:text-slate-500' },
    { header: 'Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-800 dark:text-slate-100' },
    { header: 'Class', accessor: 'classGroup', className: '' },
    { header: 'Level', accessor: (s) => <LevelBadge level={s.currentLevel} subLevel={s.currentSubLevel} />, className: 'font-mono' },
  ];
  return (
    <Table
      data={students}
      columns={cols}
      searchPlaceholder="Search students..."
      searchKey="name"
      loading={loading}
      emptyMessage="No students registered yet."
    />
  );
}
