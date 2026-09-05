import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect, useMemo } from 'react';
import { UserRole } from '../types';
import { MicroPracticePaperUpload } from './MicroPracticePaperUpload';
import { MicroPracticeAnswerEntry } from './MicroPracticeAnswerEntry';
import { User, Users, FileCheck, Clock, ChevronDown, TrendingUp, Upload, ClipboardCheck, Printer } from 'lucide-react';

interface Props {
    token: string;
    userRole: UserRole;
}

// Sentinel activeGroupKey meaning "every pending paper" (used by Grade All)
// — can't collide with getGroupKeyForPaper's real return shapes.
const ALL_PAPERS_KEY = '__all__';

const ALL_COMPETENCIES = [
    'Number Sense',
    'Number Operations',
    'Shapes',
    'Measurement',
    'Patterns',
    'Fractions',
    'Money',
    'Data Handling',
    'Calendar and Time'
];

// Fixed line/dot color per competency for the progress chart, keyed off
// ALL_COMPETENCIES so legend/series colors stay stable across renders and
// across which student is selected.
const COMPETENCY_COLORS: Record<string, { line: string; dot: string }> = {
    'Number Sense': { line: '#1d5df0', dot: '#2b7cf6' },
    'Number Operations': { line: '#e0245e', dot: '#ec4f80' },
    'Shapes': { line: '#0d9488', dot: '#12a99a' },
    'Measurement': { line: '#6b46e8', dot: '#7c5cf0' },
    'Patterns': { line: '#eab308', dot: '#d4a017' },
    'Fractions': { line: '#f2662f', dot: '#fb7a3c' },
    'Money': { line: '#16a34a', dot: '#22c55e' },
    'Data Handling': { line: '#9333ea', dot: '#a855f7' },
    'Calendar and Time': { line: '#0891b2', dot: '#22b8d4' }
};

type GeneratePanelMode = 'none' | 'picker' | 'individual' | 'bulk';
type BulkSubMode = 'picker' | 'manual' | 'entire-class' | 'due-today';

interface DueBulkGroup {
    targetLabel: string;
    students: { studentId: string; studentName: string; competencies: string[] }[];
}

interface BulkJob {
    jobId: string;
    total: number;
    completed: number;
    status: 'running' | 'completed' | 'failed';
    results: any[];
    combinedPdfUrl: string | null;
    zipUrl: string | null;
    error: string;
}

export const MicroPractice: React.FC<Props> = ({ token, userRole }) => {
    const [dueList, setDueList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [competency, setCompetency] = useState('');
    const [progressData, setProgressData] = useState<any[]>([]);
    const [loadingProgress, setLoadingProgress] = useState(true);
    // Which class group (by classOptions key, or 'unassigned') within the
    // merged "Today" due list currently has its "Generate Individually"
    // per-student picker expanded, if any. Only one open at a time.
    const [expandedIndividualDueClass, setExpandedIndividualDueClass] = useState<string | null>(null);
    const [studentCompetencyOptions, setStudentCompetencyOptions] = useState<string[]>([]);
    const [showUploadPaper, setShowUploadPaper] = useState(false);
    const [identifiedPaper, setIdentifiedPaper] = useState<any | null>(null);
    // Group key (getGroupKeyForPaper) shared by papers being graded together,
    // or null standalone. Derived live from pendingPapers, not snapshotted,
    // so it shrinks as students get graded.
    const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
    const [pendingPapers, setPendingPapers] = useState<any[]>([]);
    const [loadingPending, setLoadingPending] = useState(true);
    const [uploadSummaryMessage, setUploadSummaryMessage] = useState<string | null>(null);

    const [generateMode, setGenerateMode] = useState<GeneratePanelMode>('none');

    // Class filter for the generate-paper picker (null = All Classes);
    // persists across Individual/Bulk sub-screens until the panel closes.
    const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);

    // Individual-student generate flow
    const [paperQuestionCount, setPaperQuestionCount] = useState(5);
    const [generatingPaper, setGeneratingPaper] = useState(false);
    const [generatePaperError, setGeneratePaperError] = useState<string | null>(null);
    const [generatedPaperResult, setGeneratedPaperResult] = useState<{ pdfUrl: string; paperId: string } | null>(null);

    // Bulk (whole-class) generate flow
    const [bulkSubMode, setBulkSubMode] = useState<BulkSubMode>('picker');
    const [bulkSelectedStudentIds, setBulkSelectedStudentIds] = useState<string[]>([]);
    const [bulkQuestionsPerCompetency, setBulkQuestionsPerCompetency] = useState(5);
    const [bulkGenerating, setBulkGenerating] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);
    const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);

    // Due-today class-group queued for bulk-generate quick launch; holds each
    // student's actual due competencies (not their full weak-competency list).
    const [dueBulkGroup, setDueBulkGroup] = useState<DueBulkGroup | null>(null);

    const fetchDueList = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/practice/due', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setDueList(data);
        } catch (err) {
            console.error('Failed to fetch due list:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await apiFetch('/api/students', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setStudents(data);
        } catch (err) {
            console.error('Failed to fetch students:', err);
        }
    };

    const fetchProgress = async () => {
        setLoadingProgress(true);
        try {
            const res = await apiFetch('/api/practice/progress', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setProgressData(data);
        } catch (err) {
            console.error('Failed to fetch progress:', err);
        } finally {
            setLoadingProgress(false);
        }
    };

    const fetchPendingPapers = async () => {
        setLoadingPending(true);
        try {
            const res = await apiFetch('/api/practice/pending-papers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setPendingPapers(data);
        } catch (err) {
            console.error('Failed to fetch pending papers:', err);
        } finally {
            setLoadingPending(false);
        }
    };

    const fetchWeakCompetencies = async (studentId: string) => {
        if (!studentId) {
            setStudentCompetencyOptions([]);
            return;
        }
        try {
            const res = await apiFetch(`/api/students/${studentId}/weak-competencies`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStudentCompetencyOptions(data.weakCompetencies || []);
        } catch (err) {
            console.error('Failed to fetch competencies:', err);
            setStudentCompetencyOptions([]);
        }
    };

    useEffect(() => {
        fetchDueList();
    }, [token]);

    useEffect(() => {
        fetchProgress();
    }, [token]);

    // Needed on mount (not just when the generate panel opens) so
    // Papers Awaiting Grading / Due Today can look up each student's
    // classGroup/section for the class badges below.
    useEffect(() => {
        fetchStudents();
    }, [token]);

    useEffect(() => {
        fetchPendingPapers();
    }, [token]);

    // Poll bulk job progress — same pattern as RoleDashboards.tsx's diagnostic
    // bulk-generation polling: 1500ms interval, stops on any non-'running'
    // status or a failed fetch.
    useEffect(() => {
        if (!bulkJob || bulkJob.status !== 'running') return;
        const interval = setInterval(async () => {
            try {
                const res = await apiFetch(`/api/practice/bulk-generate/${bulkJob.jobId}/progress`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setBulkJob(prev => prev ? {
                        ...prev,
                        completed: data.completed,
                        status: data.status,
                        results: data.results || prev.results,
                        combinedPdfUrl: data.combinedPdfUrl ?? prev.combinedPdfUrl,
                        zipUrl: data.zipUrl ?? prev.zipUrl,
                        error: data.error || ''
                    } : prev);
                    if (data.status !== 'running') clearInterval(interval);
                } else {
                    clearInterval(interval);
                }
            } catch {
                clearInterval(interval);
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [bulkJob?.jobId, bulkJob?.status, token]);

    const resetIndividualState = () => {
        setSelectedStudentId('');
        setCompetency('');
        setStudentCompetencyOptions([]);
        setPaperQuestionCount(5);
        setGeneratedPaperResult(null);
        setGeneratePaperError(null);
    };

    const resetBulkState = () => {
        setBulkSubMode('picker');
        setBulkSelectedStudentIds([]);
        setBulkQuestionsPerCompetency(5);
        setBulkJob(null);
        setBulkError(null);
    };

    const openGeneratePanel = () => {
        fetchStudents();
        resetIndividualState();
        resetBulkState();
        setSelectedClassKey(null);
        setGenerateMode('picker');
    };

    const closeGeneratePanel = () => {
        resetIndividualState();
        resetBulkState();
        setDueBulkGroup(null);
        setSelectedClassKey(null);
        setGenerateMode('none');
    };

    const chooseIndividualMode = () => {
        resetIndividualState();
        setGenerateMode('individual');
    };

    const chooseBulkMode = () => {
        resetBulkState();
        setGenerateMode('bulk');
    };

    const backToPicker = () => {
        resetIndividualState();
        resetBulkState();
        setSelectedClassKey(null);
        setGenerateMode('picker');
    };

    const chooseBulkManual = () => {
        setBulkSelectedStudentIds([]);
        setBulkError(null);
        setBulkJob(null);
        setBulkSubMode('manual');
    };

    const chooseBulkEntireClass = () => {
        setBulkError(null);
        setBulkJob(null);
        setBulkSubMode('entire-class');
    };

    // Quick-launches bulk-generate straight into a pre-scoped confirm screen
    // for a class/student's due students, bypassing the Individual/Bulk picker
    // entirely since that list is already known from due-schedule grouping.
    const triggerDueBulkGenerate = (targetLabel: string, students: DueBulkGroup['students']) => {
        setDueBulkGroup({ targetLabel, students });
        setBulkError(null);
        setBulkJob(null);
        setBulkSubMode('due-today');
        setGenerateMode('bulk');
    };

    const closeDueBulkGenerate = () => {
        setDueBulkGroup(null);
        resetBulkState();
        setGenerateMode('none');
    };

    const backToBulkPicker = () => {
        setBulkSelectedStudentIds([]);
        setBulkError(null);
        setBulkJob(null);
        setBulkSubMode('picker');
    };

    const handleGeneratePaper = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId || !competency) return;
        setGeneratingPaper(true);
        setGeneratePaperError(null);
        try {
            // The server resolves levelId/subIdx from the student's PracticeSchedule
            // for this competency — their real current position, advancing on good
            // scores, not a fixed subIdx 0.
            const res = await apiFetch(`/api/students/${selectedStudentId}/micro-practice/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    competency,
                    sectionIndex: 0,
                    questionCount: paperQuestionCount
                })
            });
            const data = await res.json();
            if (res.ok) {
                setGeneratedPaperResult({ pdfUrl: data.pdfUrl, paperId: data.paperId });
            } else {
                setGeneratePaperError(data.error || 'Failed to generate the paper.');
            }
        } catch {
            setGeneratePaperError('Network error generating the paper.');
        } finally {
            setGeneratingPaper(false);
        }
    };

    const toggleBulkStudent = (studentId: string) => {
        setBulkSelectedStudentIds(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    // Starts an async bulk-generation job; the polling useEffect above takes
    // over from here. Shared by all three bulk sub-modes — due-today alone
    // scopes each student to their actually-due competencies.
    const handleBulkGenerate = async (studentIds: string[], studentCompetencyOverrides?: Record<string, string[]>) => {
        if (studentIds.length === 0) return;
        setBulkGenerating(true);
        setBulkError(null);
        try {
            const res = await apiFetch('/api/practice/bulk-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentIds,
                    questionsPerCompetency: bulkQuestionsPerCompetency,
                    ...(studentCompetencyOverrides ? { studentCompetencyOverrides } : {})
                })
            });
            const data = await res.json();
            if (res.ok) {
                setBulkJob({
                    jobId: data.jobId,
                    total: data.total,
                    completed: 0,
                    status: data.status || 'running',
                    results: [],
                    combinedPdfUrl: null,
                    zipUrl: null,
                    error: ''
                });
            } else {
                setBulkError(data.error || 'Failed to start bulk generation.');
            }
        } catch {
            setBulkError('Network error starting bulk generation.');
        } finally {
            setBulkGenerating(false);
        }
    };

    // Opens a pending paper directly in the grading screen — the screen
    // fetches real question content by paperId, so levelId/subIdx/competency
    // can stay unset here.
    const openPendingPaper = (p: any) => {
        setIdentifiedPaper({
            paperId: p.paperId,
            studentId: p.studentId,
            studentName: p.studentName,
            imageUrl: p.imageUrl,
            competency: null
        });
    };

    // Moves to the sibling paper `offset` positions away (-1 Previous, +1
    // Next) in the active batch; no-ops at either end rather than wrapping.
    const goToBatchSibling = (offset: number) => {
        if (!activeGroupKey || !identifiedPaper) return;
        const siblings = getActiveGroupSiblings();
        const currentIndex = siblings.findIndex(p => p.paperId === identifiedPaper.paperId);
        if (currentIndex === -1) return;
        const targetIndex = currentIndex + offset;
        if (targetIndex < 0 || targetIndex >= siblings.length) return;
        openPendingPaper(siblings[targetIndex]);
    };

    // 'closed' returns to the pending-papers list; 'graded' auto-advances to
    // the next ungraded paper in the batch (read live, not via the refetch
    // below, which resolves asynchronously).
    const handleAnswerEntryDone = (reason: 'closed' | 'graded') => {
        setShowUploadPaper(false);
        fetchDueList();
        fetchProgress();
        fetchPendingPapers();

        if (reason === 'graded' && activeGroupKey && identifiedPaper) {
            const remainingSiblings = getActiveGroupSiblings().filter(p => p.paperId !== identifiedPaper.paperId);
            if (remainingSiblings.length > 0) {
                openPendingPaper(remainingSiblings[0]);
                return;
            }
        }
        setIdentifiedPaper(null);
        setActiveGroupKey(null);
    };

    // Classes derived from the fetched students' own classGroup+section, not
    // from User/ClassGroup — ClassGroup.teacherId is unreliable here.
    const classOptions = students.reduce((acc: { key: string; className: string; section: string }[], s) => {
        const className = s.classGroup || 'Unknown';
        const section = s.section || '';
        const key = `${className}::${section}`;
        if (!acc.some(c => c.key === key)) acc.push({ key, className, section });
        return acc;
    }, []).sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section));

    const selectedClassLabel = selectedClassKey
        ? classOptions.find(c => c.key === selectedClassKey)
        : null;

    const filteredStudents = selectedClassKey
        ? students.filter(s => `${s.classGroup || 'Unknown'}::${s.section || ''}` === selectedClassKey)
        : students;

    // Looks up a student's class for badges on Papers Awaiting Grading / Due
    // Today; null (no badge) if the student can't be found.
    const getStudentClass = (studentId: string) => {
        const s = students.find(st => st.id === studentId);
        return s ? { className: s.classGroup || 'Unknown', section: s.section || '' } : null;
    };

    // Groups papers by class+upload-date rather than upload batch. Falls back
    // to a per-paper unique key when the class can't be resolved, so it
    // renders standalone instead of joining a false "unknown class" bucket.
    const getGroupKeyForPaper = (p: any): string => {
        const cls = getStudentClass(p.studentId);
        const dateKey = new Date(p.uploadedAt).toLocaleDateString();
        return cls ? `${dateKey}__${cls.className}::${cls.section}` : `solo:${p.id}`;
    };

    // Flattens pendingPapers into the exact visual order the render below
    // uses, so "Grade All" Next/Previous matches the list, not fetch order.
    const getVisualPendingOrder = (): any[] => {
        const dateGroups = Object.values(
            pendingPapers.reduce((groups: Record<string, { dateKey: string; timestamp: number; papers: any[] }>, p) => {
                const dateKey = new Date(p.uploadedAt).toLocaleDateString();
                if (!groups[dateKey]) {
                    groups[dateKey] = { dateKey, timestamp: new Date(p.uploadedAt).getTime(), papers: [] };
                }
                groups[dateKey].papers.push(p);
                return groups;
            }, {})
        ) as { dateKey: string; timestamp: number; papers: any[] }[];

        const ordered: any[] = [];
        for (const group of [...dateGroups].sort((a, b) => b.timestamp - a.timestamp)) {
            const batches = Object.values(
                group.papers.reduce((acc: Record<string, any[]>, p) => {
                    const groupKey = getGroupKeyForPaper(p);
                    (acc[groupKey] ??= []).push(p);
                    return acc;
                }, {})
            ) as any[][];
            for (const batch of batches) ordered.push(...batch);
        }
        return ordered;
    };

    // Sibling list for activeGroupKey — one class+date group, or every
    // pending paper if ALL_PAPERS_KEY. Keeps Previous/Next, batchNav, and
    // auto-advance in sync.
    const getActiveGroupSiblings = (): any[] => {
        if (!activeGroupKey) return [];
        if (activeGroupKey === ALL_PAPERS_KEY) return getVisualPendingOrder();
        return pendingPapers.filter(p => getGroupKeyForPaper(p) === activeGroupKey);
    };

    // A student can have multiple pending papers in the same group — list
    // their name once with a "(N)" suffix instead of repeating it.
    const formatGroupNames = (papers: any[]): string => {
        const counts = new Map<string, number>();
        for (const p of papers) counts.set(p.studentName, (counts.get(p.studentName) || 0) + 1);
        return Array.from(counts.entries())
            .map(([name, count]) => count > 1 ? `${name} (${count})` : name)
            .join(', ');
    };

    // /api/practice/due only returns nextDueDate <= now, so there's no date
    // axis to group by — just per-student then per-class. Unresolvable
    // classes fall into "Unassigned" rather than disappearing.
    const dueClassGroups = useMemo(() => {
        const studentGroups = Object.values(
            dueList.reduce((acc: Record<string, { studentId: string; studentName: string; competencies: string[]; items: any[] }>, item) => {
                if (!acc[item.studentId]) {
                    acc[item.studentId] = { studentId: item.studentId, studentName: item.studentName, competencies: [], items: [] };
                }
                acc[item.studentId].competencies.push(item.competency);
                acc[item.studentId].items.push(item);
                return acc;
            }, {})
        ) as { studentId: string; studentName: string; competencies: string[]; items: any[] }[];

        const groups = Object.values(
            studentGroups.reduce((acc: Record<string, { key: string; label: string; students: typeof studentGroups }>, sg) => {
                const cls = getStudentClass(sg.studentId);
                const key = cls ? `${cls.className}::${cls.section}` : 'unassigned';
                const label = cls ? `${cls.className}${cls.section ? ` - ${cls.section}` : ''}` : 'Unassigned';
                if (!acc[key]) acc[key] = { key, label, students: [] };
                acc[key].students.push(sg);
                return acc;
            }, {})
        );
        return groups.sort((a, b) => a.label.localeCompare(b.label));
    }, [dueList, students]);

    return (
        <div className="space-y-6">
            <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">
                        Micro-Practice & Spaced Repetition
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        Lightweight practice for weak competencies, between formal assessments
                    </p>
                </div>
                {userRole === UserRole.TEACHER && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => (generateMode === 'none' ? openGeneratePanel() : closeGeneratePanel())}
                            className="bg-indigo-700 text-white font-mono font-medium text-xs py-1.5 px-3 rounded-md hover:bg-indigo-600"
                        >
                            {generateMode === 'none' ? '+ Generate Practice Paper' : 'Close'}
                        </button>
                        <button
                            onClick={() => { setShowUploadPaper(!showUploadPaper); setIdentifiedPaper(null); setActiveGroupKey(null); }}
                            className="bg-emerald-700 text-white font-mono font-medium text-xs py-1.5 px-3 rounded-md hover:bg-emerald-600 flex items-center gap-1.5"
                        >
                            {showUploadPaper ? 'Close' : <><Upload className="h-4 w-4" /> Upload Completed Paper</>}
                        </button>
                    </div>
                )}
            </div>

            {showUploadPaper && !identifiedPaper && (
                <MicroPracticePaperUpload
                    token={token}
                    onCancel={() => setShowUploadPaper(false)}
                    onPaperIdentified={(results) => {
                        setShowUploadPaper(false);
                        if (results.length === 1) {
                            setActiveGroupKey(null);
                            setIdentifiedPaper(results[0]);
                        } else {
                            setUploadSummaryMessage(`${results.length} papers uploaded and added to your pending grading queue below.`);
                            fetchPendingPapers();
                        }
                    }}
                />
            )}

            {uploadSummaryMessage && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200 flex justify-between items-center">
                    <span>{uploadSummaryMessage}</span>
                    <button onClick={() => setUploadSummaryMessage(null)} className="text-xs font-bold hover:underline ml-3">Dismiss</button>
                </div>
            )}

            {identifiedPaper && (() => {
                const activeBatchSiblings = getActiveGroupSiblings();
                const currentBatchIndex = activeBatchSiblings.findIndex(p => p.paperId === identifiedPaper.paperId);
                const batchNav = (activeGroupKey && currentBatchIndex !== -1 && activeBatchSiblings.length > 1)
                    ? {
                        position: currentBatchIndex + 1,
                        total: activeBatchSiblings.length,
                        onPrevious: () => goToBatchSibling(-1),
                        onNext: () => goToBatchSibling(1)
                    }
                    : null;
                return (
                    <MicroPracticeAnswerEntry
                        key={identifiedPaper.paperId}
                        token={token}
                        paper={identifiedPaper}
                        batchNav={batchNav}
                        onDone={handleAnswerEntryDone}
                    />
                );
            })()}

            {generateMode === 'picker' && (
                <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
                    <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-1">
                        Generate a Printable Micro-Practice Paper
                    </h3>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                            Select Class
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedClassKey(null)}
                                className={`py-1.5 px-3 text-center border font-bold text-xs rounded-xl transition-all cursor-pointer ${selectedClassKey === null
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                All Classes
                            </button>
                            {classOptions.map(c => (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => setSelectedClassKey(c.key)}
                                    className={`py-1.5 px-3 text-center border font-bold text-xs rounded-xl transition-all cursor-pointer ${selectedClassKey === c.key
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    {c.className}{c.section ? ` - ${c.section}` : ''}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={chooseIndividualMode}
                            className="flex flex-col items-center text-center bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                        >
                            <User className="w-6 h-6 text-zinc-500 mb-2" />
                            <div className="font-medium text-sm text-zinc-800 dark:text-zinc-100">Individual Student</div>
                            <div className="text-xs text-zinc-500 mt-0.5">Generate one paper for a single student</div>
                        </button>
                        <button
                            onClick={chooseBulkMode}
                            className="flex flex-col items-center text-center bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                        >
                            <Users className="w-6 h-6 text-zinc-500 mb-2" />
                            <div className="font-medium text-sm text-zinc-800 dark:text-zinc-100">Bulk (Whole Class)</div>
                            <div className="text-xs text-zinc-500 mt-0.5">Generate personalized papers for multiple students at once</div>
                        </button>
                    </div>
                </div>
            )}

            {generateMode === 'individual' && (
                <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
                    {!generatedPaperResult ? (
                        <form onSubmit={handleGeneratePaper} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                                    Generate a Printable Micro-Practice Paper
                                </h3>
                                <button type="button" onClick={backToPicker} className="text-xs font-bold text-indigo-600 hover:underline">
                                    ← Back
                                </button>
                            </div>
                            {selectedClassKey && (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>
                                        Filtered to: <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                            {selectedClassLabel?.className}{selectedClassLabel?.section ? ` - ${selectedClassLabel.section}` : ''}
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => setSelectedClassKey(null)} className="font-bold text-indigo-600 hover:underline">✕</button>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Student
                                </label>
                                <select
                                    value={selectedStudentId}
                                    onChange={(e) => {
                                        const studentId = e.target.value;
                                        setSelectedStudentId(studentId);
                                        setCompetency('');
                                        fetchWeakCompetencies(studentId);
                                    }}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                >
                                    <option value="">Select a student...</option>
                                    {filteredStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} - {s.classGroup} {s.section}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Competency to Practice
                                </label>
                                <select
                                    value={competency}
                                    onChange={(e) => setCompetency(e.target.value)}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                >
                                    <option value="">Select a competency...</option>
                                    {(studentCompetencyOptions.length > 0 ? studentCompetencyOptions : ALL_COMPETENCIES).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Number of Questions
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={paperQuestionCount}
                                    onChange={(e) => setPaperQuestionCount(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            {generatePaperError && (
                                <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{generatePaperError}</div>
                            )}
                            <button
                                type="submit"
                                disabled={generatingPaper || !selectedStudentId || !competency}
                                className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {generatingPaper ? 'Generating...' : 'Generate Printable Paper'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-4 space-y-3">
                            <p className="text-sm text-zinc-700 dark:text-zinc-200">
                                Paper generated for <b>{students.find(s => s.id === selectedStudentId)?.name || selectedStudentId}</b> — {competency}.
                            </p>
                            <a
                                href={generatedPaperResult.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-indigo-600"
                            >
                                Open / Print PDF
                            </a>
                            <p className="text-xs text-zinc-500">
                                Print this, have the student complete it, then use "Upload Completed Paper" to grade it.
                            </p>
                            <div>
                                <button
                                    onClick={closeGeneratePanel}
                                    className="text-sm font-bold text-indigo-600 hover:underline"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {generateMode === 'bulk' && (
                <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
                    {bulkSubMode === 'picker' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                                    Bulk Generate Papers
                                </h3>
                                <button type="button" onClick={backToPicker} className="text-xs font-bold text-indigo-600 hover:underline">
                                    ← Back
                                </button>
                            </div>
                            {selectedClassKey && (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>
                                        Filtered to: <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                            {selectedClassLabel?.className}{selectedClassLabel?.section ? ` - ${selectedClassLabel.section}` : ''}
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => setSelectedClassKey(null)} className="font-bold text-indigo-600 hover:underline">✕</button>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={chooseBulkManual}
                                    className="flex flex-col items-center text-center bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                                >
                                    <div className="font-medium text-sm text-zinc-800 dark:text-zinc-100">Select Students Manually</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">Choose specific students from your roster</div>
                                </button>
                                <button
                                    onClick={chooseBulkEntireClass}
                                    className="flex flex-col items-center text-center bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                                >
                                    <div className="font-medium text-sm text-zinc-800 dark:text-zinc-100">Generate for Entire Class</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">One click - includes every student in your roster</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {bulkSubMode === 'manual' && !bulkJob && (
                        <form onSubmit={(e) => { e.preventDefault(); handleBulkGenerate(bulkSelectedStudentIds); }} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                                    Select Students Manually
                                </h3>
                                <button type="button" onClick={backToBulkPicker} className="text-xs font-bold text-indigo-600 hover:underline">
                                    ← Back
                                </button>
                            </div>
                            {selectedClassKey && (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>
                                        Filtered to: <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                            {selectedClassLabel?.className}{selectedClassLabel?.section ? ` - ${selectedClassLabel.section}` : ''}
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => setSelectedClassKey(null)} className="font-bold text-indigo-600 hover:underline">✕</button>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Students
                                </label>
                                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
                                    {filteredStudents.length === 0 ? (
                                        <p className="text-sm text-zinc-400 p-3">{selectedClassKey ? 'No students in this class.' : 'No students found.'}</p>
                                    ) : (
                                        filteredStudents.map(s => (
                                            <label key={s.id} className="flex items-center gap-2 text-sm p-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                                <input
                                                    type="checkbox"
                                                    checked={bulkSelectedStudentIds.includes(s.id)}
                                                    onChange={() => toggleBulkStudent(s.id)}
                                                />
                                                {s.name} - {s.classGroup} {s.section}
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">{bulkSelectedStudentIds.length} selected</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Questions per Competency
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={bulkQuestionsPerCompetency}
                                    onChange={(e) => setBulkQuestionsPerCompetency(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            {bulkError && (
                                <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{bulkError}</div>
                            )}
                            <button
                                type="submit"
                                disabled={bulkGenerating || bulkSelectedStudentIds.length === 0}
                                className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {bulkGenerating
                                    ? 'Starting...'
                                    : `Generate for ${bulkSelectedStudentIds.length} Student${bulkSelectedStudentIds.length !== 1 ? 's' : ''}`}
                            </button>
                        </form>
                    )}

                    {bulkSubMode === 'entire-class' && !bulkJob && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                                    Generate for Entire Class
                                </h3>
                                <button type="button" onClick={backToBulkPicker} className="text-xs font-bold text-indigo-600 hover:underline">
                                    ← Back
                                </button>
                            </div>
                            {selectedClassKey && (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>
                                        Filtered to: <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                            {selectedClassLabel?.className}{selectedClassLabel?.section ? ` - ${selectedClassLabel.section}` : ''}
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => setSelectedClassKey(null)} className="font-bold text-indigo-600 hover:underline">✕</button>
                                </div>
                            )}
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                This will generate personalized papers for all <b>{filteredStudents.length}</b> student{filteredStudents.length !== 1 ? 's' : ''} {selectedClassKey ? `in ${selectedClassLabel?.className}${selectedClassLabel?.section ? ` - ${selectedClassLabel.section}` : ''}` : 'in your roster'}. Students without evaluation data yet will be automatically skipped.
                            </p>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Questions per Competency
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={bulkQuestionsPerCompetency}
                                    onChange={(e) => setBulkQuestionsPerCompetency(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            {bulkError && (
                                <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{bulkError}</div>
                            )}
                            <button
                                onClick={() => handleBulkGenerate(filteredStudents.map(s => s.id))}
                                disabled={bulkGenerating || filteredStudents.length === 0}
                                className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {bulkGenerating ? 'Starting...' : `Generate for Entire Class (${filteredStudents.length})`}
                            </button>
                        </div>
                    )}

                    {bulkSubMode === 'due-today' && !bulkJob && dueBulkGroup && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                                    Generate for {dueBulkGroup.targetLabel}
                                </h3>
                                <button type="button" onClick={closeDueBulkGenerate} className="text-xs font-bold text-indigo-600 hover:underline">
                                    ← Back
                                </button>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                {dueBulkGroup.students.length === 1
                                    ? `This will generate one paper for ${dueBulkGroup.students[0].studentName}, scoped to only the competency(ies) actually due — not their full weak-competency list.`
                                    : `This will generate papers for ${dueBulkGroup.students.length} students in ${dueBulkGroup.targetLabel}, scoped to only the competency(ies) actually due — not their full weak-competency list.`}
                            </p>
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
                                {dueBulkGroup.students.map(s => (
                                    <div key={s.studentId} className="flex items-center justify-between text-sm p-2.5">
                                        <span className="text-zinc-800 dark:text-zinc-100">{s.studentName}</span>
                                        <span className="text-xs text-zinc-500">{s.competencies.join(', ')}</span>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Questions per Competency
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={bulkQuestionsPerCompetency}
                                    onChange={(e) => setBulkQuestionsPerCompetency(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            {bulkError && (
                                <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{bulkError}</div>
                            )}
                            <button
                                onClick={() => handleBulkGenerate(
                                    dueBulkGroup.students.map(s => s.studentId),
                                    Object.fromEntries(dueBulkGroup.students.map(s => [s.studentId, s.competencies]))
                                )}
                                disabled={bulkGenerating}
                                className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {bulkGenerating ? 'Starting...' : `Generate for ${dueBulkGroup.students.length} Student${dueBulkGroup.students.length !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    )}

                    {(bulkGenerating || bulkJob?.status === 'running') && (
                        <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <span className="animate-spin text-xl">⏳</span>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Generating Micro-Practice Papers...</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    {bulkJob ? `${bulkJob.completed} / ${bulkJob.total} papers generated` : 'Starting...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {bulkJob?.status === 'completed' && (() => {
                        const successCount = bulkJob.results.filter((r: any) => !r.skipped).length;
                        return (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-green-700 dark:text-green-300 font-bold text-sm">
                                        ✅ {successCount} Micro-Practice Paper{successCount !== 1 ? 's' : ''} Generated Successfully
                                    </span>
                                    <button onClick={closeGeneratePanel} className="text-xs font-bold text-indigo-600 hover:underline">
                                        Done
                                    </button>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                                    <div className="flex gap-3 flex-wrap">
                                        {bulkJob.combinedPdfUrl && (
                                            <a
                                                href={bulkJob.combinedPdfUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                                            >
                                                🖨️ Print / Open PDF ({successCount} Paper{successCount !== 1 ? 's' : ''})
                                            </a>
                                        )}
                                        {bulkJob.zipUrl && (
                                            <a
                                                href={bulkJob.zipUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                                            >
                                                ⬇️ Download All as ZIP
                                            </a>
                                        )}
                                        {!bulkJob.combinedPdfUrl && !bulkJob.zipUrl && (
                                            <p className="text-sm text-zinc-500">No papers were generated — see reasons below.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800">
                                            <tr>
                                                <th className="text-left font-medium text-zinc-600 dark:text-zinc-300 p-2.5">Student</th>
                                                <th className="text-left font-medium text-zinc-600 dark:text-zinc-300 p-2.5">Result</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {bulkJob.results.map((r: any) => (
                                                <tr key={r.studentId}>
                                                    <td className="p-2.5 text-zinc-800 dark:text-zinc-100">{r.studentName || r.studentId}</td>
                                                    <td className="p-2.5">
                                                        {r.skipped ? (
                                                            <span className="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
                                                                Skipped — {r.reason}
                                                            </span>
                                                        ) : (
                                                            <a
                                                                href={r.pdfUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs font-bold text-indigo-600 hover:underline"
                                                            >
                                                                Open PDF
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {bulkJob?.status === 'failed' && (
                        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium">❌ Generation Failed: {bulkJob.error || 'Unknown error'}</p>
                            <button onClick={() => setBulkJob(null)} className="mt-2 text-xs text-red-600 underline cursor-pointer">
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-amber-500" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Papers Awaiting Grading
                            </h3>
                        </div>
                        {pendingPapers.length > 0 && (
                            <button
                                onClick={() => {
                                    const ordered = getVisualPendingOrder();
                                    if (ordered.length === 0) return;
                                    setActiveGroupKey(ALL_PAPERS_KEY);
                                    openPendingPaper(ordered[0]);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold shrink-0 cursor-pointer transition border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                            >
                                <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                                <span className="text-[10px] tracking-wider">Grade All</span>
                            </button>
                        )}
                    </div>
                    {!loadingPending && pendingPapers.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-center text-zinc-400 text-sm px-10">
                            No papers waiting to be graded. Upload a completed paper to get started.
                        </div>
                    )}
                    <div className="h-[256px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {loadingPending ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-zinc-400">Loading...</p>
                            </div>
                        ) : pendingPapers.length === 0 ? null : (
                            <div className="space-y-4">
                                {(Object.values(
                                    pendingPapers.reduce((groups: Record<string, { dateKey: string; timestamp: number; papers: any[] }>, p) => {
                                        const dateKey = new Date(p.uploadedAt).toLocaleDateString();
                                        if (!groups[dateKey]) {
                                            groups[dateKey] = { dateKey, timestamp: new Date(p.uploadedAt).getTime(), papers: [] };
                                        }
                                        groups[dateKey].papers.push(p);
                                        return groups;
                                    }, {})
                                ) as { dateKey: string; timestamp: number; papers: any[] }[])
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                    .map(group => (
                                        <div key={group.dateKey}>
                                            <h4 className="text-xs font-medium text-zinc-500 mb-2">
                                                Uploaded {group.dateKey}
                                            </h4>
                                            <div className="space-y-2">
                                                {(Object.values(
                                                    group.papers.reduce((batches: Record<string, { groupKey: string; classLabel: { className: string; section: string } | null; papers: any[] }>, p) => {
                                                        const groupKey = getGroupKeyForPaper(p);
                                                        if (!batches[groupKey]) {
                                                            batches[groupKey] = { groupKey, classLabel: getStudentClass(p.studentId), papers: [] };
                                                        }
                                                        batches[groupKey].papers.push(p);
                                                        return batches;
                                                    }, {})
                                                ) as { groupKey: string; classLabel: { className: string; section: string } | null; papers: any[] }[])
                                                    .map(batch => (
                                                        <button
                                                            key={batch.groupKey}
                                                            onClick={() => { setActiveGroupKey(batch.groupKey); openPendingPaper(batch.papers[0]); }}
                                                            className="w-full px-4 py-2 border border-zinc-100 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-zinc-100 dark:hover:bg-slate-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-left flex items-center justify-between gap-2"
                                                        >
                                                            <span className="font-medium text-sm text-zinc-800 dark:text-zinc-100">
                                                                {formatGroupNames(batch.papers)}
                                                            </span>
                                                            {batch.classLabel && (
                                                                <span className="flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 tracking-wider">
                                                                    {batch.classLabel.className}{batch.classLabel.section ? ` - ${batch.classLabel.section}` : ''}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-indigo-500" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Due Today
                            </h3>
                        </div>
                        {dueList.length > 0 && (
                            <button
                                onClick={() => triggerDueBulkGenerate(
                                    'All Classes',
                                    dueClassGroups.flatMap(g => g.students).map(sg => ({ studentId: sg.studentId, studentName: sg.studentName, competencies: sg.competencies }))
                                )}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold shrink-0 cursor-pointer transition border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                            >
                                <Printer className="h-3.5 w-3.5 shrink-0" />
                                <span className="text-[10px] tracking-wider">Generate All</span>
                            </button>
                        )}
                    </div>
                    {!loading && dueList.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-center text-zinc-400 text-sm px-10">
                            Nothing due right now. Generate a new practice paper above to get started.
                        </div>
                    )}
                    <div className="h-[256px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-zinc-400">Loading...</p>
                            </div>
                        ) : dueList.length === 0 ? null : (
                            <div className="space-y-4">
                                {dueClassGroups.map(group => {
                                    const isExpandedForIndividual = expandedIndividualDueClass === group.key;

                                    return (
                                        <div key={group.key}>
                                            <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                                                {group.label}
                                            </h5>
                                            <button
                                                onClick={() => triggerDueBulkGenerate(
                                                    group.label,
                                                    group.students.map(sg => ({ studentId: sg.studentId, studentName: sg.studentName, competencies: sg.competencies }))
                                                )}
                                                className="w-full px-4 py-3 border border-zinc-100 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-zinc-100 dark:hover:bg-slate-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-left space-y-1"
                                            >
                                                {group.students.map(sg => (
                                                    <div key={sg.studentId} className="flex items-center justify-between gap-2">
                                                        <span>
                                                            <span className="font-medium text-sm text-zinc-800 dark:text-zinc-100">{sg.studentName}</span>
                                                            <span className="text-xs text-zinc-600 ml-2">-{sg.competencies.join(', ')}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                                <span className="block pt-1.5 mt-1 border-t border-zinc-200 dark:border-zinc-700 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                                    Generate ({group.students.length} student{group.students.length !== 1 ? 's' : ''})
                                                </span>
                                            </button>
                                            {group.students.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedIndividualDueClass(isExpandedForIndividual ? null : group.key)}
                                                    className="mt-1.5 pl-4 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                                                >
                                                    {isExpandedForIndividual ? 'Hide individual options' : 'Generate Individually'}
                                                </button>
                                            )}
                                            {group.students.length > 1 && isExpandedForIndividual && (
                                                <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-zinc-100 dark:border-zinc-700">
                                                    {group.students.map(sg => (
                                                        <button
                                                            key={sg.studentId}
                                                            onClick={() => triggerDueBulkGenerate(
                                                                sg.studentName,
                                                                [{ studentId: sg.studentId, studentName: sg.studentName, competencies: sg.competencies }]
                                                            )}
                                                            className="w-full px-3 py-1.5 border border-zinc-100 dark:border-zinc-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-slate-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-left flex items-center justify-between gap-2"
                                                        >
                                                            <span>
                                                                <span className="font-medium text-xs text-zinc-800 dark:text-zinc-100">{sg.studentName}</span>
                                                                <span className="text-[11px] text-zinc-600 ml-2">-{sg.competencies.join(', ')}</span>
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Student Progress by Competency
                    </h3>
                </div>

                {loadingProgress ? (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-sm text-zinc-400">Loading...</p>
                    </div>
                ) : progressData.length === 0 ? (
                    <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-center text-zinc-400 text-sm">
                        No completed practice sessions yet. Once a student completes a practice set, their scores will appear here.
                    </div>
                ) : (
                    <StudentProgressChart progressData={progressData} students={students} token={token} />
                )}
            </div>
        </div>
    );
};

// Chart geometry — matches the exported design's coordinate system closely
// so the ported curve-smoothing/gap math lines up 1:1 with its source.
const CHART_W = 760, CHART_H = 262;
const PAD_L = 72, PAD_R = 6, TOP = 30, BOTTOM = 248;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function chartX(i: number, n: number) {
    return n <= 1 ? PAD_L : PAD_L + (i * (CHART_W - PAD_L - PAD_R)) / (n - 1);
}
function chartY(v: number) {
    return BOTTOM - (v / 100) * (BOTTOM - TOP);
}
// Straight point-to-point path — no curve interpolation, so each rendered
// vertex corresponds exactly to a real data point.
function straightPath(pts: [number, number][]): string {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
}
function formatDateLabel(dateKey: string, long?: boolean) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const month = MONTHS[m - 1];
    return long ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

interface StudentProgressChartProps {
    progressData: any[];
    students: any[];
    token: string;
}

// Multi-line score-over-time chart, one line per practiced competency, with
// dashed gap connectors across unattempted sessions. No class-aggregate view.
const StudentProgressChart: React.FC<StudentProgressChartProps> = ({ progressData, students, token }) => {
    const [classKey, setClassKey] = useState<string | null>(null); // null = "All Classes"
    const [studentId, setStudentId] = useState('');
    const [classMenuOpen, setClassMenuOpen] = useState(false);
    const [studentMenuOpen, setStudentMenuOpen] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const getStudentClass = (sid: string) => {
        const s = students.find((x: any) => x.id === sid);
        return s ? { className: s.classGroup || 'Unknown', section: s.section || '' } : null;
    };

    const classOptions = useMemo(() => {
        const map = new Map<string, { key: string; className: string; section: string }>();
        progressData.forEach(p => {
            const cls = getStudentClass(p.studentId);
            if (!cls) return;
            const key = `${cls.className}::${cls.section}`;
            if (!map.has(key)) map.set(key, { key, className: cls.className, section: cls.section });
        });
        return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section));
    }, [progressData, students]);

    const visibleStudents = useMemo(() => {
        let list = progressData;
        if (classKey) {
            list = list.filter(p => {
                const cls = getStudentClass(p.studentId);
                return cls && `${cls.className}::${cls.section}` === classKey;
            });
        }
        return [...list].sort((a, b) => a.studentName.localeCompare(b.studentName));
    }, [progressData, classKey, students]);

    // Keeps the current selection if it's still valid under the active class
    // filter, otherwise falls back to the first visible student — mirrors the
    // exported design's pickClass behavior.
    const effectiveStudentId = useMemo(() => {
        if (studentId && visibleStudents.some(s => s.studentId === studentId)) return studentId;
        return visibleStudents[0]?.studentId || '';
    }, [studentId, visibleStudents]);

    const currentStudent = visibleStudents.find(s => s.studentId === effectiveStudentId) || null;
    const currentClass = effectiveStudentId ? getStudentClass(effectiveStudentId) : null;

    useEffect(() => {
        if (!effectiveStudentId) { setHistory([]); return; }
        let cancelled = false;
        setHistoryLoading(true);
        apiFetch(`/api/practice/history/${effectiveStudentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => { if (!cancelled) setHistory(Array.isArray(data) ? data : []); })
            .catch(err => { console.error('Failed to fetch student history:', err); if (!cancelled) setHistory([]); })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });
        return () => { cancelled = true; };
    }, [effectiveStudentId, token]);

    // Shared X-axis: sorted union of practice dates; a series is null on
    // dates its competency wasn't practiced, producing the gap connectors.
    const { dateKeys, seriesByCompetency } = useMemo(() => {
        const dateKeySet = new Set<string>();
        history.forEach(h => dateKeySet.add(h.completedAt.slice(0, 10)));
        const dateKeys = Array.from(dateKeySet).sort();

        const byCompetency = new Map<string, Map<string, number>>();
        history.forEach(h => {
            const dateKey = h.completedAt.slice(0, 10);
            if (!byCompetency.has(h.competency)) byCompetency.set(h.competency, new Map());
            byCompetency.get(h.competency)!.set(dateKey, h.scorePercent);
        });

        return { dateKeys, seriesByCompetency: byCompetency };
    }, [history]);

    const n = dateKeys.length;

    const renderSeries = useMemo(() => {
        return ALL_COMPETENCIES.filter(name => seriesByCompetency.has(name)).map(name => {
            const scoreMap = seriesByCompetency.get(name)!;
            const values = dateKeys.map(dk => (scoreMap.has(dk) ? scoreMap.get(dk)! : null));
            const color = COMPETENCY_COLORS[name] || { line: '#6366F1', dot: '#818cf8' };

            const idx: number[] = [];
            values.forEach((v, i) => { if (v !== null) idx.push(i); });
            const runs: number[][] = [];
            idx.forEach(i => {
                const last = runs[runs.length - 1];
                if (last && i === last[last.length - 1] + 1) last.push(i); else runs.push([i]);
            });

            const solids: string[] = [];
            const areas: string[] = [];
            runs.forEach(run => {
                if (run.length < 2) return;
                const pts: [number, number][] = run.map(i => [chartX(i, n), chartY(values[i]!)]);
                const d = straightPath(pts);
                solids.push(d);
                areas.push(`${d} L ${pts[pts.length - 1][0]} ${BOTTOM} L ${pts[0][0]} ${BOTTOM} Z`);
            });

            // Gaps connect adjacent runs with a straight dashed segment; both
            // endpoints are real data points, only the stretch between isn't.
            const gaps: string[] = [];
            const gapAreas: string[] = [];
            for (let r = 0; r < runs.length - 1; r++) {
                const a = runs[r][runs[r].length - 1], b = runs[r + 1][0];
                const ax = chartX(a, n), ay = chartY(values[a]!);
                const bx = chartX(b, n), by = chartY(values[b]!);
                gaps.push(`M ${ax} ${ay} L ${bx} ${by}`);
                gapAreas.push(`M ${ax} ${ay} L ${bx} ${by} L ${bx} ${BOTTOM} L ${ax} ${BOTTOM} Z`);
            }

            return { name, values, color, solids, areas, gaps, gapAreas, gradId: `mpg-${name.replace(/\s+/g, '')}` };
        });
    }, [dateKeys, seriesByCompetency, n]);

    const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (n === 0) return;
        const box = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - box.left) / box.width) * CHART_W;
        if (px < PAD_L - 12) { setHoverIndex(null); return; }
        const step = (CHART_W - PAD_L - PAD_R) / Math.max(1, n - 1);
        const i = Math.max(0, Math.min(n - 1, Math.round((px - PAD_L) / step)));
        setHoverIndex(i);
    };
    const handleLeave = () => setHoverIndex(null);

    const hovering = hoverIndex !== null && n > 0;
    const cursorX = hovering ? chartX(hoverIndex!, n) : 0;
    const leftPct = hovering ? (cursorX / CHART_W) * 100 : 0;
    const flip = leftPct > 62;
    const tipRows = hovering
        ? renderSeries.filter(s => s.values[hoverIndex!] !== null).map(s => ({ name: s.name, value: `${s.values[hoverIndex!]}%`, color: s.color.dot }))
        : [];
    const cursorDots = hovering
        ? renderSeries.filter(s => s.values[hoverIndex!] !== null).map(s => ({ x: cursorX, y: chartY(s.values[hoverIndex!]!), color: s.color.line }))
        : [];

    const step = n > 1 ? (CHART_W - PAD_L - PAD_R) / (n - 1) : 0;
    const skip = step < 62 ? 2 : 1;
    const xLabels = dateKeys.map((dk, i) => ({
        label: i % skip === 0 || i === n - 1 ? formatDateLabel(dk) : '',
        leftPct: (chartX(i, n) / CHART_W) * 100
    }));

    const selectedClassLabel = classKey ? classOptions.find(c => c.key === classKey) : null;

    return (
        <div>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
                    {currentStudent
                        ? `${currentStudent.studentName} · ${currentClass ? `${currentClass.className}${currentClass.section ? ` - ${currentClass.section}` : ''}` : 'Unknown class'} · ${n} practice session${n !== 1 ? 's' : ''} · ${renderSeries.length} competenc${renderSeries.length !== 1 ? 'ies' : 'y'}`
                        : 'No students with practice history'}
                </p>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => { setClassMenuOpen(o => !o); setStudentMenuOpen(false); }}
                            className="flex items-center gap-2 min-w-[120px] text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-zinc-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-600"
                        >
                            <span className="flex-1 text-left truncate">
                                {selectedClassLabel ? `${selectedClassLabel.className}${selectedClassLabel.section ? ` - ${selectedClassLabel.section}` : ''}` : 'All Classes'}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        </button>
                        {classMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setClassMenuOpen(false)} />
                                <div className="absolute left-0 top-full mt-1 min-w-full w-max bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden p-1">
                                    <button
                                        onClick={() => { setClassKey(null); setClassMenuOpen(false); }}
                                        className={`w-full text-left px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${!classKey ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                    >
                                        All Classes
                                    </button>
                                    {classOptions.map(c => (
                                        <button
                                            key={c.key}
                                            onClick={() => { setClassKey(c.key); setClassMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${classKey === c.key ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            {c.className}{c.section ? ` - ${c.section}` : ''}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => { setStudentMenuOpen(o => !o); setClassMenuOpen(false); }}
                            className="flex items-center gap-2 min-w-[140px] text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-zinc-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-600"
                        >
                            <span className="flex-1 text-left truncate">{currentStudent?.studentName || 'Select student'}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        </button>
                        {studentMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setStudentMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-1 inline-block max-h-64 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 p-1">
                                    {visibleStudents.map(s => (
                                        <button
                                            key={s.studentId}
                                            onClick={() => { setStudentId(s.studentId); setStudentMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${effectiveStudentId === s.studentId ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            {s.studentName}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {renderSeries.length > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
                    {renderSeries.map(s => (
                        <div key={s.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color.dot }} />
                            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-300">{s.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {historyLoading ? (
                <div className="flex items-center justify-center p-8">
                    <p className="text-sm text-zinc-400">Loading...</p>
                </div>
            ) : n === 0 ? (
                <p className="text-sm text-zinc-400">No practice history found for this student.</p>
            ) : (
                <div className="relative max-w-[90%] mx-auto">
                    <svg
                        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                        className="w-full"
                        style={{ display: 'block', overflow: 'visible' }}
                        onMouseMove={handleMove}
                        onMouseLeave={handleLeave}
                    >
                        <defs>
                            {renderSeries.map(s => (
                                <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={s.color.line} stopOpacity="0.5" />
                                    <stop offset="100%" stopColor={s.color.line} stopOpacity="0.03" />
                                </linearGradient>
                            ))}
                        </defs>

                        <g stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" strokeWidth="1" strokeDasharray="2 7" strokeLinecap="round">
                            {[100, 70, 30, 0].map(v => (
                                <line key={v} x1={PAD_L} y1={chartY(v)} x2={CHART_W - PAD_R} y2={chartY(v)} />
                            ))}
                        </g>
                        <line x1={PAD_L} y1={TOP - 6} x2={PAD_L} y2={BOTTOM + 6} stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" strokeWidth="1.5" />

                        <g className="fill-zinc-500 dark:fill-zinc-400" fontSize="12" fontWeight="600" textAnchor="end">
                            {[100, 70, 30, 0].map(v => (
                                <text key={v} x={PAD_L - 16} y={chartY(v) + 4}>{v}%</text>
                            ))}
                        </g>

                        <g>
                            {renderSeries.map(s => s.areas.map((a, i) => (
                                <path key={`${s.name}-area-${i}`} d={a} fill={`url(#${s.gradId})`} />
                            )))}
                            {renderSeries.map(s => s.gapAreas.map((a, i) => (
                                <path key={`${s.name}-gaparea-${i}`} d={a} fill={`url(#${s.gradId})`} />
                            )))}
                        </g>
                        <g style={{ mixBlendMode: 'multiply' }}>
                            {renderSeries.map(s => s.gaps.map((g, i) => (
                                <path key={`${s.name}-gap-${i}`} d={g} fill="none" stroke={s.color.line} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 8" opacity="0.5" />
                            )))}
                            {renderSeries.map(s => s.solids.map((sol, i) => (
                                <path key={`${s.name}-solid-${i}`} d={sol} fill="none" stroke={s.color.line} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            )))}
                        </g>

                        {hovering && (
                            <g>
                                <line x1={cursorX} y1={TOP - 6} x2={cursorX} y2={BOTTOM + 6} stroke="currentColor" className="text-zinc-300 dark:text-zinc-600" strokeWidth="1.5" strokeDasharray="4 5" />
                                {cursorDots.map((d, i) => (
                                    <circle key={i} cx={d.x} cy={d.y} r="4" fill="white" className="dark:fill-slate-900" stroke={d.color} strokeWidth="2.5" />
                                ))}
                            </g>
                        )}
                    </svg>

                    <div className="relative h-5 mt-2">
                        {xLabels.map((l, i) => l.label && (
                            <div
                                key={i}
                                className="absolute top-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
                                style={{ left: `${l.leftPct}%`, transform: 'translateX(-50%)' }}
                            >
                                {l.label}
                            </div>
                        ))}
                    </div>

                    {hovering && (
                        <div
                            className="absolute top-0 min-w-[180px] bg-white dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-3 shadow-xl pointer-events-none"
                            style={{ left: `${leftPct}%`, transform: `translateX(${flip ? '-108%' : '8%'})` }}
                        >
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                                {formatDateLabel(dateKeys[hoverIndex!], true)}
                            </div>
                            <div className="space-y-1">
                                {tipRows.map(r => (
                                    <div key={r.name} className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300">{r.name}</span>
                                        <span className="text-xs font-bold text-zinc-900 dark:text-white ml-auto pl-3">{r.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
