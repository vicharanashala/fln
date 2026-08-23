import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/apiClient';

interface Student {
  id: string;
  name: string;
  classGroup: string;
}

interface WeakTopic {
  topic: string;
  needsPracticeCount: number;
  totalAttempts: number;
  weaknessRate: number;
}

interface Mistake {
  topic: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
}

interface PracticeQuestion {
  question_id: string;
  question: string;
  answer: string;
  topic: string;
}

export default function WeakTopicsPanel() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [topics, setTopics] = useState<WeakTopic[] | null>(null);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[] | null>(null);
  const [practiceTopic, setPracticeTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/students?search=${encodeURIComponent(query)}&limit=8`);
        const all: Student[] = await res.json();
        const filtered = all
          .filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 8);
        setSuggestions(filtered);
      } catch (err){
        console.error('Student search failed:', err);
        setSuggestions([]);
      }
    }, 300);
  }, [query]);

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setQuery(s.name);
    setSuggestions([]);
    setTopics(null);
    setMistakes([]);
    setPracticeQuestions(null);
    setError('');
  };

  const loadWeakTopics = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    setError('');
    setPracticeQuestions(null);
    try {
      const res = await apiFetch(`/api/evaluation/${selectedStudent.id}/weak-topics`);
      const data: WeakTopic[] = await res.json();
      setTopics(data);

      const mistakesRes = await apiFetch(`/api/evaluation/${selectedStudent.id}/mistakes`);
      const mistakesData: Mistake[] = await mistakesRes.json();
      setMistakes(mistakesData);
    } catch (e) {
      setError('Could not load weak topics.');
    } finally {
      setLoading(false);
    }
  };

  const loadPracticeQuestions = async (topic: string) => {
    setPracticeTopic(topic);
    setPracticeQuestions(null);
    try {
      const res = await apiFetch(`/api/practice-questions?topic=${encodeURIComponent(topic)}&count=8`);
      const data: PracticeQuestion[] = await res.json();
      setPracticeQuestions(data);
    } catch (e) {
      setError('Could not load practice questions.');
    }
  };

  const getColor = (rate: number) => {
    if (rate >= 0.6) return '#dc2626';
    if (rate >= 0.3) return '#d97706';
    return '#059669';
  };

  const topWeakTopics = topics ? topics.filter(t => t.weaknessRate >= 0.3).sort((a, b) => b.weaknessRate - a.weaknessRate) : [];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h2>Weak Topic Detector</h2>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedStudent(null); }}
          placeholder="Search student by name or ID..."
          style={{ width: '100%', padding: 10, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 6 }}
        />
        {suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc', borderRadius: 6, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
            {suggestions.map((s) => (
              <div key={s.id} onClick={() => selectStudent(s)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                <strong>{s.name}</strong> — {s.classGroup} <span style={{ color: '#999' }}>({s.id})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedStudent && (
        <>
          <p style={{ color: '#666' }}>Selected: <strong>{selectedStudent.name}</strong> ({selectedStudent.id})</p>
          <button onClick={loadWeakTopics} style={{ padding: '10px 20px', marginBottom: 16 }}>
            {loading ? 'Loading...' : 'Analyze Weak Topics'}
          </button>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {topics && topics.length === 0 && (
        <p style={{ color: '#666' }}>No evaluation history found for this student yet.</p>
      )}

      {topics && topics.length > 0 && (
        <div>
          {topics.map((t) => (
            <div key={t.topic} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong>{t.topic}</strong>
                <span style={{ color: getColor(t.weaknessRate) }}>{Math.round(t.weaknessRate * 100)}% needs practice</span>
              </div>
              <div style={{ background: '#eee', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${t.weaknessRate * 100}%`, background: getColor(t.weaknessRate), height: '100%' }} />
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{t.needsPracticeCount} of {t.totalAttempts} attempts flagged</div>
            </div>
          ))}
        </div>
      )}

      {mistakes.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Specific Mistakes</h3>
          {mistakes.map((m, idx) => (
            <div key={idx} style={{ marginBottom: 10, padding: 10, background: '#fef2f2', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#999' }}>{m.topic}</div>
              <div>{m.question}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Answered: <strong style={{ color: '#dc2626' }}>{m.studentAnswer}</strong> — Correct: <strong style={{ color: '#059669' }}>{m.correctAnswer}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {topWeakTopics.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Practice the Weakest Topics</h3>
          {topWeakTopics.map((t) => (
            <button
              key={t.topic}
              onClick={() => loadPracticeQuestions(t.topic)}
              style={{ marginRight: 8, marginBottom: 8, padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
            >
              Generate practice: {t.topic}
            </button>
          ))}
        </div>
      )}

      {practiceQuestions && (
        <div style={{ marginTop: 16 }}>
          <h4>Practice Questions — {practiceTopic}</h4>
          {practiceQuestions.length === 0 && <p style={{ color: '#666' }}>No questions found for this topic.</p>}
          <ol>
            {practiceQuestions.map((q) => (
              <li key={q.question_id} style={{ marginBottom: 8 }}>{q.question}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}