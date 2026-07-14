import React, { useState } from 'react';
import { User, Intervention } from '../types';
import { ArrowLeft, ArrowUpCircle, CheckCircle2, Clock, Star, AlertCircle } from 'lucide-react';

interface InterventionDetailViewProps {
  intervention: Intervention;
  token: string;
  user: User;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Active', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  pending_review: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle }
};

const STRATEGY_LABELS: Record<string, string> = {
  small_group: 'Small Group Teaching',
  one_on_one: 'One-on-One Tutoring',
  peer_tutoring: 'Peer Tutoring',
  visual_aids: 'Visual Aids / Flashcards',
  manipulatives: 'Manipulatives / Hands-on',
  worksheets: 'Extra Worksheets',
  game_based: 'Game-Based Learning',
  other: 'Other Strategy'
};

export const InterventionDetailView: React.FC<InterventionDetailViewProps> = ({ intervention, token, user, onBack }) => {
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(intervention.isPromoted);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePromote = async () => {
    setPromoting(true);
    setError('');
    try {
      const res = await fetch(`/api/interventions/${intervention.id}/promote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPromoted(true);
        setSuccess('Intervention promoted to Best Practices Repository!');
      } else {
        setError(data.error || 'Failed to promote.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setPromoting(false);
    }
  };

  const statusCfg = STATUS_CONFIG[intervention.status];
  const StatusIcon = statusCfg.icon;
  const canPromote = user.role === 'teacher' && intervention.outcome?.improved && !promoted;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition">
        <ArrowLeft className="h-4 w-4" />
        Back to Interventions
      </button>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{intervention.studentName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{intervention.className} {intervention.section} — Level {intervention.currentLevel}</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Weak Competencies</h4>
              <div className="flex flex-wrap gap-1.5">
                {intervention.weakCompetencies.map(c => (
                  <span key={c} className="text-xs font-semibold bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">{c}</span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Strategy Type</h4>
              <p className="text-sm font-semibold text-slate-800">{STRATEGY_LABELS[intervention.strategyType]}</p>
            </div>

            <div>
              <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Duration</h4>
              <p className="text-sm font-semibold text-slate-800">{intervention.duration}</p>
            </div>

            <div>
              <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Start Date</h4>
              <p className="text-sm font-semibold text-slate-800">{new Date(intervention.startDate).toLocaleDateString()}</p>
            </div>

            {intervention.endDate && (
              <div>
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">End Date</h4>
                <p className="text-sm font-semibold text-slate-800">{new Date(intervention.endDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Strategy Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-150">{intervention.strategyDescription}</p>
            </div>

            <div>
              <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Recorded By</h4>
              <p className="text-sm font-semibold text-slate-800">{intervention.teacherName}</p>
            </div>
          </div>
        </div>

        {intervention.outcome && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-3">Outcome (Auto-Detected)</h4>
            <div className={`rounded-xl p-4 border ${intervention.outcome.improved ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {intervention.outcome.improved ? (
                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )}
                <span className={`text-sm font-bold ${intervention.outcome.improved ? 'text-green-800' : 'text-amber-800'}`}>
                  {intervention.outcome.improved ? 'Improvement Detected' : 'No Improvement Detected'}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-slate-600">
                  Level <strong>{intervention.outcome.previousLevel}</strong>
                </span>
                {intervention.outcome.improved && (
                  <>
                    <span className="text-green-600">→</span>
                    <span className="text-xs font-mono text-green-700 font-bold">
                      Level {intervention.outcome.newLevel}
                    </span>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      +{((intervention.outcome.newLevel || 0) - intervention.outcome.previousLevel)} levels
                    </span>
                  </>
                )}
              </div>
              {intervention.outcome.improvementDetails && (
                <p className="text-xs text-slate-600 leading-relaxed mt-2">{intervention.outcome.improvementDetails}</p>
              )}
              {intervention.outcome.detectedAt && (
                <p className="text-[10px] font-mono text-slate-400 mt-2">
                  Detected: {new Date(intervention.outcome.detectedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        {canPromote && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                    <Star className="h-4 w-4 text-indigo-500" />
                    Promote to Best Practices Repository
                  </h4>
                  <p className="text-xs text-indigo-600 mt-1">
                    Share this successful strategy with other teachers facing similar challenges.
                  </p>
                </div>
                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50 shrink-0"
                >
                  {promoting ? 'Promoting...' : 'Promote'}
                </button>
              </div>
            </div>
          </div>
        )}

        {promoted && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold">
              <Star className="h-4 w-4 text-indigo-500 fill-indigo-500" />
              This intervention is already in the Best Practices Repository
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
