import React, { useState, useEffect } from 'react';
import { User, Student, InterventionStrategyType } from '../types';
import { Input, Select, Textarea } from './Form';
import { X, AlertCircle } from 'lucide-react';

interface InterventionFormProps {
  user: User;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const STRATEGY_OPTIONS: { label: string; value: InterventionStrategyType }[] = [
  { label: 'Small Group Teaching', value: 'small_group' },
  { label: 'One-on-One Tutoring', value: 'one_on_one' },
  { label: 'Peer Tutoring', value: 'peer_tutoring' },
  { label: 'Visual Aids / Flashcards', value: 'visual_aids' },
  { label: 'Manipulatives / Hands-on', value: 'manipulatives' },
  { label: 'Extra Worksheets', value: 'worksheets' },
  { label: 'Game-Based Learning', value: 'game_based' },
  { label: 'Other Strategy', value: 'other' }
];

const DURATION_OPTIONS = [
  { label: '1 week', value: '1 week' },
  { label: '2 weeks', value: '2 weeks' },
  { label: '3 weeks', value: '3 weeks' },
  { label: '1 month', value: '1 month' },
  { label: '2 months', value: '2 months' },
  { label: 'Full term', value: 'Full term' }
];

const COMPETENCY_PRESETS = [
  'Number Sense', 'Addition', 'Subtraction', 'Multiplication', 'Division',
  'Place Value', 'Shapes', 'Patterns', 'Measurement', 'Fractions',
  'Money', 'Data Handling', 'Calendar & Time', 'Number Operations'
];

export const InterventionForm: React.FC<InterventionFormProps> = ({ user, token, onSuccess, onCancel }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [weakCompetencies, setWeakCompetencies] = useState<string[]>([]);
  const [customCompetency, setCustomCompetency] = useState('');
  const [strategyType, setStrategyType] = useState<InterventionStrategyType>('small_group');
  const [strategyDescription, setStrategyDescription] = useState('');
  const [duration, setDuration] = useState('2 weeks');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch('/api/students', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) setStudents(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStudents();
  }, [token]);

  const toggleCompetency = (c: string) => {
    setWeakCompetencies(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const addCustomCompetency = () => {
    if (customCompetency.trim() && !weakCompetencies.includes(customCompetency.trim())) {
      setWeakCompetencies(prev => [...prev, customCompetency.trim()]);
      setCustomCompetency('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedStudentId) { setError('Please select a student.'); return; }
    if (weakCompetencies.length === 0) { setError('Please select at least one weak competency.'); return; }
    if (!strategyDescription.trim()) { setError('Please describe the strategy used.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          weakCompetencies,
          strategyType,
          strategyDescription: strategyDescription.trim(),
          duration,
          startDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to record intervention.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans">Record Intervention</h2>
          <p className="text-xs text-slate-500 mt-0.5">Document the remedial action taken for a struggling student</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">Select Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 bg-white outline-none transition focus:border-indigo-650 focus:ring-1 focus:ring-indigo-600"
            >
              <option value="">— Choose a student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.classGroup} {s.section}) — Level {s.currentLevel}</option>
              ))}
            </select>
          </div>

          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {selectedStudent && (
          <div className="bg-slate-50 border border-slate-150 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">{selectedStudent.name}</strong> is currently at <strong className="text-indigo-700">Level {selectedStudent.currentLevel}</strong> in {selectedStudent.classGroup} {selectedStudent.section}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">Weak Competencies</label>
          <div className="flex flex-wrap gap-2">
            {COMPETENCY_PRESETS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCompetency(c)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                  weakCompetencies.includes(c)
                    ? 'bg-indigo-650 border-indigo-650 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={customCompetency}
              onChange={(e) => setCustomCompetency(e.target.value)}
              placeholder="Add custom competency..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCompetency())}
            />
            <button type="button" onClick={addCustomCompetency} className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
              Add
            </button>
          </div>
          {weakCompetencies.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {weakCompetencies.map(c => (
                <span key={c} className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                  {c}
                  <button type="button" onClick={() => toggleCompetency(c)} className="text-indigo-400 hover:text-indigo-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select
            label="Strategy Type"
            value={strategyType}
            onChange={(e) => setStrategyType(e.target.value as InterventionStrategyType)}
            options={STRATEGY_OPTIONS}
          />
          <Select
            label="Duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            options={DURATION_OPTIONS}
          />
        </div>

        <Textarea
          label="Strategy Description"
          value={strategyDescription}
          onChange={(e) => setStrategyDescription(e.target.value)}
          placeholder="Describe the remedial action in detail — what you did, how the student responded, any observations..."
          rows={4}
        />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Intervention'}
          </button>
        </div>
      </form>
    </div>
  );
};
