import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { Question } from '../types';

type PracticeQuestion = Omit<Question, 'answer'>;
type PracticeSession = {
  id: string;
  studentId: string;
  studentName: string;
  level: number;
  subLevel: number;
  topic?: string;
  questions: PracticeQuestion[];
};
type AnswerState = 'unanswered' | 'correct' | 'incorrect';

type PracticeModeProps = {
  studentId: string;
  studentName: string;
  topic?: string;
  onClose: () => void;
};

export const PracticeMode: React.FC<PracticeModeProps> = ({ studentId, studentName, topic, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
  const [submitting, setSubmitting] = useState(false);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    setFinished(false);
    setQuestionIndex(0);
    setInputValue('');
    setAnswerState('unanswered');
    setSessionStreak(0);
    setBestStreak(0);
    setCorrectCount(0);
    try {
      const response = await apiFetch(`/api/students/${studentId}/practice-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topic ? { topic } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load a practice session.');
      }
      setSession(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load a practice session right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
    // Reload only when opening practice for a different child or focus area.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, topic]);

  const submitAnswer = async (answer: string) => {
    const question = session?.questions[questionIndex];
    if (!session || !question || answerState !== 'unanswered' || submitting || answer.trim() === '') return;

    setSubmitting(true);
    try {
      const response = await apiFetch(`/api/students/${studentId}/practice-sessions/${session.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.question_id, answer }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not check that answer.');
      }
      const result: { correct: boolean } = await response.json();
      setAnswerState(result.correct ? 'correct' : 'incorrect');
      if (result.correct) {
        setCorrectCount(count => count + 1);
        setSessionStreak(streak => {
          const next = streak + 1;
          setBestStreak(best => Math.max(best, next));
          return next;
        });
      } else {
        setSessionStreak(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check that answer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PracticeOverlay onClose={onClose}><LoadingState /></PracticeOverlay>;
  }

  if (error && !session) {
    return (
      <PracticeOverlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <span className="text-4xl font-bold text-red-500" aria-hidden="true">×</span>
          <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
          <button onClick={() => void loadSession()} className="flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
            ↻ Try again
          </button>
        </div>
      </PracticeOverlay>
    );
  }

  if (!session || session.questions.length === 0) return null;

  if (finished) {
    return (
      <PracticeOverlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
          <span className="text-5xl" aria-hidden="true">🎉</span>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Session complete!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {studentName} got <span className="font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</span> out of {session.questions.length} correct, with a best streak of{' '}
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400">{bestStreak} 🔥</span>.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">This practice session does not change assessment records or level placement.</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => void loadSession()} className="flex items-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600">
              ↻ Practice again
            </button>
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Done</button>
          </div>
        </div>
      </PracticeOverlay>
    );
  }

  const question = session.questions[questionIndex];
  const isLastQuestion = questionIndex === session.questions.length - 1;
  const nextQuestion = () => {
    if (isLastQuestion) {
      setFinished(true);
      return;
    }
    setQuestionIndex(index => index + 1);
    setInputValue('');
    setAnswerState('unanswered');
    setError(null);
  };

  return (
    <PracticeOverlay onClose={onClose}>
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{studentName} · Level {session.level}.{session.subLevel}</p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Question {questionIndex + 1} of {session.questions.length}{question.topic ? ` · ${question.topic}` : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-800 dark:bg-amber-950/40">
          <span className={sessionStreak > 0 ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'} aria-hidden="true">🔥</span>
          <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">{sessionStreak}</span>
        </div>
      </div>

      <div className="mt-3 px-6"><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600 transition-all dark:bg-indigo-500" style={{ width: `${((questionIndex + (answerState !== 'unanswered' ? 1 : 0)) / session.questions.length) * 100}%` }} /></div></div>

      <div className="px-6 py-8">
        <p className="text-center text-lg font-bold leading-relaxed text-slate-900 dark:text-white">{question.question}</p>
        {question.answer_type === 'choice' && question.choices ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {question.choices.map(choice => {
              const isSelected = inputValue === choice;
              return <button key={choice} onClick={() => { setInputValue(choice); void submitAnswer(choice); }} disabled={answerState !== 'unanswered' || submitting} className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${isSelected && answerState === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : isSelected && answerState === 'incorrect' ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'border-slate-200 text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700'}`}>{choice}</button>;
            })}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3">
            <input type={question.answer_type === 'number' ? 'number' : 'text'} value={inputValue} onChange={event => setInputValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void submitAnswer(inputValue); }} disabled={answerState !== 'unanswered' || submitting} className={`w-40 rounded-lg border-2 px-3.5 py-2.5 text-center text-lg font-bold focus:outline-none ${answerState === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : answerState === 'incorrect' ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white'}`} autoFocus />
            {answerState === 'unanswered' && <button onClick={() => void submitAnswer(inputValue)} disabled={inputValue.trim() === '' || submitting} className="rounded-lg bg-indigo-700 px-6 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-40">{submitting ? 'Checking…' : 'Check'}</button>}
          </div>
        )}
        {error && <p className="mt-4 text-center text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
        {answerState !== 'unanswered' && <div className={`mt-5 flex items-center justify-center gap-2 text-sm font-bold ${answerState === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{answerState === 'correct' ? <><CheckCircle2 className="h-4 w-4" /> Correct!</> : <><span aria-hidden="true">×</span> Not quite. Try the next question.</>}</div>}
      </div>
      {answerState !== 'unanswered' && <div className="px-6 pb-6"><button onClick={nextQuestion} className="w-full rounded-lg bg-indigo-700 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600">{isLastQuestion ? 'Finish session' : 'Next question →'}</button></div>}
    </PracticeOverlay>
  );
};

const LoadingState = () => <div className="flex flex-col items-center justify-center gap-3 py-20"><span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-400" aria-hidden="true" /><p className="text-sm text-slate-500 dark:text-slate-400">Preparing practice questions…</p></div>;

const PracticeOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"><div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800" aria-label="Close practice session"><span className="text-lg leading-none" aria-hidden="true">×</span></button>{children}</div></div>;
