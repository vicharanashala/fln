import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import {
  X,
  BookOpen,
  Layers,
  HelpCircle,
  Eye,
  EyeOff,
  CheckCircle,
  Target,
  Sparkles,
  Search,
  Filter,
  GraduationCap,
  Calendar,
  Compass,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

interface SubLevelInfo {
  subLevel: number;
  title: string;
  content: string;
}

interface LevelDetailPayload {
  levelNumber: number;
  levelTitle: string;
  stage: number;
  classGroup: string;
  ageGroup: string;
  strand: string;
  conceptId: string;
  objective: string;
  description: string;
  learningOutcome: string;
  topicsCovered: string[];
  subLevels: SubLevelInfo[];
  questionCount: number;
}

interface QuestionItem {
  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml?: string;
}

interface LevelDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  levelId: number | null;
}

export const LevelDetailModal: React.FC<LevelDetailModalProps> = ({
  isOpen,
  onClose,
  levelId,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sublevels' | 'questions'>('overview');
  const [levelData, setLevelData] = useState<LevelDetailPayload | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [revealAll, setRevealAll] = useState<boolean>(false);
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [questionSearch, setQuestionSearch] = useState<string>('');

  useEffect(() => {
    if (!isOpen || levelId === null) {
      setLevelData(null);
      setQuestions([]);
      setRevealedAnswers({});
      setRevealAll(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);
    setActiveTab('overview');

    const fetchDetails = async () => {
      try {
        const [lvlRes, qRes] = await Promise.all([
          apiFetch(`/api/content/levels/${levelId}`),
          apiFetch(`/api/content/levels/${levelId}/questions`),
        ]);

        if (isCancelled) return;

        if (lvlRes.ok) {
          const lvlData = await lvlRes.json();
          setLevelData(lvlData);
        } else {
          setError(`Could not load details for Level ${levelId}.`);
        }

        if (qRes.ok) {
          const qData = await qRes.json();
          setQuestions(qData.questions || []);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to fetch level details.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, levelId]);

  if (!isOpen || levelId === null) return null;

  const toggleAnswer = (qNum: number) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [qNum]: !prev[qNum],
    }));
  };

  const toggleAllAnswers = () => {
    const nextState = !revealAll;
    setRevealAll(nextState);
    const updated: Record<number, boolean> = {};
    questions.forEach(q => {
      updated[q.questionNumber] = nextState;
    });
    setRevealedAnswers(updated);
  };

  const strandColors: Record<string, { badge: string; border: string; bg: string }> = {
    'Number Sense': { badge: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', border: 'border-indigo-500', bg: 'from-indigo-600 to-blue-600' },
    'Number Operations': { badge: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', border: 'border-emerald-500', bg: 'from-emerald-600 to-teal-600' },
    'Shapes & Spatial': { badge: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', border: 'border-amber-500', bg: 'from-amber-600 to-orange-600' },
    'Patterns': { badge: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800', border: 'border-purple-500', bg: 'from-purple-600 to-pink-600' },
    'Measurement': { badge: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800', border: 'border-cyan-500', bg: 'from-cyan-600 to-blue-600' },
    'Data Handling': { badge: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', border: 'border-rose-500', bg: 'from-rose-600 to-red-600' },
    'Pre-Number Foundations': { badge: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', border: 'border-blue-500', bg: 'from-blue-600 to-indigo-600' },
  };

  const defaultTheme = { badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', border: 'border-slate-500', bg: 'from-slate-700 to-slate-900' };
  const currentTheme = (levelData && strandColors[levelData.strand]) || defaultTheme;

  const filteredQuestions = questions.filter(q => {
    if (sectionFilter !== 'ALL') {
      if (sectionFilter === 'mastery' && q.sectionType !== 'mastery') return false;
      if (sectionFilter === 'remediation' && q.sectionType !== 'remediation') return false;
    }
    if (questionSearch) {
      const query = questionSearch.toLowerCase();
      return (
        q.questionText.toLowerCase().includes(query) ||
        q.answer.toLowerCase().includes(query) ||
        String(q.questionNumber).includes(query)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className={`p-6 bg-gradient-to-r ${currentTheme.bg} text-white flex items-start justify-between relative`}>
          <div className="space-y-1.5 pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-black uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-white border border-white/30">
                Level {levelId}
              </span>
              {levelData && (
                <>
                  <span className="text-xs font-mono bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded text-white/90">
                    {levelData.classGroup} (Age {levelData.ageGroup})
                  </span>
                  <span className="text-xs font-mono bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded text-white/90">
                    Concept ID: {levelData.conceptId}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              {levelData?.levelTitle || `FLN Level ${levelId}`}
            </h2>
            {levelData && (
              <p className="text-xs text-white/80 font-medium">
                Strand: <span className="font-semibold text-white">{levelData.strand}</span> · Questions Bank: <span className="font-semibold text-white">{levelData.questionCount} Available</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Curriculum & Overview
          </button>
          <button
            onClick={() => setActiveTab('sublevels')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'sublevels'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Sub-Levels ({levelData?.subLevels.length || 3})
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'questions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Question Bank ({questions.length})
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-mono">Loading curriculum specification and question bank...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
              {error}
            </div>
          )}

          {!loading && levelData && activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Objective Card */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs font-mono uppercase tracking-wider">
                  <Target className="w-4 h-4" />
                  Primary Learning Objective
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                  {levelData.objective}
                </p>
              </div>

              {/* Description & Learning Outcome Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-xs font-mono uppercase tracking-wider">
                    <Compass className="w-4 h-4 text-indigo-500" />
                    Pedagogical Description
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {levelData.description}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    Target Learning Outcome
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {levelData.learningOutcome}
                  </p>
                </div>
              </div>

              {/* Topics Covered */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-xs font-mono uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Curriculum Topics & Competency Coverage
                </div>
                <div className="flex flex-wrap gap-2">
                  {levelData.topicsCovered.map((topic, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && levelData && activeTab === 'sublevels' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                FLN utilizes a 3-tier sub-level progression for mastery, targeted remediation, and foundational support:
              </div>
              <div className="grid grid-cols-1 gap-4">
                {levelData.subLevels.map(sub => (
                  <div
                    key={sub.subLevel}
                    className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
                          sub.subLevel === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : sub.subLevel === 1
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          Level {levelData.levelNumber}.{sub.subLevel}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {sub.title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {sub.subLevel === 0 ? 'Mastery Tier' : sub.subLevel === 1 ? 'Guided Remediation' : 'Foundational Support'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-lg border border-slate-100 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {sub.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && activeTab === 'questions' && (
            <div className="space-y-4">
              {/* Question Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={questionSearch}
                      onChange={e => setQuestionSearch(e.target.value)}
                      placeholder="Search questions or answer values..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                  <select
                    value={sectionFilter}
                    onChange={e => setSectionFilter(e.target.value)}
                    className="py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="ALL">All Sections</option>
                    <option value="mastery">Mastery</option>
                    <option value="remediation">Remediation</option>
                  </select>
                </div>
                <button
                  onClick={toggleAllAnswers}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors shrink-0"
                >
                  {revealAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {revealAll ? 'Hide All Answers' : 'Reveal All Answers'}
                </button>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  No questions found matching your filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredQuestions.map(q => {
                    const isRevealed = revealedAnswers[q.questionNumber] || revealAll;
                    return (
                      <div
                        key={q.questionNumber}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold font-mono text-xs shadow-sm">
                              Q{q.questionNumber}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              q.sectionType === 'mastery'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            }`}>
                              {q.section || q.sectionType}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleAnswer(q.questionNumber)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {isRevealed ? 'Hide Answer' : 'Check Answer Key'}
                          </button>
                        </div>

                        {/* Question Text */}
                        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                          {q.questionText}
                        </div>

                        {/* SVG Diagram / Visual Question Preview */}
                        {q.svgHtml && (
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-x-auto">
                            <div
                              className="max-w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                              dangerouslySetInnerHTML={{ __html: q.svgHtml }}
                            />
                          </div>
                        )}

                        {/* Expandable Answer Key Box */}
                        {isRevealed && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between animate-fade-in">
                            <div className="flex items-center gap-2 text-xs">
                              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="font-bold text-emerald-800 dark:text-emerald-200">Expected Answer:</span>
                              <span className="font-mono font-bold text-emerald-900 dark:text-emerald-100 bg-white dark:bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                                {q.answer}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              Auto-graded ICR Key
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center text-xs">
          <div className="text-slate-500 font-mono text-[11px]">
            National Foundational Numeracy Curriculum Framework
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
