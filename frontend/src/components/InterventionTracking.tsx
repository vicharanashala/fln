import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { Pencil, Trash2 } from 'lucide-react';

interface InterventionOutcome {
    improved: boolean;
    previousLevel: number;
    newLevel: number;
    improvementDetails: string;
    assessmentId: string;
    detectedAt: string;
}

interface Intervention {
    id: string;
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    schoolId: string;
    classId: string;
    className: string;
    section: string;
    weakCompetencies: string[];
    currentLevel: number;
    strategyType: string;
    strategyDescription: string;
    duration: string;
    startDate: string;
    endDate?: string;
    status: 'active' | 'completed' | 'pending_review';
    outcome?: InterventionOutcome;
    isPromoted: boolean;
    promotedAt?: string;
    createdAt: string;
    teacherNotes?: string;
    linkedWorksheetIds?: string[];
}

interface Props {
    token: string;
    userRole: UserRole;
    onSelectView: (view: string) => void;
}

function getDaysRemaining(startDate: string, duration: string): number {
    const match = duration.match(/(\d+)\s*(day|week|month)/i);
    let durationDays = 14;
    if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit === 'day') durationDays = num;
        else if (unit === 'week') durationDays = num * 7;
        else if (unit === 'month') durationDays = num * 30;
    }
    const start = new Date(startDate);
    const due = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export const InterventionTracking: React.FC<Props> = ({ token, userRole, onSelectView }) => {
    const [interventions, setInterventions] = useState<Intervention[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingNotes, setEditingNotes] = useState<string | null>(null); // holds intervention id being edited
    const [noteDraft, setNoteDraft] = useState('');
    const [showSuggestions, setShowSuggestions] = useState<string | null>(null); // holds intervention id
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [viewingWorksheet, setViewingWorksheet] = useState<any | null>(null);
    const [loadingWorksheetView, setLoadingWorksheetView] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [classStudents, setClassStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        weakCompetencies: '',
        strategyType: 'visual_aids',
        strategyDescription: '',
        duration: '2 weeks'
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [result, setResult] = useState<{ created: number; skipped: any[] } | null>(null);
    const fetchInterventions = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/interventions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setInterventions(data);
            }
        } catch (err) {
            console.error('Failed to fetch interventions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateIntervention = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedStudentIds.length === 0) {
            setFormError('Please select at least one student.');
            return;
        }
        if (!formData.weakCompetencies || !formData.strategyDescription) {
            setFormError('Please fill in weak competencies and strategy description.');
            return;
        }
        setFormError('');
        setSubmitting(true);

        try {
            const res = await apiFetch('/api/interventions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentIds: selectedStudentIds,
                    weakCompetencies: formData.weakCompetencies.split(',').map(c => c.trim()),
                    strategyType: formData.strategyType,
                    strategyDescription: formData.strategyDescription,
                    duration: formData.duration
                })
            });
            const data = await res.json();
            if (res.ok) {
                setResult({ created: data.created, skipped: data.skipped });
                setSelectedStudentIds([]);
                setFormData({ weakCompetencies: '', strategyType: 'visual_aids', strategyDescription: '', duration: '2 weeks' });
                fetchInterventions();
            } else {
                setFormError(data.error || 'Failed to create bulk interventions.');
            }
        } catch (err) {
            setFormError('Network error creating intervention.');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePromote = async (interventionId: string) => {
        try {
            const res = await apiFetch(`/api/interventions/${interventionId}/promote`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchInterventions();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to promote intervention.');
            }
        } catch (err) {
            alert('Network error promoting intervention.');
        }
    };

    const handleTriggerReassessment = async (interventionId: string) => {
        try {
            const res = await apiFetch(`/api/interventions/${interventionId}/trigger-reassessment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchInterventions();
            } else {
                alert(data.error || 'Failed to trigger reassessment.');
            }
        } catch (err) {
            alert('Network error triggering reassessment.');
        }
    };

    const handleSaveNote = async (interventionId: string) => {
        try {
            const res = await apiFetch(`/api/interventions/${interventionId}/notes`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ teacherNotes: noteDraft })
            });
            if (res.ok) {
                setEditingNotes(null);
                fetchInterventions();
            }
        } catch (err) {
            console.error('Failed to save note:', err);
        }
    };

    const handleDeleteIntervention = async (interventionId: string, status: string) => {
        const confirmMessage = status === 'completed'
            ? 'This intervention has been completed and may have real outcome data. Are you sure you want to delete it?'
            : 'Are you sure you want to delete this intervention?';

        if (!window.confirm(confirmMessage)) return;

        try {
            const res = await apiFetch(`/api/interventions/${interventionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchInterventions();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete intervention.');
            }
        } catch (err) {
            alert('Network error deleting intervention.');
        }
    };

    const fetchSuggestions = async (interventionId: string) => {
        setLoadingSuggestions(true);
        setShowSuggestions(interventionId);
        try {
            const res = await apiFetch(`/api/interventions/${interventionId}/suggested-worksheets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleLinkWorksheet = async (interventionId: string, worksheetId: string, action: 'link' | 'unlink') => {
        try {
            await apiFetch(`/api/interventions/${interventionId}/linked-worksheets`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ worksheetId, action })
            });
            fetchSuggestions(interventionId); // refresh to update "already linked" state
            fetchInterventions();
        } catch (err) {
            console.error('Failed to link worksheet:', err);
        }
    };

    const handleViewWorksheet = async (worksheetId: string) => {
        setLoadingWorksheetView(true);
        try {
            const res = await apiFetch(`/api/worksheets/${worksheetId}/view`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setViewingWorksheet(data);
        } catch (err) {
            console.error('Failed to load worksheet:', err);
        } finally {
            setLoadingWorksheetView(false);
        }
    };

    const fetchClassStudents = async () => {
        try {
            const res = await apiFetch('/api/students', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setClassStudents(data);
        } catch (err) {
            console.error('Failed to fetch students:', err);
        }
    };

    const toggleCreateForm = () => {
        if (!showCreateForm) fetchClassStudents();
        setShowCreateForm(!showCreateForm);
        setResult(null);
    };

    const toggleStudentSelection = (studentId: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    useEffect(() => {
        fetchInterventions();
    }, [token]);

    const strategyLabels: Record<string, string> = {
        small_group: 'Small Group',
        one_on_one: 'One-on-One',
        peer_tutoring: 'Peer Tutoring',
        visual_aids: 'Visual Aids',
        manipulatives: 'Manipulatives',
        worksheets: 'Worksheets',
        game_based: 'Game-Based',
        other: 'Other'
    };

    if (loading) return <div className="text-sm text-slate-400 p-6">Loading interventions...</div>;

    return (
        <div className="space-y-6">
            <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">
                        Intervention Tracking
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        Structured remedial plans for struggling students
                    </p>
                </div>
                {userRole === UserRole.TEACHER && (
                    <button
                        onClick={toggleCreateForm}
                        className="bg-indigo-600 text-white font-medium text-xs py-1.5 px-3 rounded-md hover:bg-indigo-700">
                        {showCreateForm ? 'Cancel' : '+ New Intervention'}
                    </button>
                )}
            </div>
            {showCreateForm && (
                <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white mb-4">
                            Create New Intervention
                        </h3>
                        <button
                            type="button"
                            onClick={() => onSelectView('best-practices')}
                            className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            📖 Browse Best Practices for inspiration →
                        </button>
                    </div>
                    <form onSubmit={handleCreateIntervention} className="space-y-4">
                        {formError && (
                            <div className="p-3 text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded border border-red-100 dark:border-red-800">
                                {formError}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">
                                Select Students ({selectedStudentIds.length} selected)
                            </label>
                            <div className="max-h-40 overflow-y-auto border border-zinc-200 rounded-lg p-2 space-y-1">
                                {classStudents.length === 0 ? (
                                    <p className="text-xs text-zinc-400 p-2">Loading students...</p>
                                ) : (
                                    classStudents.map(student => (
                                        <label key={student.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-zinc-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedStudentIds.includes(student.id)}
                                                onChange={() => toggleStudentSelection(student.id)}
                                            />
                                            <span>{student.name} — {student.classGroup} {student.section} (L{student.currentLevel})</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">
                                Weak Competencies (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={formData.weakCompetencies}
                                onChange={(e) => setFormData({ ...formData, weakCompetencies: e.target.value })}
                                placeholder="e.g. Fractions, Number Sense"
                                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white outline-none focus:border-zinc-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">
                                Strategy Type
                            </label>
                            <select
                                value={formData.strategyType}
                                onChange={(e) => setFormData({ ...formData, strategyType: e.target.value })}
                                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-zinc-500"
                            >
                                <option value="small_group">Small Group</option>
                                <option value="one_on_one">One-on-One</option>
                                <option value="peer_tutoring">Peer Tutoring</option>
                                <option value="visual_aids">Visual Aids</option>
                                <option value="manipulatives">Manipulatives</option>
                                <option value="worksheets">Worksheets</option>
                                <option value="game_based">Game-Based</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">
                                Strategy Description
                            </label>
                            <textarea
                                value={formData.strategyDescription}
                                onChange={(e) => setFormData({ ...formData, strategyDescription: e.target.value })}
                                rows={3}
                                placeholder="Describe the plan..."
                                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white outline-none focus:border-zinc-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-1">
                                Duration
                            </label>
                            <select
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-zinc-500"
                            >
                                <option value="1 week">1 week</option>
                                <option value="2 weeks">2 weeks</option>
                                <option value="3 weeks">3 weeks</option>
                                <option value="1 month">1 month</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-zinc-900 text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
                        >
                            {submitting ? 'Creating...' : `Create ${selectedStudentIds.length || ''} Intervention(s)`}
                        </button>
                    </form>
                </div>
            )}
            {interventions.length === 0 ? (
                <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                    No interventions found.
                </div>
            ) : (
                <div className="space-y-3">
                    {interventions.map(intv => (
                        <div key={intv.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">

                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${intv.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                            intv.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {intv.status}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                                            {strategyLabels[intv.strategyType] || intv.strategyType}
                                        </span>
                                        {intv.isPromoted && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-100 text-amber-800">
                                                ⭐ Best Practice
                                            </span>
                                        )}
                                        {intv.status === 'active' && getDaysRemaining(intv.startDate, intv.duration) <= 0 && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-100 text-orange-700">
                                                ⏰ Reassessment Due
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-display font-medium text-zinc-900 dark:text-white">
                                        {intv.studentName} — {intv.className} {intv.section}
                                    </h4>
                                    <div className="flex gap-1.5 mt-1">
                                        {intv.weakCompetencies.map(comp => (
                                            <span key={comp} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">
                                                {comp}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-zinc-400">
                                        Started {new Date(intv.startDate).toLocaleDateString()}
                                    </span>
                                    {(userRole === UserRole.TEACHER && intv.teacherId) && (
                                        <button
                                            onClick={() => handleDeleteIntervention(intv.id, intv.status)}
                                            className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                                            title="Delete this intervention"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                                {intv.strategyDescription}
                            </p>

                            <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-700 text-[10px] text-zinc-400">
                                <div>
                                    Duration: <span className="font-medium text-zinc-700 dark:text-zinc-200">{intv.duration}</span>
                                    {' · '}
                                    By: <span className="font-medium text-zinc-700 dark:text-zinc-200">{intv.teacherName}</span>
                                </div>
                                {intv.status === 'active' && (() => {
                                    const daysLeft = getDaysRemaining(intv.startDate, intv.duration);
                                    if (daysLeft > 0) {
                                        return <span className="text-zinc-400 font-mono">{daysLeft}d until reassessment</span>;
                                    }
                                    return (
                                        <button
                                            onClick={() => handleTriggerReassessment(intv.id)}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2 py-1 rounded"
                                        >
                                            Trigger Reassessment
                                        </button>
                                    );
                                })()}
                            </div>

                            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-700">
                                {editingNotes === intv.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={noteDraft}
                                            onChange={(e) => setNoteDraft(e.target.value)}
                                            rows={2}
                                            placeholder="e.g. Student is improving. Still struggles with long paragraphs."
                                            className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white outline-none focus:border-zinc-500"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSaveNote(intv.id)}
                                                className="text-[10px] font-bold bg-zinc-900 text-white px-2 py-1 rounded hover:bg-zinc-700"
                                            >
                                                Save Note
                                            </button>
                                            <button
                                                onClick={() => setEditingNotes(null)}
                                                className="rounded bg-zinc-200 px-4 py-1.5 text-[10px] font-bold text-zinc-500 transition-all duration-200 hover:bg-zinc-900 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1">
                                            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Teacher Notes</span>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                                                {intv.teacherNotes || <span className="italic text-zinc-400">No notes yet.</span>}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setEditingNotes(intv.id);
                                                setNoteDraft(intv.teacherNotes || '');
                                            }}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline shrink-0"
                                        >
                                            {intv.teacherNotes ? (
                                                <>
                                                    <Pencil size={12} />
                                                    Edit
                                                </>
                                            ) : (
                                                '+ Add Note'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {intv.linkedWorksheetIds && intv.linkedWorksheetIds.length > 0 && (
                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700">
                                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                        Linked Worksheets ({intv.linkedWorksheetIds.length})
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {intv.linkedWorksheetIds.map(wsId => (
                                            <button
                                                key={wsId}
                                                onClick={() => handleViewWorksheet(wsId)}
                                                className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100"
                                            >
                                                📄 {wsId}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    onClick={() => showSuggestions === intv.id ? setShowSuggestions(null) : fetchSuggestions(intv.id)}
                                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                                >
                                    {showSuggestions === intv.id ? '▲ Hide Suggested Worksheets' : '📄 Find Matching Worksheets'}
                                </button>

                                {showSuggestions === intv.id && (
                                    <div className="mt-2 space-y-1.5">
                                        {loadingSuggestions ? (
                                            <p className="text-[10px] text-zinc-400">Finding matches...</p>
                                        ) : suggestions.length === 0 ? (
                                            <p className="text-[10px] text-zinc-400 italic">No matching worksheets found for these competencies.</p>
                                        ) : (

                                            suggestions.map(sug => (
                                                <div key={sug.worksheetId} className="flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded p-2">
                                                    <div>
                                                        <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                                            {sug.className} {sug.section} · {sug.cycle}
                                                        </span>
                                                        <span className="ml-2 text-[10px] font-mono text-indigo-600">
                                                            {sug.matchScore}% match ({sug.matchingQuestionsCount}/{sug.totalQuestions} questions)
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-7">
                                                        <button
                                                            onClick={() => handleViewWorksheet(sug.worksheetId)}
                                                            className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                                                        >
                                                            👁 View
                                                        </button>
                                                        <div className="min-w-[72px] flex justify-center">
                                                            <button
                                                                onClick={() => handleLinkWorksheet(
                                                                    intv.id,
                                                                    sug.worksheetId,
                                                                    sug.alreadyLinked ? "unlink" : "link"
                                                                )}
                                                                className={`text-[10px] font-bold px-2 py-1 rounded ${sug.alreadyLinked
                                                                    ? "bg-zinc-200 text-zinc-600"
                                                                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                                                    }`}
                                                            >
                                                                {sug.alreadyLinked ? "Linked ✓" : "Link"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))

                                        )}
                                    </div>
                                )}
                            </div>

                            {intv.status === 'completed' && intv.outcome && (
                                <div className={`p-3 rounded-lg text-xs ${intv.outcome.improved
                                    ? 'bg-green-50 border border-green-200 text-green-800'
                                    : 'bg-red-50 border border-red-200 text-red-800'
                                    }`}>
                                    <div className="font-bold mb-1">
                                        {intv.outcome.improved ? '✓ Improved' : '✗ No Improvement Detected'}
                                        {' — '}Level {intv.outcome.previousLevel} → {intv.outcome.newLevel}
                                    </div>
                                    <p className="leading-relaxed">{intv.outcome.improvementDetails}</p>
                                    {intv.outcome.improved && !intv.isPromoted && userRole === UserRole.TEACHER && (
                                        <button
                                            onClick={() => handlePromote(intv.id)}
                                            className="mt-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] font-mono px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            ⭐ Promote to Best Practice
                                        </button>
                                    )}
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            )}

            {viewingWorksheet && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingWorksheet(null)}>
                    <div
                        className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {viewingWorksheet.className} {viewingWorksheet.section} — {viewingWorksheet.cycle}
                                </h3>
                                <p className="text-xs text-zinc-400">{viewingWorksheet.id} · {viewingWorksheet.date}</p>
                            </div>
                            <button
                                onClick={() => setViewingWorksheet(null)}
                                className="text-zinc-400 hover:text-zinc-700 font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            {viewingWorksheet.questions.map((q: any, idx: number) => (
                                <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                            {q.topic} {q.subtopic ? `· ${q.subtopic}` : ''}
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-400 uppercase">{q.difficulty}</span>
                                    </div>
                                    <p className="text-sm text-zinc-800 dark:text-zinc-100 whitespace-normal break-words leading-relaxed">{q.question.replace(/^\[For.*?\]\s*/, '')}</p>
                                    <p className="text-xs text-emerald-600 mt-1">Answer: {q.answer}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};