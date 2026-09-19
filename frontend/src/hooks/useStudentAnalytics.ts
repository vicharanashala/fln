import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/apiClient';

export interface TeacherClass {
    id: string;
    className: string;
    section: string;
    schoolId: string;
    teacherId: string;
}

export interface CompetencyAnalytics {
    name: string;
    assessedStudents: number;
    masteryPct: number;
    satisfactoryPct: number;
    needsPracticePct: number;
}

export interface ProgressPoint {
    cycle: string;
    masteryPct: number;
    assessedStudents: number;
}

export interface TeacherAnalytics {
    classId: string;
    className: string;
    section: string;
    totalStudents: number;
    totalAssessed: number;
    overallMastery: number;
    competencies: CompetencyAnalytics[];
    priorityGaps: CompetencyAnalytics[];
    progress: ProgressPoint[];
}

export const useStudentAnalytics = () => {
    const [classes, setClasses] = useState<TeacherClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedCompetency, setSelectedCompetency] = useState('all');
    const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadClasses = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await apiFetch('/api/classes');
                if (!response.ok) throw new Error('Unable to load classes.');

                const data = await response.json();
                if (!Array.isArray(data)) throw new Error('Invalid class data received.');

                if (!cancelled) {
                    setClasses(data);
                    setSelectedClassId((current) =>
                        data.some((cls: TeacherClass) => cls.id === current)
                            ? current
                            : (data[0]?.id ?? '')
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Unable to load classes.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadClasses();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selectedClassId) {
            setAnalytics(null);
            return;
        }

        let cancelled = false;

        const loadAnalytics = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await apiFetch(
                    `/api/classes/${encodeURIComponent(selectedClassId)}/teacher-analytics`
                );
                if (!response.ok) throw new Error('Unable to load class analytics.');

                const data = await response.json();
                if (!cancelled) {
                    setAnalytics(data);
                    setSelectedCompetency('all');
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Unable to load analytics.');
                    setAnalytics(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadAnalytics();
        return () => {
            cancelled = true;
        };
    }, [selectedClassId]);

    const visibleCompetencies = useMemo(() => {
        if (!analytics) return [];
        if (selectedCompetency === 'all') return analytics.competencies;
        return analytics.competencies.filter((item) => item.name === selectedCompetency);
    }, [analytics, selectedCompetency]);

    return {
        classes,
        selectedClassId,
        setSelectedClassId,
        selectedCompetency,
        setSelectedCompetency,
        analytics,
        visibleCompetencies,
        loading,
        error,
    };
};
