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
      <div className="animate-pulse rounded-[24px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/85">
        <div className="mb-4 h-3 w-1/3 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="mb-3 h-8 w-1/2 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="h-3 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between rounded-[24px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_24px_48px_-24px_rgba(79,70,229,0.35)] dark:border-slate-700/70 dark:bg-slate-900/85 dark:hover:border-indigo-800">
      <div className="min-w-0 flex-1 space-y-2">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-200 dark:text-slate-400">
          {title}
        </span>
        <span className="block text-2xl font-semibold tracking-tight text-slate-900 transition-colors duration-200 dark:text-white">
          {value}
        </span>
        {trend && (
          <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
            trend.type === 'positive'
              ? 'text-emerald-600 dark:text-emerald-400'
              : trend.type === 'negative'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            {trend.type === 'positive' ? '▲' : trend.type === 'negative' ? '▼' : '●'} {trend.value}
          </span>
        )}
        {subtext && !trend && (
          <span className="block text-sm leading-5 text-slate-500 transition-colors duration-200 dark:text-slate-400">
            {subtext}
          </span>
        )}
      </div>
      {Icon && (
        <div className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50/80 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-400 dark:group-hover:border-indigo-800 dark:group-hover:bg-indigo-950/40 dark:group-hover:text-indigo-400">
          <Icon className="h-4.5 w-4.5" />
        </div>
      )}
    </div>
  );
};
