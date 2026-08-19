import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    type: 'positive' | 'negative' | 'neutral';
  };
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm animate-pulse space-y-3">
        <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-7 w-1/2 bg-slate-300 dark:bg-slate-600 rounded" />
        <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-200 flex justify-between items-start group">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">{title}</span>
        <span className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-white block group-hover:text-indigo-650 transition duration-150">{value}</span>
        {trend && (
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wide inline-flex items-center gap-1 mt-1 ${
            trend.type === 'positive'
              ? 'text-emerald-600'
              : trend.type === 'negative'
              ? 'text-rose-600'
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            {trend.type === 'positive' ? '▲' : trend.type === 'negative' ? '▼' : '●'} {trend.value}
          </span>
        )}
        {subtext && !trend && (
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-sans">{subtext}</span>
        )}
      </div>
      {Icon && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:border-indigo-100 dark:group-hover:border-indigo-800 transition duration-200">
          <Icon className="h-5 w-5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition duration-200" />
        </div>
      )}
    </div>
  );
};
