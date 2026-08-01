/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiFetch } from '../services/apiClient';
import React, { useEffect, useState } from 'react';
import { X, Flame, CheckCircle2, XCircle, PartyPopper, Loader2, RotateCcw } from 'lucide-react';
import { Question } from '../types';

interface PracticeModeProps {
  studentId: string;
  studentName: string;
  token: string;
  /** Optional weak-area topic (from the Recommended Focus Areas panel) to target the session. */
  topic?: string;
  onClose: () => void;
}

interface PracticeSet {
  studentId: string;
  studentName: string;
  level: number;
  subLevel: number;
  streak: number;
  questions: Question[];
}

type AnswerState = 'unanswered' | 'correct' | 'incorrect';

// Normalizes text/number answers before comparing so "12", " 12 ", "twelve"-vs-"12"
// style formatting differences don't register a right answer as wrong.
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export const PracticeMode: React.FC<PracticeModeProps> = ({ studentId, studentName, token, topic, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [set, setSet] = useState<PracticeSet | null>(null);

  const [qIndex, setQIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
  const [sessionStreak, setSessionStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const loadSet = () => {
    setLoading(true);
    setError(null);
    setFinished(false);
    setQIndex(0);
    setSessionStreak(0);
    setCorrectCount(0);
    setAnswerState('unanswered');
    setInputValue('');

    const query = topic ? `?topic=${encodeURIComponent(topic)}` : '';
    apiFetch(`/api/students/${studentId}/practice${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load practice set.');
        return r.json();
      })
      .then((data: PracticeSet) => setSet(data))
      .catch(() => setError('Could not load a practice set right now. Please try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, topic]);

  if (loading) {
    return (
      <PracticeOverlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Preparing practice questions…</p>
        </div>
      </PracticeOverlay>
    );
  }

  if (error || !set || set.questions.length === 0) {
    return (
      <PracticeOverlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
          <XCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">{error || 'No practice questions available for this level yet.'}</p>
          <button
            onClick={loadSet}
            className="flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </PracticeOverlay>
    );
  }

  const question = set.questions[qIndex];
  const isLast = qIndex === set.questions.length - 1;

  const checkAnswer = () => {
    if (answerState !== 'unanswered' || !inputValue) return;
    const isCorrect = normalize(inputValue) === normalize(question.answer);
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setSessionStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setSessionStreak(0);
    }
  };

  const selectChoice = (choice: string) => {
    if (answerState !== 'unanswered') return;
    setInputValue(choice);
    const isCorrect = normalize(choice) === normalize(question.answer);
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setSessionStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setSessionStreak(0);
    }
  };

  const next = () => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setQIndex((i) => i + 1);
    setInputValue('');
    setAnswerState('unanswered');
  };

  if (finished) {
    return (
      <PracticeOverlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-14 gap-4 text-center px-6">
          <PartyPopper className="h-12 w-12 text-amber-500" />
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Session complete!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {studentName} got <span className="font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</span> out of{' '}
            {set.questions.length} correct, with a best streak of{' '}
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400">
              {bestStreak} <Flame className="h-3.5 w-3.5" />
            </span>
            .
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={loadSet}
              className="flex items-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Practice again
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </PracticeOverlay>
    );
  }

  return (
    <PracticeOverlay onClose={onClose}>
      {/* Header: level badge + live streak */}
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {studentName} · Level {set.level}.{set.subLevel}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Question {qIndex + 1} of {set.questions.length}
            {question.topic ? ` · ${question.topic}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5">
          <Flame className={`h-4 w-4 ${sessionStreak > 0 ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`} />
          <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">{sessionStreak}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 mt-3">
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all"
            style={{ width: `${((qIndex + (answerState !== 'unanswered' ? 1 : 0)) / set.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question body */}
      <div className="px-6 py-8">
        <p className="text-center text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          {question.question}
        </p>

        {question.answer_type === 'choice' && question.choices ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {question.choices.map((choice) => {
              const isSelected = inputValue === choice;
              const isRightChoice = answerState !== 'unanswered' && normalize(choice) === normalize(question.answer);
              return (
                <button
                  key={choice}
                  onClick={() => selectChoice(choice)}
                  disabled={answerState !== 'unanswered'}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                    isRightChoice
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : isSelected
                      ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3">
            <input
              type={question.answer_type === 'number' ? 'number' : 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
              disabled={answerState !== 'unanswered'}
              className={`w-40 rounded-lg border-2 px-3.5 py-2.5 text-center text-lg font-bold focus:outline-none ${
                answerState === 'correct'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : answerState === 'incorrect'
                  ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-600'
              }`}
              autoFocus
            />
            {answerState === 'unanswered' && (
              <button
                onClick={checkAnswer}
                disabled={!inputValue}
                className="rounded-lg bg-indigo-700 px-6 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-40"
              >
                Check
              </button>
            )}
          </div>
        )}

        {answerState !== 'unanswered' && (
          <div
            className={`mt-5 flex items-center justify-center gap-2 text-sm font-bold ${
              answerState === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {answerState === 'correct' ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Correct!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" /> Not quite — the answer was {question.answer}
              </>
            )}
          </div>
        )}
      </div>

      {answerState !== 'unanswered' && (
        <div className="px-6 pb-6">
          <button
            onClick={next}
            className="w-full rounded-lg bg-indigo-700 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600"
          >
            {isLast ? 'Finish session' : 'Next question →'}
          </button>
        </div>
      )}
    </PracticeOverlay>
  );
};

const PracticeOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
    <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500"
        aria-label="Close practice session"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </div>
  </div>
);
