import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';

interface BestPractice {
    id: string;
    interventionId: string;
    teacherId: string;
    teacherName: string;
    schoolId: string;
    weakCompetencies: string[];
    strategyType: string;
    strategyDescription: string;
    levelBefore: number;
    levelAfter: number;
    levelJump: number;
    duration: string;
    tags: string[];
    viewCount: number;
    createdAt: string;
    linkedWorksheetIds?: string[];
}

interface Props {
    token: string;
}

export const BestPractices: React.FC<Props> = ({ token }) => {
    const [practices, setPractices] = useState<BestPractice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [strategyFilter, setStrategyFilter] = useState('');
    const [sortBy, setSortBy] = useState('');
    const [viewingWorksheet, setViewingWorksheet] = useState<any | null>(null);

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

    const fetchPractices = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (strategyFilter) params.append('strategy', strategyFilter);
            if (sortBy) params.append('sort', sortBy);

            const res = await apiFetch(`/api/best-practices?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setPractices(data);
            }
        } catch (err) {
            console.error('Failed to fetch best practices:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewWorksheet = async (worksheetId: string) => {
        try {
            const res = await apiFetch(`/api/worksheets/${worksheetId}/view`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setViewingWorksheet(data);
        } catch (err) {
            console.error('Failed to load worksheet:', err);
        }
    };

    useEffect(() => {
        fetchPractices();
    }, [token, strategyFilter, sortBy]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPractices();
    };

    return (
        <div className="space-y-6">
            <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
                <h2 className="text-2xl font-display font-semibold text-zinc-900 dark:text-white">
                    Best Practices Repository
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                    Proven strategies from teachers across the system, backed by confirmed student improvement
                </p>
            </div>

            {/* Search and filters */}
            <div className="bg-white dark:bg-slate-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
                <form onSubmit={handleSearchSubmit} className="flex gap-3">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by competency, teacher, or keyword..."
                        className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-zinc-900 dark:text-white outline-none focus:border-zinc-500"
                    />
                    <button
                        type="submit"
                        className="bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-700"
                    >
                        Search
                    </button>
                </form>

                <div className="flex gap-3">
                    <select
                        value={strategyFilter}
                        onChange={(e) => setStrategyFilter(e.target.value)}
                        className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                    >
                        <option value="">All Strategies</option>
                        <option value="small_group">Small Group</option>
                        <option value="one_on_one">One-on-One</option>
                        <option value="peer_tutoring">Peer Tutoring</option>
                        <option value="visual_aids">Visual Aids</option>
                        <option value="manipulatives">Manipulatives</option>
                        <option value="worksheets">Worksheets</option>
                        <option value="game_based">Game-Based</option>
                        <option value="other">Other</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                    >
                        <option value="">Newest First</option>
                        <option value="level_jump">Biggest Level Jump</option>
                    </select>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="text-sm text-slate-400 p-6">Loading best practices...</div>
            ) : practices.length === 0 ? (
                <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                    No best practices found matching your search.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {practices.map(bp => (
                        <div key={bp.id} className="bg-white dark:bg-slate-900 p-5 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 uppercase">
                                    {strategyLabels[bp.strategyType] || bp.strategyType}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                    👁 {bp.viewCount} views
                                </span>
                            </div>

                            <div className="flex gap-1.5 flex-wrap">
                                {bp.weakCompetencies.map(comp => (
                                    <span key={comp} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                        {comp}
                                    </span>
                                ))}
                            </div>

                            <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                                {bp.strategyDescription}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-700">
                                <div className="text-[10px] text-zinc-400">
                                    By <span className="font-medium text-zinc-700 dark:text-zinc-200">{bp.teacherName}</span>
                                    {' · '}{bp.duration}
                                </div>
                                <div className="bg-green-50 border border-green-200 text-green-800 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                                    📈 Level {bp.levelBefore} → {bp.levelAfter} (+{bp.levelJump})
                                </div>
                            </div>
                            {bp.linkedWorksheetIds && bp.linkedWorksheetIds.length > 0 && (
                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700">
                                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                        Worksheets Used
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {bp.linkedWorksheetIds.map(wsId => (
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