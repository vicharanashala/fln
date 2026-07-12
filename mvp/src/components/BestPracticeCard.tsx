import React from 'react';
import { BestPractice } from '../types';
import { Star, ArrowUpCircle, Eye } from 'lucide-react';

interface BestPracticeCardProps {
  practice: BestPractice;
  onClick?: () => void;
}

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

export const BestPracticeCard: React.FC<BestPracticeCardProps> = ({ practice, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
            {practice.teacherName.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">{practice.teacherName}</p>
            <p className="text-[10px] font-mono text-slate-400">{new Date(practice.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
      </div>

      <div className="mb-3">
        <div className="flex flex-wrap gap-1 mb-2">
          {practice.weakCompetencies.map(c => (
            <span key={c} className="text-[10px] font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">{c}</span>
          ))}
        </div>
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{practice.strategyDescription}</p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {STRATEGY_LABELS[practice.strategyType] || practice.strategyType}
          </span>
          <span className="text-[10px] font-mono text-slate-400">{practice.duration}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
            <ArrowUpCircle className="h-3 w-3" />
            +{practice.levelJump} levels
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
            <Eye className="h-3 w-3" />
            {practice.viewCount}
          </span>
        </div>
      </div>
    </div>
  );
};
