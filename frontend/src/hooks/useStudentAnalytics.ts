import { useState, useMemo } from 'react';

export interface Student {
    id: string;
    name: string;
    grade: number;
    attendancePct: number;
    scores: Record<number, number>;
}

// Embedded baseline diagnostic data for FLN assessments
const DEFAULT_STUDENTS: Student[] = [
    { id: 'STU-101', name: 'Aarav Sharma', grade: 1, attendancePct: 92, scores: { 10: 85, 16: 40, 25: 60, 31: 45 } },
    { id: 'STU-102', name: 'Ananya Verma', grade: 1, attendancePct: 88, scores: { 10: 90, 16: 80, 25: 75, 31: 70 } },
    { id: 'STU-103', name: 'Rohan Gupta', grade: 1, attendancePct: 65, scores: { 10: 45, 16: 35, 25: 50, 31: 30 } },
    { id: 'STU-104', name: 'Priya Singh', grade: 2, attendancePct: 95, scores: { 10: 100, 16: 90, 25: 88, 31: 92 } },
    { id: 'STU-105', name: 'Kabir Das', grade: 2, attendancePct: 70, scores: { 10: 60, 16: 45, 25: 65, 31: 50 } },
    { id: 'STU-106', name: 'Diya Patel', grade: 2, attendancePct: 85, scores: { 10: 75, 16: 82, 25: 70, 31: 78 } },
    { id: 'STU-107', name: 'Manish Kumar', grade: 3, attendancePct: 58, scores: { 10: 50, 16: 30, 25: 40, 31: 35 } },
    { id: 'STU-108', name: 'Sneha Roy', grade: 3, attendancePct: 94, scores: { 10: 95, 16: 88, 25: 92, 31: 85 } },
    { id: 'STU-109', name: 'Vihaan Joshi', grade: 3, attendancePct: 82, scores: { 10: 80, 16: 65, 25: 60, 31: 58 } },
    { id: 'STU-110', name: 'Ishaan Ali', grade: 3, attendancePct: 76, scores: { 10: 70, 16: 48, 25: 55, 31: 40 } }
];

export const useStudentAnalytics = () => {
    const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
    const [selectedLevel, setSelectedLevel] = useState<number>(16);

    const filteredStudents = useMemo(() => {
        return DEFAULT_STUDENTS.filter((s) => {
            if (selectedGrade === 'all') return true;
            return s.grade === selectedGrade;
        });
    }, [selectedGrade]);

    const distributionData = useMemo(() => {
        let remedial = 0;
        let progressing = 0;
        let proficient = 0;

        filteredStudents.forEach((student) => {
            const score = student.scores?.[selectedLevel] ?? 0;
            if (score < 50) remedial++;
            else if (score < 75) progressing++;
            else proficient++;
        });

        return [
            { name: 'Needs Help (<50%)', count: remedial, fill: '#ef4444' },
            { name: 'Progressing (50–74%)', count: progressing, fill: '#f59e0b' },
            { name: 'Proficient (≥75%)', count: proficient, fill: '#10b981' }
        ];
    }, [filteredStudents, selectedLevel]);

    const correlationData = useMemo(() => {
        return filteredStudents.map((s) => {
            const scoreValues = Object.values(s.scores || {});
            const totalScore = scoreValues.reduce((a, b) => a + b, 0);
            const avgScore = scoreValues.length ? Math.round(totalScore / scoreValues.length) : 0;
            return {
                name: s.name,
                attendance: s.attendancePct || 80,
                avgScore
            };
        });
    }, [filteredStudents]);

    return {
        students: filteredStudents,
        selectedGrade,
        setSelectedGrade,
        selectedLevel,
        setSelectedLevel,
        distributionData,
        correlationData
    };
};