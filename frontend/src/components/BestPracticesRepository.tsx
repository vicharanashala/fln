import React, { useState, useEffect } from 'react';
import { User, BestPractice } from '../types';
import { BestPracticeCard } from './BestPracticeCard';
import { Search, Filter, ArrowUpDown, Star, BookOpen, X } from 'lucide-react';

interface BestPracticesRepositoryProps {
  user: User;
  token: string;
}

const COMPETENCY_OPTIONS = [
  'All', 'Number Sense', 'Addition', 'Subtraction', 'Multiplication', 'Division',
  'Place Value', 'Shapes', 'Patterns', 'Measurement', 'Fractions',
  'Money', 'Data Handling', 'Calendar & Time', 'Number Operations'
];

const STRATEGY_OPTIONS = [
  { label: 'All Strategies', value: 'all' },
  { label: 'Small Group', value: 'small_group' },
  { label: 'One-on-One', value: 'one_on_one' },
  { label: 'Peer Tutoring', value: 'peer_tutoring' },
  { label: 'Visual Aids', value: 'visual_aids' },
  { label: 'Manipulatives', value: 'manipulatives' },
  { label: 'Worksheets', value: 'worksheets' },
  { label: 'Game-Based', value: 'game_based' }
];

export const BestPracticesRepository: React.FC<BestPracticesRepositoryProps> = ({ user, token }) => {
  const [practices, setPractices] = useState<BestPractice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [competencyFilter, setCompetencyFilter] = useState('All');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'level_jump'>('recent');
  const [selectedPractice, setSelectedPractice] = useState<BestPractice | null>(null);

  const fetchPractices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (competencyFilter !== 'All') params.set('competency', competencyFilter);
      if (strategyFilter !== 'all') params.set('strategy', strategyFilter);
      params.set('sort', sortBy);

      const res = await fetch(`/api/best-practices?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setPractices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPractices();
  }, [token, competencyFilter, strategyFilter, sortBy]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchPractices(), 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleViewPractice = async (bp: BestPractice) => {
    try {
      await fetch(`/api/best-practices/${bp.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch {}
    setSelectedPractice(bp);
  };

  if (selectedPractice) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedPractice(null)} className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition">
          <X className="h-4 w-4" />
          Back to Repository
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Star className="h-5 w-5 text-indigo-600 fill-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Best Practice</h2>
              <p className="text-xs text-slate-500">by {selectedPractice.teacherName} — {new Date(selectedPractice.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Weak Competencies Addressed</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPractice.weakCompetencies.map(c => (
                    <span key={c} className="text-xs font-semibold bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">{c}</span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Strategy Description</h4>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-150">{selectedPractice.strategyDescription}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="text-[10px] font-mono font-bold text-green-600 uppercase mb-2">Impact</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600">Level {selectedPractice.levelBefore}</span>
                  <span className="text-green-600 font-bold">→</span>
                  <span className="text-sm font-bold text-green-800">Level {selectedPractice.levelAfter}</span>
                </div>
                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mt-2 inline-block">
                  +{selectedPractice.levelJump} level jump
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Strategy</span>
                  <span className="font-semibold text-slate-800 capitalize">{selectedPractice.strategyType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold text-slate-800">{selectedPractice.duration}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Views</span>
                  <span className="font-semibold text-slate-800">{selectedPractice.viewCount}</span>
                </div>
              </div>

              {selectedPractice.tags.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedPractice.tags.map(t => (
                      <span key={t} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Best Practices Repository</h2>
            <p className="text-xs text-slate-500">Proven teaching strategies from teachers across the network</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search strategies, competencies..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={competencyFilter}
            onChange={(e) => setCompetencyFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500"
          >
            {COMPETENCY_OPTIONS.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Competencies' : c}</option>
            ))}
          </select>

          <select
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500"
          >
            {STRATEGY_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setSortBy('recent')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              sortBy === 'recent' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Most Recent
          </button>
          <button
            onClick={() => setSortBy('level_jump')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${
              sortBy === 'level_jump' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ArrowUpDown className="h-3 w-3" />
            Highest Impact
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center">
          <div className="text-xs font-mono text-slate-400">Loading best practices...</div>
        </div>
      ) : practices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center">
          <Star className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">No best practices found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {practices.map(bp => (
            <BestPracticeCard key={bp.id} practice={bp} onClick={() => handleViewPractice(bp)} />
          ))}
        </div>
      )}
    </div>
  );
};
