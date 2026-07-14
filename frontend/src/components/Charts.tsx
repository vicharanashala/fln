/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Award, TrendingUp, AlertTriangle } from 'lucide-react';

interface BarChartProps {
  data: { label: string; value: number; secondary?: number; key?: string }[];
  onBarClick?: (key: string) => void;
  title: string;
  yAxisLabel?: string;
}

export const StatePerformanceBarChart: React.FC<BarChartProps> = ({
  data,
  onBarClick,
  title,
  yAxisLabel = '%'
}) => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const maxValue = 100;
  const chartHeight = 180;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h4>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {onBarClick ? 'Click bars to drill-down into district rankings' : 'Visual performance summary'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          <Award className="h-4 w-4" />
          <span>Average Score</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative mt-6">
        <div className="flex h-[200px] items-end justify-between gap-2 px-2 pb-6">
          {data.map((item, idx) => {
            const heightPercentage = item.value / maxValue;
            const barHeight = heightPercentage * chartHeight;
            const isCritical = item.value < 40;

            return (
              <div
                key={item.label}
                className="group relative flex flex-1 flex-col items-center cursor-pointer"
                onClick={() => onBarClick && onBarClick(item.key || item.label)}
                onMouseEnter={() => setHoveredBar(idx)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {/* Hover Tooltip */}
                {hoveredBar === idx && (
                  <div className="absolute bottom-[calc(100%+8px)] z-10 rounded-lg bg-gray-900 px-2.5 py-1.5 text-center text-[11px] font-bold text-white shadow-lg dark:bg-gray-950">
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-indigo-400 text-xs">{item.value}% Certification</p>
                    {item.secondary !== undefined && (
                      <p className="text-[10px] text-gray-400">{item.secondary} Districts</p>
                    )}
                  </div>
                )}

                {/* Animated bar */}
                <div className="relative w-full overflow-hidden rounded-t-md bg-gray-50 dark:bg-gray-800/40" style={{ height: chartHeight }}>
                  <motion.div
                    className={`absolute bottom-0 w-full rounded-t-md transition-colors duration-150 ${
                      isCritical
                        ? 'bg-red-500 dark:bg-red-600'
                        : item.value >= 60
                        ? 'bg-indigo-600 dark:bg-indigo-500'
                        : 'bg-amber-500'
                    } group-hover:opacity-90`}
                    initial={{ height: 0 }}
                    animate={{ height: barHeight }}
                    transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                  />
                  
                  {/* Subtle target line overlay */}
                  <div className="absolute top-[40%] left-0 w-full border-t border-dashed border-gray-300 dark:border-gray-700 pointer-events-none opacity-40" title="Target benchmark: 60%" />
                </div>

                {/* Label */}
                <span className="mt-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 line-clamp-1 max-w-[50px] text-center">
                  {item.label}
                </span>

                {/* Performance score text indicator */}
                <span className={`mt-0.5 text-[10px] font-bold ${isCritical ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {item.value}%
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Y-Axis Guideline Tags */}
        <div className="absolute left-0 bottom-6 flex flex-col justify-between text-[9px] text-gray-400 h-[180px] pointer-events-none pl-1 border-l border-gray-100 dark:border-gray-800">
          <span>100%</span>
          <span>60% (Target)</span>
          <span>40% (Critical)</span>
          <span>0%</span>
        </div>
      </div>
    </div>
  );
};

interface LineChartProps {
  data: { label: string; value: number }[];
  title: string;
}

export const TrendLineChart: React.FC<LineChartProps> = ({ data, title }) => {
  const maxValue = 100;
  const width = 500;
  const height = 180;
  const padding = 25;

  const points = data.map((item, idx) => {
    const x = padding + (idx * (width - padding * 2)) / (data.length - 1 || 1);
    const y = height - padding - (item.value / maxValue) * (height - padding * 2);
    return { x, y, label: item.label, value: item.value };
  });

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h4>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Progress across 3 fixed national cycles
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-4 w-4" />
          <span>Improving Trend</span>
        </div>
      </div>

      <div className="relative mt-4 flex justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px]">
          {/* Grids */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#E5E7EB" className="dark:stroke-gray-800" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#E5E7EB" className="dark:stroke-gray-800" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E5E7EB" className="dark:stroke-gray-800" />

          {/* Area under curve */}
          <motion.path
            d={areaD}
            fill="url(#gradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            transition={{ duration: 0.8 }}
          />

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Core trend line path */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="#4F46E5"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />

          {/* Interactive dots */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <motion.circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="#4F46E5"
                stroke="#FFF"
                strokeWidth="2"
                whileHover={{ r: 8 }}
              />
              {/* Tooltip labels inside SVG */}
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                className="hidden group-hover:block fill-gray-900 dark:fill-white text-[10px] font-bold"
              >
                {p.value}%
              </text>
              <text
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-gray-400 dark:fill-gray-500 text-[10px] font-semibold"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  title: string;
}

export const DonutPieChart: React.FC<PieChartProps> = ({ data, title }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let accumulatedAngle = 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h4 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 pb-3 dark:border-gray-800">{title}</h4>

      <div className="mt-5 flex flex-col items-center justify-around gap-4 sm:flex-row">
        {/* SVG Donut */}
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
            {/* Gray background track */}
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F3F4F6" className="dark:stroke-gray-800" strokeWidth="4" />

            {data.map((slice, idx) => {
              if (slice.value === 0) return null;
              const percentage = (slice.value / total) * 100;
              const offset = 100 - accumulatedAngle;
              accumulatedAngle += percentage;

              return (
                <circle
                  key={idx}
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="4"
                  strokeDasharray={`${percentage} ${100 - percentage}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          {/* Centered overall metric text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-extrabold text-gray-900 dark:text-white">{total}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2">
          {data.map((slice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {slice.label}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {slice.value} ({total > 0 ? Math.round((slice.value / total) * 100) : 0}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
