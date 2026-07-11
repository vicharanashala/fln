/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: 'indigo' | 'green' | 'amber' | 'red' | 'blue' | 'orange';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'indigo'
}) => {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <ArrowUpRight className="h-3 w-3 text-emerald-500" />;
    if (trend === 'down') return <ArrowDownRight className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const getTrendClass = () => {
    if (trend === 'up') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30';
    if (trend === 'down') return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
    return 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900';
  };

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </span>
        <div className={`rounded-lg p-2.5 ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      
      <div className="mt-4">
        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {value}
        </h3>
        
        {trend && trendLabel && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${getTrendClass()}`}>
              {getTrendIcon()}
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
              {trendLabel.split(' ')[0]}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {trendLabel.substring(trendLabel.indexOf(' ') + 1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
