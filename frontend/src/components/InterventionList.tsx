import React, { useState, useEffect } from 'react';
import { User, Intervention } from '../types';
import { Table, Column } from './Table';
import { CheckCircle2, Clock, AlertCircle, ArrowUpCircle } from 'lucide-react';

interface InterventionListProps {
  user: User;
  token: string;
  onSelectIntervention: (intervention: Intervention) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Active', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  pending_review: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle }
};

const STRATEGY_LABELS: Record<string, string> = {
  small_group: 'Small Group',
  one_on_one: 'One-on-One',
  peer_tutoring: 'Peer Tutoring',
  visual_aids: 'Visual Aids',
  manipulatives: 'Manipulatives',
  worksheets: 'Worksheets',
  game_based: 'Game-Based',
  other: 'Other'
};

export const InterventionList: React.FC<InterventionListProps> = ({ user, token, onSelectIntervention }) => {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInterventions = async () => {
      try {
        const res = await fetch('/api/interventions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) setInterventions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInterventions();
  }, [token]);

  const columns: Column<Intervention>[] = [
    {
      header: 'Student',
      accessor: 'studentName',
      sortKey: 'studentName' as keyof Intervention,
      className: 'font-medium text-slate-900'
    },
    {
      header: 'Class',
      accessor: (row) => `${row.className} ${row.section}`,
      className: 'text-xs text-slate-500'
    },
    {
      header: 'Weak Areas',
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.weakCompetencies.slice(0, 3).map(c => (
            <span key={c} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{c}</span>
          ))}
          {row.weakCompetencies.length > 3 && (
            <span className="text-[10px] font-mono text-slate-400">+{row.weakCompetencies.length - 3}</span>
          )}
        </div>
      )
    },
    {
      header: 'Strategy',
      accessor: (row) => (
        <span className="text-xs font-semibold text-slate-700">{STRATEGY_LABELS[row.strategyType] || row.strategyType}</span>
      ),
      sortKey: 'strategyType' as keyof Intervention
    },
    {
      header: 'Status',
      accessor: (row) => {
        const cfg = STATUS_CONFIG[row.status];
        const Icon = cfg.icon;
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${cfg.color}`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
        );
      },
      sortKey: 'status' as keyof Intervention,
      filterKey: 'status' as keyof Intervention,
      filterOptions: ['active', 'completed', 'pending_review']
    },
    {
      header: 'Outcome',
      accessor: (row) => {
        if (!row.outcome) return <span className="text-[10px] text-slate-400 font-mono">—</span>;
        if (row.outcome.improved) {
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
              <ArrowUpCircle className="h-3 w-3" />
              Level {row.outcome.previousLevel} → {row.outcome.newLevel}
            </span>
          );
        }
        return <span className="text-[10px] font-semibold text-amber-600">No change</span>;
      }
    },
    {
      header: 'Best Practice',
      accessor: (row) => row.isPromoted ? (
        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Promoted</span>
      ) : (
        <span className="text-[10px] text-slate-400">—</span>
      )
    }
  ];

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
        <div className="text-xs font-mono text-slate-400">Loading interventions...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Intervention Records</h3>
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{interventions.length} total interventions</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">
            {interventions.filter(i => i.status === 'active').length} active
          </span>
          <span className="text-[10px] font-mono bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200">
            {interventions.filter(i => i.status === 'completed').length} completed
          </span>
        </div>
      </div>
      <Table
        data={interventions}
        columns={columns}
        searchKey="studentName"
        emptyMessage="No interventions recorded yet."
      />
    </div>
  );
};
