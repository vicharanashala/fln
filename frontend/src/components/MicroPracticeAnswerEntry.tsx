import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Bundled locally by Vite's ?url import (resolved to a hashed local asset
// URL at build time) rather than fetched from a CDN — keeps PDF rendering
// working offline and avoids a third-party runtime dependency.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PaperQuestion {
    question_id: string;
    question: string;
    answer: string;
    answer_type: 'text' | 'number' | 'choice' | 'visual-confirm';
    choices?: string[];
    topic: string;
    subtopic: string;
    difficulty: string;
    source_level: number;
    // For 'visual-confirm' questions: the reference image of what the
    // correct drawing should look like, shown next to the uploaded photo.
    referenceImageSvg?: string;
}

interface PaperPart {
    competency: string | null;
    questions: PaperQuestion[];
}

interface IdentifiedPaper {
    paperId: string;
    studentId: string;
    studentName: string;
    levelId?: number;
    subIdx?: number;
    sectionIndex?: number;
    questionCount?: number;
    competency: string | null;
    imageUrl: string;
}

interface BatchNavInfo {
    position: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
}

interface Props {
    token: string;
    paper: IdentifiedPaper;
    onDone: (reason: 'closed' | 'graded') => void;
    batchNav?: BatchNavInfo | null;
}

interface PartResult {
    competency: string;
    success: boolean;
    correctCount?: number;
    totalCount?: number;
    scorePercent?: number;
    error?: string;
}

export const MicroPracticeAnswerEntry: React.FC<Props> = ({ token, paper, onDone, batchNav }) => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [parts, setParts] = useState<PaperPart[]>([]);
    const [isMultiPart, setIsMultiPart] = useState(false);
    const [answers, setAnswers] = useState<Record<number, Record<string, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [partResults, setPartResults] = useState<PartResult[] | null>(null);
    const [savingDraft, setSavingDraft] = useState(false);
    const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
    const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    const isPdfPaper = paper.imageUrl.toLowerCase().endsWith('.pdf');

    useEffect(() => {
        let cancelled = false;
        const fetchPaper = async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const res = await apiFetch(`/api/practice/paper/${paper.paperId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) {
                    if (!cancelled) setLoadError(data.error || 'Failed to load the paper.');
                    return;
                }
                if (!cancelled) {
                    const rawParts = Array.isArray(data.parts) ? data.parts : null;
                    if (rawParts && rawParts.length > 0) {
                        setIsMultiPart(true);
                        setParts(rawParts.map((p: any) => ({
                            competency: p.competency ?? null,
                            questions: Array.isArray(p.questions) ? p.questions : []
                        })));
                    } else {
                        setIsMultiPart(false);
                        setParts([{
                            competency: data.competency ?? paper.competency,
                            questions: Array.isArray(data.questions) ? data.questions : []
                        }]);
                    }
                    if (data.draftAnswers) {
                        setAnswers(data.draftAnswers);
                    }
                }
            } catch {
                if (!cancelled) setLoadError('Network error loading the paper.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchPaper();
        return () => { cancelled = true; };
    }, [paper.paperId, token]);

    // Renders every page of a merged multi-page upload to an offscreen
    // canvas and keeps each as a data URL, so the left panel can stack all
    // of a student's pages instead of only linking out to the raw PDF.
    useEffect(() => {
        if (!isPdfPaper) {
            setPdfPageImages([]);
            setPdfError(null);
            return;
        }
        let cancelled = false;
        const renderPdfPages = async () => {
            setPdfLoading(true);
            setPdfError(null);
            try {
                const doc = await pdfjsLib.getDocument({ url: paper.imageUrl }).promise;
                const images: string[] = [];
                for (let i = 1; i <= doc.numPages; i++) {
                    const page = await doc.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('PDF rendering is not supported in this browser.');
                    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
                    images.push(canvas.toDataURL('image/png'));
                }
                if (!cancelled) setPdfPageImages(images);
            } catch {
                if (!cancelled) setPdfError('Failed to render the uploaded PDF pages.');
            } finally {
                if (!cancelled) setPdfLoading(false);
            }
        };
        renderPdfPages();
        return () => { cancelled = true; };
    }, [paper.imageUrl, isPdfPaper]);

    const setAnswer = (partIndex: number, questionId: string, value: string) => {
        setAnswers(prev => ({
            ...prev,
            [partIndex]: { ...(prev[partIndex] || {}), [questionId]: value }
        }));
    };

    // Submits each part separately to /api/practice/submit, sequentially, so
    // each competency's sub-level/scheduling advances independently — matches
    // how individual (single-competency) generation already behaves. Keeps
    // going even if one part fails, so a bad competency in one part doesn't
    // block the others from being recorded.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const results: PartResult[] = [];
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part.competency) {
                results.push({
                    competency: `Part ${i + 1}`,
                    success: false,
                    error: "This part's level has no matching competency — cannot submit."
                });
                continue;
            }
            try {
                const res = await apiFetch('/api/practice/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        studentId: paper.studentId,
                        competency: part.competency,
                        questions: part.questions,
                        answers: answers[i] || {},
                        paperId: paper.paperId
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    results.push({ competency: part.competency, success: false, error: data.error || 'Failed to submit answers.' });
                } else {
                    results.push({
                        competency: part.competency,
                        success: true,
                        correctCount: data.correctCount,
                        totalCount: data.totalCount,
                        scorePercent: data.scorePercent
                    });
                }
            } catch {
                results.push({ competency: part.competency, success: false, error: 'Network error submitting answers.' });
            }
        }

        setPartResults(results);
        setSubmitting(false);
    };

    // Persists whatever's been typed so far without grading anything, so
    // the teacher can pick this paper back up later from the pending list.
    const handleSaveDraft = async () => {
        setSavingDraft(true);
        setSaveDraftError(null);
        try {
            const res = await apiFetch(`/api/practice/paper/${paper.paperId}/save-draft`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ answers })
            });
            if (!res.ok) {
                const data = await res.json();
                setSaveDraftError(data.error || 'Failed to save draft.');
                setSavingDraft(false);
                return;
            }
        } catch {
            setSaveDraftError('Network error saving draft.');
            setSavingDraft(false);
            return;
        }
        setSavingDraft(false);
        onDone('closed');
    };

    const totalQuestions = parts.reduce((sum, p) => sum + p.questions.length, 0);
    const allVisualConfirmsAnswered = parts.every((p, pi) =>
        p.questions.every(q => {
            if (q.answer_type !== 'visual-confirm') return true;
            const val = (answers[pi] || {})[q.question_id];
            return val === 'yes' || val === 'no';
        })
    );
    const canSubmit = !loading && !loadError && totalQuestions > 0 && !submitting && allVisualConfirmsAnswered;

    const aggregate = partResults
        ? partResults.filter(r => r.success).reduce(
            (acc, r) => ({ correct: acc.correct + (r.correctCount || 0), total: acc.total + (r.totalCount || 0) }),
            { correct: 0, total: 0 }
        )
        : null;

    return (
        <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                        Enter Answers — {paper.studentName}
                    </h3>
                    {paper.levelId != null ? (
                        <p className="text-xs text-zinc-500 mt-1">
                            Level {paper.levelId}.{paper.subIdx}{paper.competency ? ` · ${paper.competency}` : ''}
                        </p>
                    ) : (!loading && !loadError && parts.length > 0) ? (
                        <p className="text-xs text-zinc-500 mt-1">
                            {isMultiPart
                                ? `${parts.length} Part${parts.length !== 1 ? 's' : ''} · ${parts.map(p => p.competency || 'Unknown').join(', ')}`
                                : (parts[0]?.competency || '')}
                        </p>
                    ) : null}
                </div>
                <div className="flex items-center gap-3">
                    {batchNav && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={batchNav.onPrevious}
                                disabled={batchNav.position <= 1}
                                className="text-xs font-bold text-zinc-500 hover:underline disabled:opacity-30 disabled:hover:no-underline disabled:cursor-not-allowed"
                            >
                                &lt; Previous
                            </button>
                            <span className="text-xs text-zinc-400">{batchNav.position} / {batchNav.total}</span>
                            <button
                                type="button"
                                onClick={batchNav.onNext}
                                disabled={batchNav.position >= batchNav.total}
                                className="text-xs font-bold text-zinc-500 hover:underline disabled:opacity-30 disabled:hover:no-underline disabled:cursor-not-allowed"
                            >
                                Next &gt;
                            </button>
                        </div>
                    )}
                    <button onClick={() => onDone('closed')} className="text-sm font-bold text-zinc-500 hover:underline">Close</button>
                </div>
            </div>

            {loading && <p className="text-sm text-zinc-400">Loading paper...</p>}
            {loadError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{loadError}</div>
            )}

            {!loading && !loadError && !partResults && (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-[800px] flex flex-col">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Uploaded Paper</p>
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar">
                            {isPdfPaper ? (
                                <div className="space-y-3">
                                    {pdfLoading && <p className="text-sm text-zinc-400">Rendering PDF pages...</p>}
                                    {pdfError && (
                                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                                            {pdfError}{' '}
                                            <a href={paper.imageUrl} target="_blank" rel="noreferrer" className="font-bold underline">
                                                Open the PDF directly instead.
                                            </a>
                                        </div>
                                    )}
                                    {!pdfLoading && !pdfError && pdfPageImages.map((src, idx) => (
                                        <img
                                            key={idx}
                                            src={src}
                                            alt={`Uploaded paper — page ${idx + 1}`}
                                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <img
                                    src={paper.imageUrl}
                                    alt="Uploaded completed paper"
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                                />
                            )}
                        </div>
                    </div>
                    <div className="h-[800px] flex flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 space-y-4 custom-scrollbar">
                            {parts.map((part, partIndex) => (
                                <div key={partIndex} className="space-y-3">
                                    {isMultiPart ? (
                                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                            Part {partIndex + 1}: {part.competency || 'Unknown Competency'} ({part.questions.length})
                                        </p>
                                    ) : (
                                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                                            Questions ({part.questions.length})
                                        </p>
                                    )}
                                    {part.questions.map((q, idx) => (
                                        <div key={q.question_id} className="border border-zinc-200 rounded-lg p-3">
                                            <p className="text-sm text-zinc-800 mb-2">
                                                Q{idx + 1}: {q.question}
                                            </p>
                                            {q.answer_type === 'visual-confirm' ? (
                                                <div className="space-y-2">
                                                    <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 inline-block">
                                                        <p className="text-xs text-zinc-500 mb-1">Correct drawing should look like:</p>
                                                        {/* Safe: server-generated from a deterministic template
                                                            (tallyMarksSVG) driven by a stored numeric answer, not
                                                            user-controlled content. */}
                                                        <div dangerouslySetInnerHTML={{ __html: q.referenceImageSvg || '' }} />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAnswer(partIndex, q.question_id, 'yes')}
                                                            className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${(answers[partIndex] || {})[q.question_id] === 'yes'
                                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                                                                }`}
                                                        >
                                                            Yes, Matches
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAnswer(partIndex, q.question_id, 'no')}
                                                            className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${(answers[partIndex] || {})[q.question_id] === 'no'
                                                                ? 'bg-red-600 text-white border-red-600'
                                                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                                                                }`}
                                                        >
                                                            No, Doesn't Match
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : q.answer_type === 'choice' && q.choices ? (
                                                <div className="space-y-1.5">
                                                    {q.choices.map((choice) => (
                                                        <label key={choice} className="flex items-center gap-2 text-sm p-2 border border-zinc-100 rounded-lg cursor-pointer hover:bg-zinc-50">
                                                            <input
                                                                type="radio"
                                                                name={`p${partIndex}_${q.question_id}`}
                                                                checked={(answers[partIndex] || {})[q.question_id] === choice}
                                                                onChange={() => setAnswer(partIndex, q.question_id, choice)}
                                                            />
                                                            {choice}
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : q.answer_type === 'number' ? (
                                                <>
                                                    <input
                                                        type="number"
                                                        value={(answers[partIndex] || {})[q.question_id] || ''}
                                                        onChange={(e) => setAnswer(partIndex, q.question_id, e.target.value)}
                                                        placeholder="Enter number"
                                                        className="w-full text-sm border border-zinc-200 rounded-lg p-2"
                                                    />
                                                    <p className="text-xs text-zinc-400 mt-1">Correct answer: {q.answer}</p>
                                                </>
                                            ) : (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={(answers[partIndex] || {})[q.question_id] || ''}
                                                        onChange={(e) => setAnswer(partIndex, q.question_id, e.target.value)}
                                                        placeholder="Enter answer"
                                                        className="w-full text-sm border border-zinc-200 rounded-lg p-2"
                                                    />
                                                    <p className="text-xs text-zinc-400 mt-1">Correct answer: {q.answer}</p>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        {saveDraftError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mt-4">{saveDraftError}</div>
                        )}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={submitting || savingDraft}
                                className="flex-1 bg-zinc-100 text-zinc-700 font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-200 disabled:opacity-50"
                            >
                                {savingDraft ? 'Saving...' : 'Save & Grade Later'}
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit || savingDraft}
                                className="flex-1 bg-emerald-600 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {submitting ? 'Grading...' : isMultiPart ? 'Submit & Grade All Parts' : 'Submit & Grade'}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {partResults && (
                <div className="text-center py-4 space-y-4">
                    {aggregate && aggregate.total > 0 && (
                        <div className="text-3xl font-bold text-emerald-600">
                            {aggregate.correct}/{aggregate.total} ({Math.round((aggregate.correct / aggregate.total) * 100)}%)
                        </div>
                    )}
                    <div className="max-w-md mx-auto text-left space-y-2">
                        {partResults.map((r, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm border border-zinc-100 rounded-lg p-2.5 bg-zinc-50">
                                <span className="text-zinc-700 font-medium">{r.competency}</span>
                                {r.success ? (
                                    <span className="text-emerald-600 font-bold">
                                        {r.correctCount}/{r.totalCount} ({r.scorePercent}%)
                                    </span>
                                ) : (
                                    <span className="text-red-600 text-xs">{r.error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-zinc-500">
                        Next practice for each graded competency has been automatically scheduled.
                    </p>
                    <button onClick={() => onDone('graded')} className="text-sm font-bold text-indigo-600 hover:underline">
                        Done
                    </button>
                </div>
            )}
        </div>
    );
};
