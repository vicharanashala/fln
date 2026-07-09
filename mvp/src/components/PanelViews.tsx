import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, ClassGroup, School, EvaluationReport, LogEntry, Ticket } from '../types';
import { Users, ShieldAlert, BookOpen, UserCheck, Calendar, ArrowRight, CheckCircle2, XCircle, SlidersHorizontal, Layers, Award, MapPin, School as SchoolIcon, BarChart3, FileText, ClipboardList, Building2, GraduationCap, BookMarked, Globe, Settings, Database, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { Table, Column } from './Table';
import { MetricCard } from './Card';

interface PanelViewsProps {
  activePanel: string;
  currentUser: User;
  token: string;
}

const STUDENTS_MOCK: Student[] = [
  { id: 's1', name: 'Amanpreet Singh', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 12, currentSubLevel: 0, targetLevel: 13, aadharMasked: 'XXXX-XXXX-1234', levelHistory: [{ level: 12, subLevel: 0, date: '2026-03-15', reason: 'Diagnostic' }], streak: 3 },
  { id: 's2', name: 'Jasmine Kaur', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 8, currentSubLevel: 1, targetLevel: 12, aadharMasked: 'XXXX-XXXX-5678', levelHistory: [{ level: 8, subLevel: 1, date: '2026-02-20', reason: 'Mid-year' }], streak: 1 },
  { id: 's3', name: 'Rohit Kumar', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', currentLevel: 36, currentSubLevel: 0, targetLevel: 37, aadharMasked: 'XXXX-XXXX-9012', levelHistory: [{ level: 36, date: '2026-01-10', reason: 'Baseline' }], streak: 5 },
  { id: 's4', name: 'Priya Sharma', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 10, currentSubLevel: 2, targetLevel: 14, aadharMasked: 'XXXX-XXXX-3456', levelHistory: [], streak: 0 },
  { id: 's5', name: 'Arjun Verma', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 6, currentSubLevel: 0, targetLevel: 11, aadharMasked: 'XXXX-XXXX-7890', levelHistory: [{ level: 6, date: '2026-04-01', reason: 'Diagnostic' }], streak: 2 },
  { id: 's6', name: 'Neha Gupta', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', currentLevel: 38, currentSubLevel: 1, targetLevel: 40, aadharMasked: 'XXXX-XXXX-2345', levelHistory: [{ level: 38, date: '2026-03-01', reason: 'Mid-year' }], streak: 4 },
  { id: 's7', name: 'Simran Kaur', age: 6, classGroup: 'Class 1', section: 'A', schoolId: 'gps-mt-001', currentLevel: 4, currentSubLevel: 0, targetLevel: 8, aadharMasked: 'XXXX-XXXX-6789', levelHistory: [], streak: 0 },
];

const REPORTS_MOCK: EvaluationReport[] = [
  { id: 'r1', studentId: 's1', worksheetId: 'ws1', score: 8, totalQuestions: 10, conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Satisfactory', 'Subtraction': 'Needs Practice' }, narrative: 'Shows good number sense but needs practice with borrowing in subtraction.', recommendedLevel: 12, timestamp: '2026-03-15T10:00:00Z' },
  { id: 'r2', studentId: 's2', worksheetId: 'ws2', score: 5, totalQuestions: 10, conceptMastery: { 'Number Sense': 'Satisfactory', 'Shapes': 'Needs Practice', 'Patterns': 'Needs Practice' }, narrative: 'Struggling with pattern recognition. Recommend additional tracing and matching exercises.', recommendedLevel: 8, recommendedSubLevel: 1, timestamp: '2026-02-20T11:30:00Z' },
  { id: 'r3', studentId: 's3', worksheetId: 'ws3', score: 9, totalQuestions: 10, conceptMastery: { 'Place Value': 'Strong', 'Comparison': 'Strong', 'Addition': 'Strong' }, narrative: 'Excellent understanding of place value up to 1000. Ready to progress to multiplication.', recommendedLevel: 36, timestamp: '2026-01-10T09:15:00Z' },
  { id: 'r4', studentId: 's6', worksheetId: 'ws4', score: 7, totalQuestions: 10, conceptMastery: { 'Multiplication': 'Strong', 'Division': 'Satisfactory', 'Measurement': 'Satisfactory' }, narrative: 'Multiplication skills are strong. Division concepts are developing well with occasional errors.', recommendedLevel: 38, recommendedSubLevel: 1, timestamp: '2026-03-01T14:00:00Z' },
];

const TEACHERS_MOCK = [
  { id: 't1', name: 'Ritu Sharma', email: 'gps-mt-001.t01@fln.org', schoolId: 'gps-mt-001', classes: ['Class 2-A', 'Class 3-A'], studentsCount: 42, delayedAttempts: 0, status: 'Active' },
  { id: 't2', name: 'Amit Kumar', email: 'gps-mt-001.t02@fln.org', schoolId: 'gps-mt-001', classes: ['Class 1-A'], studentsCount: 28, delayedAttempts: 1, status: 'Active' },
  { id: 't3', name: 'Sunita Devi', email: 'gps-bth-006.t01@fln.org', schoolId: 'gps-bth-006', classes: ['Class 2-B', 'Class 4-A'], studentsCount: 35, delayedAttempts: 3, status: 'Suspended' },
  { id: 't4', name: 'Rajesh Kumar', email: 'gps-pkl-008.t01@fln.org', schoolId: 'gps-pkl-008', classes: ['Class 3-B'], studentsCount: 30, delayedAttempts: 0, status: 'Active' },
];

const SCHOOLS_MOCK: School[] = [
  { id: 'gps-mt-001', name: 'GPS Model Town', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'high', teachersCount: 8, isAccessLocked: false },
  { id: 'gps-vl-002', name: 'GPS Village Lohara', stateCode: 'PB', districtCode: 'MOG', blockCode: 'MOG-01', strength: 'low', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-amb-003', name: 'GPS Ambala Cantt', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01', strength: 'high', teachersCount: 6, isAccessLocked: false },
  { id: 'gps-jai-004', name: 'GPS Govind Dev Ji', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-01', strength: 'high', teachersCount: 7, isAccessLocked: true },
  { id: 'gps-lko-005', name: 'GPS Hazratganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01', strength: 'high', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-bth-006', name: 'GPS Bathinda City', stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01', strength: 'high', teachersCount: 4, isAccessLocked: false },
  { id: 'gps-asr-007', name: 'GPS Amritsar', stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01', strength: 'high', teachersCount: 6, isAccessLocked: false },
  { id: 'gps-pkl-008', name: 'GPS Panchkula', stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01', strength: 'high', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-jai2-009', name: 'GPS Jaipur Rural', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02', strength: 'low', teachersCount: 3, isAccessLocked: false },
  { id: 'gps-uda-010', name: 'GPS Udaipur', stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01', strength: 'low', teachersCount: 3, isAccessLocked: false },
  { id: 'gps-lko2-011', name: 'GPS Aliganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02', strength: 'low', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-knp-012', name: 'GPS Kanpur', stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01', strength: 'high', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-pb-ldh2-013', name: 'GPS Gill Village', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02', strength: 'low', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-hr-amb2-014', name: 'GPS Ambala South', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02', strength: 'low', teachersCount: 2, isAccessLocked: false },
];

const USERS_MOCK = [
  { name: 'Jinal Gupta', email: 'superadmin@fln.org', role: 'Super Admin', scope: 'National', status: 'Active' },
  { name: 'State Coordinator Punjab', email: 'admin.pb@fln.org', role: 'State Admin', scope: 'PB', status: 'Active' },
  { name: 'State Coordinator Haryana', email: 'admin.hr@fln.org', role: 'State Admin', scope: 'HR', status: 'Active' },
  { name: 'Ludhiana District Officer', email: 'district.ldh@fln.org', role: 'District Admin', scope: 'PB-LDH', status: 'Active' },
  { name: 'Ambala District Officer', email: 'district.amb@fln.org', role: 'District Admin', scope: 'HR-AMB', status: 'Active' },
  { name: 'Ludhiana Block Admin 1', email: 'block.ldh-01@fln.org', role: 'Block Admin', scope: 'PB-LDH-LDH-01', status: 'Active' },
  { name: 'GPS Model Town Principal', email: 'gps-mt-001@fln.org', role: 'Principal', scope: 'gps-mt-001', status: 'Active' },
  { name: 'Ritu Sharma', email: 'gps-mt-001.t01@fln.org', role: 'Teacher', scope: 'gps-mt-001', status: 'Active' },
  { name: 'Rahul Kumar', email: 'vol.rahul@fln.org', role: 'Volunteer', scope: 'Moga Villages', status: 'Active' },
];

const QUESTION_BANK = [
  { id: 'QB-001', topic: 'Number Sense', level: 4, question: 'Count the number of apples: 🍎🍎🍎🍎', type: 'MCQ', difficulty: 'Easy' },
  { id: 'QB-002', topic: 'Number Sense', level: 8, question: 'What comes after 15?', type: 'Text', difficulty: 'Easy' },
  { id: 'QB-003', topic: 'Addition', level: 12, question: 'What is 7 + 5?', type: 'Number', difficulty: 'Easy' },
  { id: 'QB-004', topic: 'Subtraction', level: 16, question: 'What is 23 - 8?', type: 'Number', difficulty: 'Medium' },
  { id: 'QB-005', topic: 'Multiplication', level: 41, question: 'What is 6 × 7?', type: 'Number', difficulty: 'Medium' },
  { id: 'QB-006', topic: 'Division', level: 42, question: 'Divide 24 by 6', type: 'Number', difficulty: 'Medium' },
  { id: 'QB-007', topic: 'Fractions', level: 45, question: 'Which is larger: 1/2 or 1/4?', type: 'MCQ', difficulty: 'Hard' },
  { id: 'QB-008', topic: 'Place Value', level: 36, question: 'What is the value of 7 in 372?', type: 'Text', difficulty: 'Medium' },
  { id: 'QB-009', topic: 'Measurement', level: 43, question: 'How many cm in 1 meter?', type: 'Number', difficulty: 'Easy' },
  { id: 'QB-010', topic: 'Money', level: 46, question: 'You have ₹50. You buy a toy for ₹35. How much change?', type: 'Number', difficulty: 'Hard' },
];

const WS_TEMPLATES = [
  { id: 'WST-001', name: 'Baseline Assessment L1-L5', grade: 'Preschool 1-2', questions: 8, duration: '30 min', status: 'Published' },
  { id: 'WST-002', name: 'Number Sense L6-L11', grade: 'Class 1', questions: 10, duration: '45 min', status: 'Published' },
  { id: 'WST-003', name: 'Operations L12-L23', grade: 'Class 2', questions: 12, duration: '45 min', status: 'Draft' },
  { id: 'WST-004', name: 'Adv. Operations L24-L35', grade: 'Class 2 Review', questions: 10, duration: '60 min', status: 'Published' },
  { id: 'WST-005', name: 'Multiplication & Division L36-L48', grade: 'Class 3-4', questions: 15, duration: '60 min', status: 'Draft' },
  { id: 'WST-006', name: 'Fractions & Decimals L49-L59', grade: 'Class 4+', questions: 12, duration: '60 min', status: 'Review' },
];

const DIAGNOSTIC_HISTORY = [
  { id: 'dh1', student: 'Amanpreet Singh', date: '2026-03-15', score: 8, total: 10, placedLevel: 12, evaluator: 'Ritu Sharma' },
  { id: 'dh2', student: 'Rohit Kumar', date: '2026-01-10', score: 9, total: 10, placedLevel: 36, evaluator: 'Ritu Sharma' },
  { id: 'dh3', student: 'Arjun Verma', date: '2026-04-01', score: 6, total: 10, placedLevel: 6, evaluator: 'Amit Kumar' },
  { id: 'dh4', student: 'Neha Gupta', date: '2026-03-01', score: 7, total: 10, placedLevel: 38, evaluator: 'Ritu Sharma' },
  { id: 'dh5', student: 'Jasmine Kaur', date: '2026-02-20', score: 5, total: 10, placedLevel: 8, evaluator: 'Amit Kumar' },
];

const WORKSHEETS_MOCK = [
  { id: 'ws1', cycle: 'Baseline', class: 'Class 2-A', date: '2026-01-10', questions: 10, status: 'Evaluated', avgScore: '78%' },
  { id: 'ws2', cycle: 'Mid-year', class: 'Class 2-A', date: '2026-02-20', questions: 10, status: 'Evaluated', avgScore: '65%' },
  { id: 'ws3', cycle: 'Baseline', class: 'Class 3-A', date: '2026-01-10', questions: 10, status: 'Evaluated', avgScore: '85%' },
  { id: 'ws4', cycle: 'Mid-year', class: 'Class 3-A', date: '2026-03-01', questions: 10, status: 'Evaluated', avgScore: '72%' },
  { id: 'ws5', cycle: 'End-of-year', class: 'Class 2-A', date: '2026-05-15', questions: 12, status: 'Pending', avgScore: '-' },
  { id: 'ws6', cycle: 'End-of-year', class: 'Class 3-A', date: '2026-05-20', questions: 12, status: 'Pending', avgScore: '-' },
];

const ATTENDANCE_MOCK = [
  { student: 'Amanpreet Singh', class: 'Class 2-A', present: 42, total: 45, percentage: 93 },
  { student: 'Jasmine Kaur', class: 'Class 2-A', present: 38, total: 45, percentage: 84 },
  { student: 'Rohit Kumar', class: 'Class 3-A', present: 44, total: 45, percentage: 98 },
  { student: 'Priya Sharma', class: 'Class 2-A', present: 35, total: 45, percentage: 78 },
  { student: 'Arjun Verma', class: 'Class 2-A', present: 40, total: 45, percentage: 89 },
  { student: 'Neha Gupta', class: 'Class 3-A', present: 43, total: 45, percentage: 96 },
  { student: 'Simran Kaur', class: 'Class 1-A', present: 41, total: 45, percentage: 91 },
];

const DISTRICTS = [
  { code: 'LDH', name: 'Ludhiana', state: 'PB', schools: 3, students: 120, certifiedRate: 68 },
  { code: 'MOG', name: 'Moga', state: 'PB', schools: 1, students: 28, certifiedRate: 45 },
  { code: 'BTH', name: 'Bathinda', state: 'PB', schools: 1, students: 35, certifiedRate: 72 },
  { code: 'ASR', name: 'Amritsar', state: 'PB', schools: 1, students: 30, certifiedRate: 60 },
  { code: 'AMB', name: 'Ambala', state: 'HR', schools: 2, students: 65, certifiedRate: 55 },
  { code: 'PKL', name: 'Panchkula', state: 'HR', schools: 1, students: 30, certifiedRate: 80 },
  { code: 'JAI', name: 'Jaipur', state: 'RJ', schools: 2, students: 55, certifiedRate: 50 },
  { code: 'UDA', name: 'Udaipur', state: 'RJ', schools: 1, students: 25, certifiedRate: 40 },
  { code: 'LKO', name: 'Lucknow', state: 'UP', schools: 2, students: 48, certifiedRate: 62 },
  { code: 'KNP', name: 'Kanpur', state: 'UP', schools: 1, students: 32, certifiedRate: 56 },
];

const BLOCKS = [
  { code: 'LDH-01', district: 'LDH', schools: 2, students: 70, certifiedRate: 71 },
  { code: 'LDH-02', district: 'LDH', schools: 1, students: 22, certifiedRate: 45 },
  { code: 'MOG-01', district: 'MOG', schools: 1, students: 28, certifiedRate: 45 },
  { code: 'BTH-01', district: 'BTH', schools: 1, students: 35, certifiedRate: 72 },
  { code: 'ASR-01', district: 'ASR', schools: 1, students: 30, certifiedRate: 60 },
  { code: 'AMB-01', district: 'AMB', schools: 1, students: 35, certifiedRate: 60 },
  { code: 'AMB-02', district: 'AMB', schools: 1, students: 30, certifiedRate: 50 },
  { code: 'PKL-01', district: 'PKL', schools: 1, students: 30, certifiedRate: 80 },
  { code: 'JAI-01', district: 'JAI', schools: 1, students: 30, certifiedRate: 55 },
  { code: 'JAI-02', district: 'JAI', schools: 1, students: 25, certifiedRate: 45 },
  { code: 'UDA-01', district: 'UDA', schools: 1, students: 25, certifiedRate: 40 },
  { code: 'LKO-01', district: 'LKO', schools: 1, students: 28, certifiedRate: 65 },
  { code: 'LKO-02', district: 'LKO', schools: 1, students: 20, certifiedRate: 58 },
  { code: 'KNP-01', district: 'KNP', schools: 1, students: 32, certifiedRate: 56 },
];

const CONTENT_ITEMS = [
  { id: 'c1', title: 'Number Line 1-10', type: 'Visual Aid', level: 'L1-L4', language: 'English, Punjabi', status: 'Approved' },
  { id: 'c2', title: 'Addition with Objects', type: 'Lesson Plan', level: 'L7-L12', language: 'English, Hindi', status: 'Approved' },
  { id: 'c3', title: 'Place Value Chart', type: 'Poster', level: 'L24-L30', language: 'English, Punjabi', status: 'Draft' },
  { id: 'c4', title: 'Multiplication Tables Song', type: 'Audio', level: 'L36-L41', language: 'English', status: 'Review' },
  { id: 'c5', title: 'Fraction Pizza Activity', type: 'Worksheet', level: 'L45-L48', language: 'English, Hindi', status: 'Approved' },
  { id: 'c6', title: 'Money Math Games', type: 'Activity', level: 'L46-L48', language: 'English', status: 'Draft' },
];

const SYSTEM_LOGS_MOCK = [
  { action: 'Database Backup', status: 'Success', timestamp: '2026-07-07 02:00', details: 'Full backup completed (1.2 GB)' },
  { action: 'User Sync', status: 'Success', timestamp: '2026-07-07 01:00', details: 'Synced 142 users from state databases' },
  { action: 'SSL Certificate Renewal', status: 'Success', timestamp: '2026-07-06 12:00', details: 'Wildcard cert renewed, expires 2027-07' },
  { action: 'API Rate Limit Check', status: 'Warning', timestamp: '2026-07-06 10:30', details: '3 endpoints nearing threshold' },
  { action: 'Email Service', status: 'Failed', timestamp: '2026-07-06 08:15', details: 'SMTP relay timeout, retry queued' },
  { action: 'Cache Invalidation', status: 'Success', timestamp: '2026-07-06 06:00', details: 'CDN cache purged for /api/analytics' },
];

function PageHeader({ title, desc, icon }: { title: string; desc: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
      {icon && <div className="text-slate-500">{icon}</div>}
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function EmptyStudents() {
  const cols: Column<Student>[] = [
    { header: 'ID', accessor: 'id', className: 'font-mono text-xs text-slate-400' },
    { header: 'Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-800' },
    { header: 'Class', accessor: 'classGroup', className: '' },
    { header: 'Level', accessor: (s) => `L${s.currentLevel}.${s.currentSubLevel ?? 0}`, className: 'font-mono' },
    { header: 'Streak', accessor: (s) => `${s.streak} 🔥`, className: '' },
  ];
  return <Table data={STUDENTS_MOCK} columns={cols} searchPlaceholder="Search students..." searchKey="name" />;
}

export const PanelViews: React.FC<PanelViewsProps> = ({ activePanel, currentUser, token }) => {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [distFilter, setDistFilter] = useState('all');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const filteredSchools = SCHOOLS_MOCK.filter(s => {
    if (stateFilter !== 'all' && s.stateCode !== stateFilter) return false;
    if (distFilter !== 'all' && s.districtCode !== distFilter) return false;
    return true;
  });

  const panel = activePanel;

  const handleDownloadPDF = (student: Student, r: EvaluationReport, examResponses: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download/print the PDF report card.');
      return;
    }

    const conceptBadges = Object.entries(r.conceptMastery)
      .map(([t, m]) => `<span class="badge ${m === 'Strong' ? 'badge-pass' : 'badge-fail'}">${t}: ${m}</span>`)
      .join(' ');

    const tableRows = examResponses.map(item => `
      <tr>
        <td style="font-weight: 500;">${item.question}</td>
        <td style="color: ${item.status === 'Correct' ? '#065f46' : '#991b1b'}; font-weight: 600;">${item.studentAnswer}</td>
        <td>${item.correctAnswer}</td>
        <td>
          <span class="badge ${item.status === 'Correct' ? 'badge-pass' : 'badge-fail'}">
            ${item.status === 'Correct' ? 'PASS' : 'FAIL'}
          </span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Assessment Report - ${student.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
          .title { font-size: 24px; font-weight: 700; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 5px; font-weight: 500; }
          .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .info-item { font-size: 13px; }
          .info-item strong { color: #0f172a; }
          .section-title { font-size: 14px; font-weight: 700; border-left: 4px solid #4f46e5; padding-left: 10px; margin: 25px 0 15px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
          .metric-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
          .metric-value { font-size: 22px; font-weight: 700; color: #4f46e5; }
          .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 5px; letter-spacing: 0.5px; }
          .narrative-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; font-size: 13px; white-space: pre-line; margin-bottom: 25px; color: #334155; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background-color: #f1f5f9; text-align: left; padding: 10px; font-weight: 700; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .badge { display: inline-block; padding: 3px 8px; font-size: 9px; font-weight: 700; border-radius: 4px; text-transform: uppercase; font-family: monospace; }
          .badge-pass { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
          .badge-fail { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">NATIONAL FLN PORTAL</div>
          <div class="subtitle">Foundation Level Diagnostic Evaluation Report</div>
        </div>

        <div class="student-info">
          <div class="info-item">Student Name: <strong>${student.name}</strong></div>
          <div class="info-item">Student ID: <strong>${student.id}</strong></div>
          <div class="info-item">Class / Section: <strong>${student.classGroup} - ${student.section}</strong></div>
          <div class="info-item">Report Date: <strong>${new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
        </div>

        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${r.score} / ${r.totalQuestions}</div>
            <div class="metric-label">Diagnostic Score</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">L${r.recommendedLevel}.${r.recommendedSubLevel ?? 0}</div>
            <div class="metric-label">Placed Level</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${Math.round((r.score / r.totalQuestions) * 100)}%</div>
            <div class="metric-label">Accuracy Rate</div>
          </div>
        </div>

        <div class="section-title">Concept Mastery Breakdown</div>
        <div style="margin-bottom: 25px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${conceptBadges}
        </div>

        <div class="section-title">AI Evaluation Summary</div>
        <div class="narrative-box">
          ${r.narrative}
        </div>

        <div class="section-title">Question Grader Matrix</div>
        <table>
          <thead>
            <tr>
              <th style="width: 45%;">Question Detail</th>
              <th style="width: 20%;">Student Response</th>
              <th style="width: 20%;">Correct Answer Key</th>
              <th style="width: 15%;">Result</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          Generated automatically by NATIONAL FLN PORTAL. Confidential Student Academic Record.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ===================== TEACHER PANELS =====================
  if (panel === 'student_list') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Student Roster" desc="Complete list of registered students across your classes" icon={<Users className="h-5 w-5" />} />
        <EmptyStudents />
      </div>
    );
  }

  if (panel === 'student_profile') {
    const [sel, setSel] = useState(STUDENTS_MOCK[0].id);
    const [profileTab, setProfileTab] = useState<'overview' | 'academic' | 'personal' | 'activity'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [activityFilter, setActivityFilter] = useState<'all' | 'assessment' | 'level_change'>('all');
    const s = STUDENTS_MOCK.find(x => x.id === sel) || STUDENTS_MOCK[0];

    const filteredStudents = STUDENTS_MOCK.filter(x =>
      x.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      x.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const EXTENDED_PROFILES: Record<string, any> = {
      s1: { gender: 'Male', dob: '2018-04-12', guardian: 'Gurpreet Singh', relation: 'Father', contact: '+91-98765-43210', address: 'House #42, Model Town, Ludhiana, PB-141001', enrollmentDate: '2025-04-01', lastMedical: '2026-01-15', bloodGroup: 'B+', disability: 'None', midDayMeal: 'Yes', busRoute: 'Route 7 - Model Town Stop', notes: 'Consistent performer. Shows strong number sense. Encourage peer tutoring.', sibblings: 'Elder sister in Class 5' },
      s2: { gender: 'Female', dob: '2019-01-25', guardian: 'Harjeet Kaur', relation: 'Mother', contact: '+91-98123-45678', address: 'Village Dhandra, PO Box 23, Ludhiana', enrollmentDate: '2025-07-15', lastMedical: '2026-03-10', bloodGroup: 'O+', disability: 'None', midDayMeal: 'Yes', busRoute: 'Route 12 - Village Dhandra', notes: 'Struggles with pattern recognition. Needs visual learning aids. Regular attendance.', sibblings: 'Younger brother in Class 1' },
      s3: { gender: 'Male', dob: '2017-08-30', guardian: 'Suresh Kumar', relation: 'Father', contact: '+91-99887-76655', address: '456, Green Avenue, Ludhiana, PB-141002', enrollmentDate: '2025-04-01', lastMedical: '2026-02-20', bloodGroup: 'A+', disability: 'None', midDayMeal: 'Yes', busRoute: 'Route 3 - Green Ave Stop', notes: 'Top performer in class. Ready for advanced multiplication. Consider skipping to Level 41.', sibblings: 'None' },
      s4: { gender: 'Female', dob: '2018-11-05', guardian: 'Rajesh Sharma', relation: 'Father', contact: '+91-97654-32100', address: 'Flat 12B, Krishna Apartments, Civil Lines, Ludhiana', enrollmentDate: '2026-01-10', lastMedical: '2026-04-05', bloodGroup: 'AB+', disability: 'None', midDayMeal: 'No', busRoute: 'Route 7 - Civil Lines', notes: 'Newly enrolled. Baseline diagnostic pending. Parents report confidence in basic counting.', sibblings: 'Elder brother in Class 5' },
      s5: { gender: 'Male', dob: '2019-05-18', guardian: 'Mandeep Verma', relation: 'Mother', contact: '+91-95432-10987', address: 'Ward 3, Basti Jodhewal, Ludhiana', enrollmentDate: '2025-07-15', lastMedical: '2025-12-01', bloodGroup: 'B-', disability: 'Mild visual impairment (corrected)', midDayMeal: 'Yes', busRoute: 'Route 7 - Basti Stop', notes: 'Diagnosed with mild myopia, wears glasses. Performing well in number sense.', sibblings: 'Younger sister (not in school yet)' },
      s6: { gender: 'Female', dob: '2017-12-22', guardian: 'Vikram Gupta', relation: 'Father', contact: '+91-93210-87654', address: 'H.No. 88, Sarabha Nagar, Ludhiana', enrollmentDate: '2025-04-01', lastMedical: '2026-05-15', bloodGroup: 'O-', disability: 'None', midDayMeal: 'Yes', busRoute: 'Route 3 - Sarabha Nagar', notes: 'Exemplary in multiplication. Should be challenged with word problems.', sibblings: 'None' },
      s7: { gender: 'Female', dob: '2020-03-10', guardian: 'Balwinder Kaur', relation: 'Mother', contact: '+91-98765-01234', address: 'Street 5, Daresi Market Area, Ludhiana', enrollmentDate: '2026-01-10', lastMedical: '2026-02-28', bloodGroup: 'A-', disability: 'None', midDayMeal: 'Yes', busRoute: 'Route 12 - Daresi Stop', notes: 'Youngest in class. Recently enrolled. Shows enthusiasm for tracing activities.', sibblings: 'Two elder siblings in school' },
    };

    const profile = EXTENDED_PROFILES[s.id] || {};
    const reports = REPORTS_MOCK.filter(r => r.studentId === s.id);
    const studentSchool = SCHOOLS_MOCK.find(sch => sch.id === s.schoolId);
    const att = ATTENDANCE_MOCK.find(a => a.student === s.name);
    const daysSinceEnroll = Math.floor((Date.now() - new Date(profile.enrollmentDate || s.id).getTime()) / 86400000);
    const classStudents = STUDENTS_MOCK.filter(st => st.classGroup === s.classGroup);
    const classAvg = Math.round(classStudents.reduce((a, st) => a + st.currentLevel, 0) / Math.max(1, classStudents.length));
    const avgScore = reports.length > 0 ? Math.round(reports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / reports.length) : 0;
    const allSkills = new Map<string, { mastery: string; date: string }[]>();
    reports.forEach(r => Object.entries(r.conceptMastery).forEach(([topic, mastery]) => {
      if (!allSkills.has(topic)) allSkills.set(topic, []);
      allSkills.get(topic)!.push({ mastery, date: r.timestamp });
    }));
    const latestSkills = reports.length > 0 ? Object.entries(reports[0].conceptMastery) : [];
    const weakAreas = latestSkills.filter(([_, m]) => m !== 'Strong').map(([t]) => t);
    const recentActivity = [
      ...reports.map(r => ({ type: 'assessment' as const, label: `${r.score}/${r.totalQuestions} on ${r.worksheetId}`, date: r.timestamp, detail: `Score ${Math.round(r.score / r.totalQuestions * 100)}%` })),
      ...s.levelHistory.map(lh => ({ type: 'level_change' as const, label: `Level changed to L${lh.level}`, date: lh.date, detail: lh.reason })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filteredActivity = activityFilter === 'all' ? recentActivity : recentActivity.filter(a => a.type === activityFilter);

    const tabs = [
      { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
      { key: 'academic' as const, label: 'Academic Record', icon: BookOpen },
      { key: 'personal' as const, label: 'Personal Details', icon: Users },
      { key: 'activity' as const, label: 'Activity Log', icon: Calendar },
    ];

    return (
      <div className="space-y-6">
        {/* Student selector header */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">{s.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 truncate">{s.name}</h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">ID: {s.id}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.levelHistory.length > 0 ? 'text-green-700 bg-green-50 border border-green-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>{s.levelHistory.length > 0 ? 'Active' : 'Pending Diagnostic'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate"><strong>{studentSchool?.name || 'N/A'}</strong> · {s.classGroup} - {s.section} · Enrolled {daysSinceEnroll} days ago</p>
            </div>
            {/* Searchable student selector */}
            <div className="relative shrink-0">
              <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 min-w-[180px] text-left">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1 truncate">{s.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No students found</p>
                      ) : filteredStudents.map(x => {
                        const isSelected = x.id === sel;
                        const xAtt = ATTENDANCE_MOCK.find(a => a.student === x.name);
                        return (
                          <button key={x.id} onClick={() => { setSel(x.id); setProfileTab('overview'); setShowDropdown(false); setSearchQuery(''); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{x.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">{x.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span>{x.classGroup}-{x.section}</span>
                                <span className="font-mono font-bold">L{x.currentLevel}</span>
                                {xAtt && <span className={xAtt.percentage >= 85 ? 'text-emerald-500' : 'text-amber-500'}>{xAtt.percentage}%</span>}
                              </div>
                            </div>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="text-center"><div className="text-lg font-bold text-slate-900">{reports.length}</div><div className="text-[9px] font-mono text-slate-400 uppercase">Assessments</div></div>
            <div className="text-center"><div className={`text-lg font-bold ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{avgScore > 0 ? `${avgScore}%` : '—'}</div><div className="text-[9px] font-mono text-slate-400 uppercase">Avg Score</div></div>
            <div className="text-center"><div className="text-lg font-bold text-amber-600">L{s.currentLevel}</div><div className="text-[9px] font-mono text-slate-400 uppercase">Current Level</div></div>
            <div className="text-center"><div className="text-lg font-bold text-slate-900">{s.streak}</div><div className="text-[9px] font-mono text-slate-400 uppercase">Day Streak</div></div>
            <div className="text-center hidden sm:block"><div className={`text-lg font-bold ${att ? (att.percentage >= 85 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}`}>{att ? `${att.percentage}%` : '—'}</div><div className="text-[9px] font-mono text-slate-400 uppercase">Attendance</div></div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setProfileTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${profileTab === t.key ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {profileTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              {/* Status Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 shadow-lg text-white space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">{s.name.charAt(0)}</div>
                  <div><div className="font-bold text-lg">{s.name}</div><div className="text-xs text-slate-400">{s.classGroup} - {s.section}</div></div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <div className="text-center"><div className="text-2xl font-bold text-emerald-400">L{s.currentLevel}</div><div className="text-[9px] text-slate-400 uppercase font-mono">Current Level</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-amber-400">{s.streak}</div><div className="text-[9px] text-slate-400 uppercase font-mono">Day Streak</div></div>
                </div>
                <div className="pt-1"><div className="flex justify-between text-xs text-slate-400 mb-1"><span>Progress to L{s.targetLevel}</span><span>{Math.round((s.currentLevel / s.targetLevel) * 100)}%</span></div><div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (s.currentLevel / s.targetLevel) * 100)}%` }} /></div></div>
              </div>

              {/* Class Comparison */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Class Comparison</h3>
                <div className="space-y-3">
                  <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-500">This Student</span><span className="font-bold text-indigo-600">L{s.currentLevel}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(s.currentLevel / 59) * 100}%` }} /></div></div>
                  <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Class Average ({classStudents.length} students)</span><span className="font-bold text-slate-700">L{classAvg}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-500 rounded-full transition-all" style={{ width: `${(classAvg / 59) * 100}%` }} /></div></div>
                  <div className={`p-2 rounded-lg text-xs font-medium text-center ${s.currentLevel > classAvg ? 'bg-emerald-50 text-emerald-700' : s.currentLevel === classAvg ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {s.currentLevel > classAvg ? `↑ ${s.currentLevel - classAvg} levels above class average` : s.currentLevel === classAvg ? 'At class average' : `↓ ${classAvg - s.currentLevel} levels below class average`}
                  </div>
                </div>
                {/* Class rank */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Class Rank</span><span className="font-bold font-mono text-slate-800">#{classStudents.sort((a, b) => b.currentLevel - a.currentLevel).findIndex(x => x.id === s.id) + 1} / {classStudents.length}</span></div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Info</h3>
                {[['Age', `${s.age} yrs`], ['Gender', profile.gender], ['Blood Group', profile.bloodGroup], ['Guardian', profile.guardian], ['Contact', profile.contact], ['Attendance', att ? `${att.present}/${att.total} (${att.percentage}%)` : 'N/A']].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v || 'N/A'}</span></div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {/* Score Trend Chart */}
              {reports.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">Score Trend</h3>
                  <div className="relative">
                    <div className="flex items-end gap-3 h-40 border-b border-l border-slate-200 ml-8 pb-2 pl-2">
                      {reports.map((r, i) => {
                        const pct = Math.round((r.score / r.totalQuestions) * 100);
                        const barH = Math.max(pct * 0.8, 10);
                        const isUp = i === 0 || pct >= Math.round((reports[i - 1].score / reports[i - 1].totalQuestions) * 100);
                        return (
                          <div key={r.id} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                            <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8">
                              <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded whitespace-nowrap">{pct}%</span>
                              <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-500">{pct}%</span>
                            <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden flex-1 self-stretch" style={{ height: `${barH}px` }}>
                              <div className={`absolute bottom-0 inset-x-0 rounded-t-lg transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-mono text-slate-400">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                              <span className={`text-[8px] ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>{isUp ? '↑' : '↓'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {reports.length >= 2 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-500">
                        <span>Trend: <strong className={avgScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{avgScore}% avg</strong></span>
                        <span>Best: <strong className="text-emerald-600">{Math.max(...reports.map(r => Math.round((r.score / r.totalQuestions) * 100)))}%</strong></span>
                        <span>Last: <strong>{Math.round((reports[reports.length - 1].score / reports[reports.length - 1].totalQuestions) * 100)}%</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Level Journey */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">Level Journey</h3>
                {s.levelHistory.length > 0 ? (
                  <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {[...s.levelHistory].reverse().map((lh, i) => (
                      <div key={i} className="flex gap-4 pb-4 relative pl-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow mt-1 shrink-0 z-10" />
                        <div className="flex-1"><div className="flex justify-between"><div><span className="font-bold text-sm text-slate-900">Level {lh.level}{lh.subLevel !== undefined ? `.${lh.subLevel}` : ''}</span><p className="text-xs text-slate-500">{lh.reason}</p></div><span className="text-[10px] font-mono text-slate-400 shrink-0">{lh.date}</span></div></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-6"><p className="text-xs text-slate-400">No level history yet.</p></div>}
                {s.levelHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Next Targets</h4>
                    <div className="flex items-center gap-1 text-[10px] font-mono flex-wrap">
                      {Array.from({ length: Math.min(5, s.targetLevel - s.currentLevel + 1) }, (_, i) => s.currentLevel + i).map((lvl, i) => (
                        <React.Fragment key={lvl}>{i > 0 && <span className="text-slate-300">→</span>}<span className={`px-2 py-0.5 rounded border ${lvl <= s.currentLevel ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>L{lvl}</span></React.Fragment>
                      ))}
                      {s.targetLevel > s.currentLevel + 5 && <span className="text-slate-300">… → L{s.targetLevel}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Skills Grid */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">Skill Proficiency</h3>
                {latestSkills.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {latestSkills.map(([topic, mastery]) => {
                      const pct = mastery === 'Strong' ? 90 : mastery === 'Satisfactory' ? 60 : 30;
                      const history = allSkills.get(topic) || [];
                      const improving = history.length >= 2 && history[0].mastery !== history[history.length - 1].mastery;
                      return (
                        <div key={topic} className="border border-slate-100 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-700">{topic}</span>
                            <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${mastery === 'Strong' ? 'bg-emerald-50 text-emerald-700' : mastery === 'Satisfactory' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                              {mastery}
                              {improving && <span className="text-emerald-500">↑</span>}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${mastery === 'Strong' ? 'bg-emerald-500' : mastery === 'Satisfactory' ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          {history.length >= 2 && (
                            <div className="flex gap-1 mt-1.5">
                              {history.map((h, hi) => (
                                <span key={hi} className={`text-[7px] font-mono px-1 py-0.5 rounded ${h.mastery === 'Strong' ? 'bg-emerald-50 text-emerald-600' : h.mastery === 'Satisfactory' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                  {h.mastery === 'Strong' ? 'S' : h.mastery === 'Satisfactory' ? 'Sat' : 'NP'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="text-center py-6"><p className="text-xs text-slate-400">No skill data yet.</p></div>}
              </div>

              {/* Teacher Notes */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Teacher Notes</h3>
                <div className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-4 leading-relaxed">{profile.notes || 'No notes recorded.'}</div>
              </div>

              {/* Recommended Focus */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-2"><Award className="w-3.5 h-3.5" /> Recommended Focus Areas</h3>
                <div className="space-y-2">
                  {weakAreas.length > 0 ? weakAreas.map(topic => (
                    <div key={topic} className="flex items-center gap-2 text-sm text-slate-700 bg-white/60 rounded-lg px-3 py-2 border border-blue-100"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />Additional practice recommended for <strong>{topic}</strong></div>
                  )) : reports.length > 0 ? <div className="flex items-center gap-2 text-sm text-slate-700 bg-white/60 rounded-lg px-3 py-2 border border-blue-100"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />All skills at expected level — no focus areas needed</div> : <div className="text-sm text-slate-500">Complete a diagnostic assessment to generate recommendations.</div>}
                  {s.currentLevel < 59 && <div className="flex items-center gap-2 text-sm text-slate-700 bg-white/60 rounded-lg px-3 py-2 border border-blue-100"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />Next milestone: <strong>Level {Math.min(59, s.currentLevel + 1)}</strong></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ACADEMIC TAB ===== */}
        {profileTab === 'academic' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Academic Summary</h3>
                <div className="space-y-2.5 text-sm">
                  {[['Total Assessments', String(reports.length)], ['Avg Score', reports.length > 0 ? `${avgScore}%` : 'N/A'], ['Current Level', `L${s.currentLevel}.${s.currentSubLevel ?? 0}`], ['Target Level', `L${s.targetLevel}`], ['Sub-Level Status', s.currentSubLevel === 0 ? 'Mastery' : s.currentSubLevel === 1 ? 'Easier' : 'Remedial'], ['Day Streak', `${s.streak}`], ['Attendance', att ? `${att.percentage}% (${att.present}/${att.total} days)` : 'N/A']].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">Curriculum Coverage</h3>
                <div className="space-y-2">
                  {['Number Sense', 'Number Operations', 'Shapes & Geometry', 'Measurement', 'Patterns & Algebra', 'Data Handling'].map(strand => {
                    const lvlForStrand = ['Number Sense', 'Number Operations'].includes(strand) ? s.currentLevel : Math.max(0, s.currentLevel - 5);
                    const covered = lvlForStrand > 15;
                    const partial = lvlForStrand > 8;
                    return <div key={strand} className="flex items-center justify-between gap-2 text-sm py-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`${covered ? 'text-emerald-600' : partial ? 'text-amber-500' : 'text-slate-300'}`}>{covered ? '✓' : partial ? '◐' : '○'}</span>
                        <span className={covered ? 'text-slate-800 font-medium' : 'text-slate-400'}>{strand}</span>
                      </div>
                      <span className={`text-[9px] font-mono ${covered ? 'text-emerald-600' : partial ? 'text-amber-500' : 'text-slate-300'}`}>{covered ? 'Covered' : partial ? 'Partial' : 'Not Started'}</span>
                    </div>;
                  })}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Award className="w-3.5 h-3.5" /> Progress Highlights</h3>
                <div className="space-y-2 text-sm">
                  {reports.length > 0 && <div className="flex justify-between"><span className="text-slate-500">Best Score</span><span className="font-bold text-emerald-600">{Math.max(...reports.map(r => Math.round((r.score / r.totalQuestions) * 100)))}%</span></div>}
                  {reports.length > 0 && <div className="flex justify-between"><span className="text-slate-500">Recent Score</span><span className="font-bold text-slate-800">{Math.round((reports[reports.length - 1].score / reports[reports.length - 1].totalQuestions) * 100)}%</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500">Levels Gained</span><span className="font-bold text-slate-800">{s.levelHistory.length > 0 ? s.currentLevel - s.levelHistory[0].level : 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Strong Skills</span><span className="font-bold text-slate-800">{latestSkills.filter(([_, m]) => m === 'Strong').length}/{latestSkills.length}</span></div>
                  {s.levelHistory.length > 0 && <div className="flex justify-between"><span className="text-slate-500">Since</span><span className="font-mono text-xs text-slate-600">{s.levelHistory[0].date}</span></div>}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">All Assessment Reports</h3>
                {reports.length > 0 ? <div className="space-y-4">{reports.map(r => {
                  const scorePct = Math.round((r.score / r.totalQuestions) * 100);
                  return (
                    <div key={r.id} className="border border-slate-200 rounded-lg p-4 space-y-3 hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${scorePct >= 80 ? 'bg-emerald-50 text-emerald-700' : scorePct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{scorePct}%</div>
                          <div><span className="text-sm font-semibold text-slate-900">{r.worksheetId}</span><div className="text-[10px] text-slate-400">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${scorePct >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : scorePct >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{r.score}/{r.totalQuestions}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{r.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">{Object.entries(r.conceptMastery).map(([t, m]) => (
                        <span key={t} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${m === 'Strong' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : m === 'Satisfactory' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{t}: {m}</span>
                      ))}</div>
                      
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                        <button onClick={() => setExpandedReportId(expandedReportId === r.id ? null : r.id)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                          {expandedReportId === r.id ? 'Hide Exam Sheet' : '📋 View Student Exam Responses'}
                        </button>
                        <button onClick={() => {
                          const examResponses = s.id === 's1' ? [
                            { question: 'Q1: Match objects one-to-one (One-to-One Correspondence)', studentAnswer: '3 (incorrect match count)', correctAnswer: 'Matched all 5 items', status: 'Incorrect' },
                            { question: 'Q2: Odd One Out - Select non-conforming object from [ball, book, table, pen]', studentAnswer: 'B (Book)', correctAnswer: 'table (furniture classification)', status: 'Incorrect' },
                            { question: 'Q3: Single Digit Addition - Solve: 5 + 4 = ?', studentAnswer: '9', correctAnswer: '9', status: 'Correct' },
                            { question: 'Q4: Single Digit Subtraction - Solve: 8 - 3 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' },
                            { question: 'Q5: Identify shape with 3 corners and 3 straight sides', studentAnswer: 'Triangle', correctAnswer: 'Triangle', status: 'Correct' }
                          ] : s.id === 's2' ? [
                            { question: 'Q1: Counting up to 10 - Count the apples: 🍎🍎🍎🍎', studentAnswer: '4', correctAnswer: '4', status: 'Correct' },
                            { question: 'Q2: Odd One Out - Select non-matching item: [square, circle, red-block, triangle]', studentAnswer: 'red-block', correctAnswer: 'red-block', status: 'Correct' },
                            { question: 'Q3: Pattern recognition - What comes next in sequence: 🔴🔵🔴🔵 ?', studentAnswer: '🔵', correctAnswer: '🔴', status: 'Incorrect' },
                            { question: 'Q4: Simple Addition - Solve: 3 + 2 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' }
                          ] : [
                            { question: 'Q1: Place Value Designation - What is the value of 7 in 372?', studentAnswer: '70 (7 tens)', correctAnswer: '70', status: 'Correct' },
                            { question: 'Q2: Single-Digit Multiplication - Solve: 6 × 3 = ?', studentAnswer: '18', correctAnswer: '18', status: 'Correct' },
                            { question: 'Q3: Double-Digit Subtraction with Borrowing - Solve: 42 - 17 = ?', studentAnswer: '25', correctAnswer: '25', status: 'Correct' },
                            { question: 'Q4: Simple Division - Solve: 15 ÷ 3 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' }
                          ];
                          handleDownloadPDF(s, r, examResponses);
                        }} className="text-xs font-semibold text-emerald-650 hover:text-emerald-800 flex items-center gap-1">
                          📥 Download PDF Report
                        </button>
                      </div>

                      {expandedReportId === r.id && (
                        <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-xs">
                          <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 border-b border-slate-200">Side-by-Side Exam Grader Report</div>
                          <div className="divide-y divide-slate-200">
                            {(s.id === 's1' ? [
                              { question: 'Q1: Match objects one-to-one (One-to-One Correspondence)', studentAnswer: '3 (incorrect match count)', correctAnswer: 'Matched all 5 items', status: 'Incorrect' },
                              { question: 'Q2: Odd One Out - Select non-conforming object from [ball, book, table, pen]', studentAnswer: 'B (Book)', correctAnswer: 'table (furniture classification)', status: 'Incorrect' },
                              { question: 'Q3: Single Digit Addition - Solve: 5 + 4 = ?', studentAnswer: '9', correctAnswer: '9', status: 'Correct' },
                              { question: 'Q4: Single Digit Subtraction - Solve: 8 - 3 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' },
                              { question: 'Q5: Identify shape with 3 corners and 3 straight sides', studentAnswer: 'Triangle', correctAnswer: 'Triangle', status: 'Correct' }
                            ] : s.id === 's2' ? [
                              { question: 'Q1: Counting up to 10 - Count the apples: 🍎🍎🍎🍎', studentAnswer: '4', correctAnswer: '4', status: 'Correct' },
                              { question: 'Q2: Odd One Out - Select non-matching item: [square, circle, red-block, triangle]', studentAnswer: 'red-block', correctAnswer: 'red-block', status: 'Correct' },
                              { question: 'Q3: Pattern recognition - What comes next in sequence: 🔴🔵🔴🔵 ?', studentAnswer: '🔵', correctAnswer: '🔴', status: 'Incorrect' },
                              { question: 'Q4: Simple Addition - Solve: 3 + 2 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' }
                            ] : [
                              { question: 'Q1: Place Value Designation - What is the value of 7 in 372?', studentAnswer: '70 (7 tens)', correctAnswer: '70', status: 'Correct' },
                              { question: 'Q2: Single-Digit Multiplication - Solve: 6 × 3 = ?', studentAnswer: '18', correctAnswer: '18', status: 'Correct' },
                              { question: 'Q3: Double-Digit Subtraction with Borrowing - Solve: 42 - 17 = ?', studentAnswer: '25', correctAnswer: '25', status: 'Correct' },
                              { question: 'Q4: Simple Division - Solve: 15 ÷ 3 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' }
                            ]).map((item: any, idx: number) => (
                              <div key={idx} className="p-3 space-y-1">
                                <div className="font-semibold text-slate-800">{item.question}</div>
                                <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-dotted border-slate-200">
                                  <div>
                                    <span className="text-[9px] text-slate-400 uppercase font-mono block">Student Response</span>
                                    <span className={`font-medium ${item.status === 'Correct' ? 'text-green-700' : 'text-red-700'}`}>{item.studentAnswer}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 uppercase font-mono block">Correct Keys</span>
                                    <span className="font-medium text-slate-800">{item.correctAnswer}</span>
                                  </div>
                                </div>
                                <div className="pt-1">
                                  <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold font-mono rounded ${item.status === 'Correct' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status === 'Correct' ? 'PASS' : 'FAIL'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}</div> : <div className="text-center py-8"><p className="text-xs text-slate-400">No assessment reports yet.</p></div>}
              </div>
            </div>
          </div>
        )}

        {/* ===== PERSONAL TAB ===== */}
        {profileTab === 'personal' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Personal Information</h3>
              <div className="space-y-2.5 text-sm">{[
                ['Full Name', s.name], ['Date of Birth', profile.dob || 'N/A'], ['Age', `${s.age} years`], ['Gender', profile.gender || 'N/A'], ['Blood Group', profile.bloodGroup || 'N/A'], ['Disability Status', profile.disability || 'None'], ['Aadhar Number', s.aadharMasked], ['Enrollment Date', profile.enrollmentDate || 'N/A'], ['Class & Section', `${s.classGroup} - ${s.section}`], ['School', studentSchool?.name || 'N/A'], ['School ID', s.schoolId],
              ].map(([l, v]) => (<div key={l as string} className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800 text-right max-w-[55%]">{v}</span></div>))}</div>
            </div>
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><UserCheck className="w-3.5 h-3.5" /> Guardian & Contact</h3>
                <div className="space-y-2.5 text-sm">{[
                  ['Guardian Name', profile.guardian || 'N/A'], ['Relation', profile.relation || 'N/A'], ['Contact Number', profile.contact || 'N/A'], ['Residential Address', profile.address || 'N/A'], ['Mid-Day Meal', profile.midDayMeal || 'N/A'], ['Bus Route', profile.busRoute || 'N/A'],
                ].map(([l, v]) => (<div key={l as string} className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800 text-right max-w-[55%]">{v}</span></div>))}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Additional Information</h3>
                <div className="text-sm space-y-2">{[
                  ['Siblings in School', profile.sibblings || 'N/A'], ['Last Medical Check-up', profile.lastMedical || 'N/A'], ['Mid-Day Meal Beneficiary', profile.midDayMeal || 'N/A'],
                ].map(([l, v]) => (<div key={l as string} className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v}</span></div>))}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Teacher Notes</h3>
                <div className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-4 leading-relaxed">{profile.notes || 'No notes recorded.'}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Attendance Record</h3>
                {att ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Overall Attendance</span>
                      <span className={`text-lg font-bold ${att.percentage >= 85 ? 'text-emerald-600' : att.percentage >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{att.percentage}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${att.percentage >= 85 ? 'bg-emerald-500' : att.percentage >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${att.percentage}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Present: {att.present} days</span>
                      <span>Total: {att.total} days</span>
                      <span>Absent: {att.total - att.present} days</span>
                    </div>
                  </div>
                ) : <p className="text-xs text-slate-400">No attendance data available.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {profileTab === 'activity' && (
          <div className="max-w-2xl">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Recent Activity</h3>
                <div className="flex gap-1">
                  {(['all', 'assessment', 'level_change'] as const).map(f => (
                    <button key={f} onClick={() => setActivityFilter(f)} className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${activityFilter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {f === 'all' ? 'All' : f === 'assessment' ? 'Assessments' : 'Level Changes'}
                    </button>
                  ))}
                </div>
              </div>
              {filteredActivity.length > 0 ? (
                <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {filteredActivity.map((act, i) => (
                    <div key={i} className="flex gap-4 pb-5 relative pl-2">
                      <div className={`w-3 h-3 rounded-full border-2 border-white shadow mt-1 shrink-0 z-10 ${act.type === 'assessment' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <div className="flex-1"><div className="flex justify-between"><div><span className="font-semibold text-sm text-slate-900">{act.label}</span><p className="text-xs text-slate-500">{act.detail}</p></div><span className="text-[10px] font-mono text-slate-400 shrink-0">{new Date(act.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8"><p className="text-xs text-slate-400">{activityFilter === 'all' ? 'No activity recorded yet.' : `No ${activityFilter === 'assessment' ? 'assessment' : 'level change'} activity found.`}</p></div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (panel === 'diagnostic_test') {
    const pending = STUDENTS_MOCK.filter(s => s.levelHistory.length === 0);
    const completed = STUDENTS_MOCK.filter(s => s.levelHistory.length > 0);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Pending Diagnostics" desc={`${pending.length} students need initial assessment`} icon={<ShieldAlert className="h-5 w-5 text-amber-500" />} />
          {pending.length === 0 ? <p className="text-xs text-slate-400 text-center py-8">All students placed.</p> : (
            <div className="space-y-3">{pending.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg">
                <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400">{s.classGroup} - {s.section}</div></div>
                <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">Run Diagnostic</span>
              </div>
            ))}</div>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Completed Diagnostics" desc={`${completed.length} students have been placed`} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
          <div className="space-y-3">{completed.map(s => (
            <div key={s.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg">
              <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400">Placed at L{s.currentLevel}.{s.currentSubLevel ?? 0}</div></div>
              <span className="text-[10px] font-mono font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">Completed</span>
            </div>
          ))}</div>
        </div>
      </div>
    );
  }

  if (panel === 'adaptive_test') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <PageHeader title="Adaptive Assessment" desc="Computer-adaptive testing that adjusts to student ability" icon={<SlidersHorizontal className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Active Sessions" value="3" subtext="Students currently testing" icon={Users} />
          <MetricCard title="Avg Adaptive Score" value="72%" subtext="Across all levels" icon={BarChart3} />
          <MetricCard title="Completion Rate" value="85%" subtext="Tests finished on time" icon={CheckCircle2} />
        </div>
        <div className="border border-slate-200 rounded-lg p-5 bg-slate-50 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">How Adaptive Testing Works</h4>
          <p className="text-xs text-slate-600 leading-relaxed">The system selects questions dynamically based on the student's previous answers. Correct answers lead to harder questions; incorrect answers adjust to easier ones. This pinpoints the exact FLN level.</p>
          <div className="flex gap-4 pt-2">
            <button className="bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-slate-800">Start New Adaptive Test</button>
            <button className="border border-slate-200 text-slate-700 text-xs font-medium px-4 py-2 rounded-lg hover:bg-slate-50">View Session Logs</button>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'test_history') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Test History" desc="Complete record of all diagnostic and worksheet evaluations" icon={<FileText className="h-5 w-5" />} />
        <div className="space-y-3">{DIAGNOSTIC_HISTORY.map(h => (
          <div key={h.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div><div className="font-semibold text-sm">{h.student}</div><div className="text-xs text-slate-400">{h.date} · Evaluated by {h.evaluator}</div></div>
            <div className="text-right"><div className="font-mono font-bold">{h.score}/{h.total}</div><div className="text-xs text-slate-400">Placed L{h.placedLevel}</div></div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'worksheets') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Total Worksheets" value={WORKSHEETS_MOCK.length} subtext="Across all cycles" icon={ClipboardList} />
          <MetricCard title="Evaluated" value={WORKSHEETS_MOCK.filter(w => w.status === 'Evaluated').length} subtext="Graded and scored" icon={CheckCircle2} />
          <MetricCard title="Pending" value={WORKSHEETS_MOCK.filter(w => w.status === 'Pending').length} subtext="Awaiting evaluation" icon={FileText} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <PageHeader title="Worksheet Cycles" desc="Baseline, Mid-year, and End-of-year assessments" />
          <div className="space-y-3 mt-4">{WORKSHEETS_MOCK.map(w => (
            <div key={w.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-lg">
              <div><div className="font-semibold text-sm">{w.cycle} — {w.class}</div><div className="text-xs text-slate-400">{w.date} · {w.questions} questions</div></div>
              <div className="text-right"><span className={`text-xs font-mono font-bold px-2 py-1 rounded ${w.status === 'Evaluated' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>{w.status}</span><div className="text-xs text-slate-400 mt-1">Avg: {w.avgScore}</div></div>
            </div>
          ))}</div>
        </div>
      </div>
    );
  }

  if (panel === 'performance') {
    const isTeacher = currentUser.role === UserRole.TEACHER || currentUser.role === UserRole.VOLUNTEER;
    const topStudents = [...STUDENTS_MOCK].sort((a, b) => b.currentLevel - a.currentLevel).slice(0, 5);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Students" value={STUDENTS_MOCK.length} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg Level" value={`L${Math.round(STUDENTS_MOCK.reduce((a, s) => a + s.currentLevel, 0) / STUDENTS_MOCK.length)}`} subtext="Class average" icon={BarChart3} />
          <MetricCard title="Certified" value={`${STUDENTS_MOCK.filter(s => s.currentLevel >= 5).length}`} subtext="Level 5+ achieved" icon={Award} />
          <MetricCard title="Pending Diagnostic" value={STUDENTS_MOCK.filter(s => s.levelHistory.length === 0).length} subtext="Need placement" icon={ShieldAlert} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <PageHeader title={isTeacher ? "Class Performance" : "School Performance"} desc="FLN level distribution and trends" />
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-500 uppercase">Top Performing Students</h4>
            <div className="space-y-2">{topStudents.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg">
                <div className="flex items-center gap-3"><span className="text-sm font-semibold">{s.name}</span><span className="text-xs text-slate-400">{s.classGroup}</span></div>
                <div className="flex items-center gap-4"><div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.currentLevel / 59) * 100}%` }} /></div><span className="font-mono font-bold text-sm">L{s.currentLevel}</span></div>
              </div>
            ))}</div>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'reports') {
    const isStateAdmin = currentUser.role === UserRole.ADMIN;
    if (isStateAdmin) {
      const userState = currentUser.stateCode || 'PB';
      const stateSchools = SCHOOLS_MOCK.filter(s => s.stateCode === userState);
      const stateDistricts = [...new Set(stateSchools.map(s => s.districtCode))];
      const [expandedDistRpt, setExpandedDistRpt] = useState<string | null>(null);
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Total Reports" value={REPORTS_MOCK.length} subtext="All evaluations" icon={FileText} />
            <MetricCard title="Avg Score" value={`${Math.round(REPORTS_MOCK.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / REPORTS_MOCK.length)}%`} subtext="Across reports" icon={BarChart3} />
            <MetricCard title="Schools" value={stateSchools.length} subtext={`In ${userState}`} icon={SchoolIcon} />
            <MetricCard title="Districts" value={stateDistricts.length} subtext="Active jurisdictions" icon={MapPin} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <PageHeader title={`District-Wise School Reports — ${userState}`} desc="Evaluation reports organized by district and school" />
            <div className="space-y-3 mt-4">{stateDistricts.map(dc => {
              const isExpanded = expandedDistRpt === dc;
              const distSchools = stateSchools.filter(s => s.districtCode === dc);
              return (
                <div key={dc}>
                  <button onClick={() => setExpandedDistRpt(isExpanded ? null : dc)} className={`w-full flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-slate-50 transition-all ${isExpanded ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100'}`}>
                    <span className="font-bold text-sm w-16">{dc}</span>
                    <span className="text-sm flex-1">{DISTRICTS.find(d => d.code === dc)?.name || dc}</span>
                    <span className="text-xs text-slate-500">{distSchools.length} schools</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-2 space-y-4 pl-4 border-l-2 border-indigo-200">
                      {distSchools.map(sch => {
                        const schStudents = STUDENTS_MOCK.filter(st => st.schoolId === sch.id);
                        const schReports = REPORTS_MOCK.filter(r => schStudents.some(st => st.id === r.studentId));
                        const avgScore = schReports.length > 0 ? Math.round(schReports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / schReports.length) : 0;
                        return (
                          <div key={sch.id} className="border border-slate-200 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-900 text-sm">{sch.name}</h4><span className="text-xs text-slate-400">{sch.blockCode} · {sch.strength}</span></div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div className="text-center bg-slate-50 rounded-lg p-2"><div className="text-lg font-bold text-slate-900">{schReports.length}</div><div className="text-[10px] text-slate-400">Reports</div></div>
                              <div className="text-center bg-slate-50 rounded-lg p-2"><div className={`text-lg font-bold ${avgScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{avgScore}%</div><div className="text-[10px] text-slate-400">Avg Score</div></div>
                              <div className="text-center bg-slate-50 rounded-lg p-2"><div className="text-lg font-bold text-slate-900">{schStudents.length}</div><div className="text-[10px] text-slate-400">Students</div></div>
                            </div>
                            {schReports.length > 0 ? (
                              <div className="space-y-2">{schReports.map(r => {
                                const student = schStudents.find(st => st.id === r.studentId);
                                const scorePct = Math.round((r.score / r.totalQuestions) * 100);
                                return (
                                  <div key={r.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                                    <div className="flex justify-between items-center"><span className="font-semibold">{student?.name || 'N/A'}</span><span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${scorePct >= 80 ? 'bg-emerald-50 text-emerald-700' : scorePct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{r.score}/{r.totalQuestions} ({scorePct}%)</span></div>
                                    <p className="text-xs text-slate-500 mt-1">{r.narrative}</p>
                                    <div className="flex gap-1 mt-1.5">{Object.entries(r.conceptMastery).map(([t, m]) => (
                                      <span key={t} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${m === 'Strong' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : m === 'Satisfactory' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{t}</span>
                                    ))}</div>
                                  </div>
                                );
                              })}</div>
                            ) : <p className="text-xs text-slate-400 text-center py-3">No evaluation reports for this school yet.</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Total Reports" value={REPORTS_MOCK.length} subtext="All evaluations" icon={FileText} />
          <MetricCard title="Avg Score" value={`${Math.round(REPORTS_MOCK.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / REPORTS_MOCK.length)}%`} subtext="Across reports" icon={BarChart3} />
          <MetricCard title="Strong Concepts" value={REPORTS_MOCK.reduce((a, r) => a + Object.values(r.conceptMastery).filter(v => v === 'Strong').length, 0)} subtext="Mastered topics" icon={Award} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Evaluation Reports" desc="Detailed assessment narratives and concept mastery breakdowns" />
          {REPORTS_MOCK.map(r => {
            const student = STUDENTS_MOCK.find(s => s.id === r.studentId);
            const isExpanded = expandedReportId === r.id;
            
            // Mock exam questions and student responses for side-by-side preview
            const examResponses = student ? (
              student.id === 's1' ? [
                { question: 'Q1: Match objects one-to-one (One-to-One Correspondence)', studentAnswer: '3 (incorrect match count)', correctAnswer: 'Matched all 5 items', status: 'Incorrect' },
                { question: 'Q2: Odd One Out - Select non-conforming object from [ball, book, table, pen]', studentAnswer: 'B (Book)', correctAnswer: 'table (furniture classification)', status: 'Incorrect' },
                { question: 'Q3: Single Digit Addition - Solve: 5 + 4 = ?', studentAnswer: '9', correctAnswer: '9', status: 'Correct' },
                { question: 'Q4: Single Digit Subtraction - Solve: 8 - 3 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' },
                { question: 'Q5: Identify shape with 3 corners and 3 straight sides', studentAnswer: 'Triangle', correctAnswer: 'Triangle', status: 'Correct' }
              ] : student.id === 's2' ? [
                { question: 'Q1: Counting up to 10 - Count the apples: 🍎🍎🍎🍎', studentAnswer: '4', correctAnswer: '4', status: 'Correct' },
                { question: 'Q2: Odd One Out - Select non-matching item: [square, circle, red-block, triangle]', studentAnswer: 'red-block', correctAnswer: 'red-block', status: 'Correct' },
                { question: 'Q3: Pattern recognition - What comes next in sequence: 🔴🔵🔴🔵 ?', studentAnswer: '🔵', correctAnswer: '🔴', status: 'Incorrect' },
                { question: 'Q4: Simple Addition - Solve: 3 + 2 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' }
              ] : [
                { question: 'Q1: Place Value Designation - What is the value of 7 in 372?', studentAnswer: '70 (7 tens)', correctAnswer: '70', status: 'Correct' },
                { question: 'Q2: Single-Digit Multiplication - Solve: 6 × 3 = ?', studentAnswer: '18', correctAnswer: '18', status: 'Correct' },
                { question: 'Q3: Double-Digit Subtraction with Borrowing - Solve: 42 - 17 = ?', studentAnswer: '25', correctAnswer: '25', status: 'Correct' },
                { question: 'Q4: Simple Division - Solve: 15 ÷ 3 = ?', studentAnswer: '5', correctAnswer: '5', status: 'Correct' }
              ]
            ) : [];

            return (
              <div key={r.id} className="border border-slate-200 rounded-lg p-4 space-y-3 hover:border-slate-300 transition-all">
                <div className="flex justify-between items-center"><span className="font-semibold text-sm">{student?.name || 'Unknown'}</span><span className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleDateString()}</span></div>
                <div className="flex gap-4 text-sm"><span>Score: <strong>{r.score}/{r.totalQuestions}</strong></span><span>Level: <strong>L{r.recommendedLevel}.{r.recommendedSubLevel ?? 0}</strong></span></div>
                
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider">Evaluation Report Narrative</span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">{r.narrative}</p>
                </div>

                <div className="flex flex-wrap gap-2">{Object.entries(r.conceptMastery).map(([t, m]) => (
                  <span key={t} className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${m === 'Strong' ? 'bg-green-50 text-green-700 border border-green-200' : m === 'Satisfactory' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{t}: {m}</span>
                ))}</div>

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex gap-3">
                    <button onClick={() => setExpandedReportId(isExpanded ? null : r.id)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      {isExpanded ? 'Hide Exam Sheet' : '📋 View Student Exam Responses'}
                    </button>
                    {student && (
                      <button onClick={() => handleDownloadPDF(student, r, examResponses)} className="text-xs font-semibold text-emerald-650 hover:text-emerald-800 flex items-center gap-1">
                        📥 Download PDF Report
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Assigned from Diagnostic Pipeline</span>
                </div>

                {isExpanded && (
                  <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-xs">
                    <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 border-b border-slate-200">Side-by-Side Exam Grader Report</div>
                    <div className="divide-y divide-slate-200">
                      {examResponses.map((item, idx) => (
                        <div key={idx} className="p-3 space-y-1">
                          <div className="font-semibold text-slate-800">{item.question}</div>
                          <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-dotted border-slate-200">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-mono block">Student Response</span>
                              <span className={`font-medium ${item.status === 'Correct' ? 'text-green-700' : 'text-red-700'}`}>{item.studentAnswer}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-mono block">Correct Keys</span>
                              <span className="font-medium text-slate-800">{item.correctAnswer}</span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold font-mono rounded ${item.status === 'Correct' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status === 'Correct' ? 'PASS' : 'FAIL'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===================== VOLUNTEER PANELS =====================
  if (panel === 'assigned_schools') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['gps-vl-002', 'gps-jai-004', 'gps-lko-005', 'gps-amb-003'].map(id => {
          const sch = SCHOOLS_MOCK.find(s => s.id === id);
          if (!sch) return null;
          const count = STUDENTS_MOCK.filter(s => s.schoolId === id).length;
          return (
            <div key={id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3 hover:border-slate-400 transition-all">
              <div className="flex justify-between"><h3 className="font-bold text-slate-900">{sch.name}</h3><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sch.strength === 'low' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'}`}>{sch.strength === 'low' ? 'Low-Strength' : 'High-Strength'}</span></div>
              <div className="text-xs text-slate-400">{sch.stateCode} / {sch.districtCode} / {sch.blockCode}</div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100"><div><div className="font-bold text-slate-800">{count}</div><div className="text-slate-400">Students</div></div><div><div className="font-bold text-slate-800">{sch.teachersCount}</div><div className="text-slate-400">Teachers</div></div><div><div className="font-bold text-green-600">{sch.isAccessLocked ? 'Locked' : 'Active'}</div><div className="text-slate-400">Status</div></div></div>
              <button className="w-full text-xs font-medium bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800">Visit School</button>
            </div>
          );
        })}
      </div>
    );
  }

  if (panel === 'student_progress') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Student Progress Tracking" desc="Monitor FLN level advancement across assigned schools" icon={<GraduationCap className="h-5 w-5" />} />
        <div className="space-y-3">{STUDENTS_MOCK.sort((a, b) => b.currentLevel - a.currentLevel).map(s => (
          <div key={s.id} className="flex items-center gap-4 p-3 border border-slate-200 rounded-lg">
            <div className="flex-1"><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400">{s.classGroup} · Streak: {s.streak}</div></div>
            <div className="w-40"><div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>L{s.currentLevel}</span><span>Target L{s.targetLevel}</span></div><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.currentLevel / s.targetLevel) * 100}%` }} /></div></div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.levelHistory.length > 0 ? 'text-green-700 bg-green-50 border border-green-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>{s.levelHistory.length > 0 ? 'Placed' : 'Pending'}</span>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'attendance') {
    const examAttendance = STUDENTS_MOCK.map(s => {
      const reports = REPORTS_MOCK.filter(r => r.studentId === s.id);
      const examsGiven = reports.length;
      const lastExam = examsGiven > 0 ? new Date(Math.max(...reports.map(r => new Date(r.timestamp).getTime()))).toLocaleDateString() : 'N/A';
      const avgScore = examsGiven > 0 ? Math.round(reports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / examsGiven) : 0;
      return { student: s.name, class: `${s.classGroup} - ${s.section}`, examsGiven, lastExam, avgScore, placed: s.levelHistory.length > 0 };
    });
    const totalExams = examAttendance.reduce((a, e) => a + e.examsGiven, 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Students" value={examAttendance.length} subtext="Assigned roster" icon={Users} />
          <MetricCard title="Exams Conducted" value={totalExams} subtext="Across all students" icon={FileText} />
          <MetricCard title="Avg Exams/Student" value={`${(totalExams / examAttendance.length).toFixed(1)}`} subtext="Participation rate" icon={BarChart3} />
          <MetricCard title="Placed Students" value={examAttendance.filter(e => e.placed).length} subtext="Have level history" icon={Award} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <PageHeader title="Exam Attendance Records" desc="Track which students have appeared for assessments and their performance" icon={<Calendar className="h-5 w-5" />} />
          <div className="space-y-2 mt-4">{examAttendance.map(a => (
            <div key={a.student} className="flex items-center gap-4 p-3 border border-slate-100 rounded-lg">
              <div className="flex items-center gap-3 w-8">{a.examsGiven > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}</div>
              <div className="flex-1 min-w-0"><span className="text-sm font-medium">{a.student}</span><span className="text-xs text-slate-400 ml-2">{a.class}</span></div>
              <div className="flex items-center gap-6 text-sm shrink-0">
                <div className="text-center"><div className="font-bold text-slate-900">{a.examsGiven}</div><div className="text-[9px] text-slate-400 font-mono uppercase">Exams</div></div>
                <div className="text-center"><div className={`font-bold ${a.avgScore >= 70 ? 'text-emerald-600' : a.avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{a.examsGiven > 0 ? `${a.avgScore}%` : '—'}</div><div className="text-[9px] text-slate-400 font-mono uppercase">Avg Score</div></div>
                <div className="text-center"><div className="text-xs text-slate-500 font-mono">{a.lastExam}</div><div className="text-[9px] text-slate-400 font-mono uppercase">Last Exam</div></div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${a.placed ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>{a.placed ? 'Placed' : 'Pending'}</span>
              </div>
            </div>
          ))}</div>
        </div>
      </div>
    );
  }

  // ===================== PRINCIPAL / SCHOOL ADMIN PANELS =====================
  if (panel === 'teachers' && currentUser.role === UserRole.SCHOOL) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Teacher Roster" desc="Manage teaching staff at your school" icon={<Users className="h-5 w-5" />} />
        <div className="space-y-3">{TEACHERS_MOCK.filter(t => t.schoolId === currentUser.schoolId).map(t => (
          <div key={t.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg">
            <div><div className="font-semibold text-sm">{t.name}</div><div className="text-xs text-slate-400">{t.email} · {t.classes.join(', ')}</div></div>
            <div className="text-right"><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${t.status === 'Active' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{t.status}</span><div className="text-xs text-slate-400 mt-1">{t.studentsCount} students</div></div>
          </div>
        ))}</div>
      </div>
    );
  }

  // ===================== BLOCK/DISTRICT/STATE ADMIN + SUPERADMIN SHARED PANELS =====================
  if (panel === 'schools') {
    const uniqueStates = [...new Set(SCHOOLS_MOCK.map(s => s.stateCode))];
    const uniqueDists = [...new Set(SCHOOLS_MOCK.filter(s => stateFilter === 'all' || s.stateCode === stateFilter).map(s => s.districtCode))];
    return (
      <div className="space-y-6">
        <div className="flex gap-3 items-end">
          <div><label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">State</label><select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setDistFilter('all'); }} className="text-sm border border-slate-200 rounded-lg p-2 outline-none">{uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}<option value="all">All States</option></select></div>
          <div><label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">District</label><select value={distFilter} onChange={e => setDistFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg p-2 outline-none"><option value="all">All Districts</option>{uniqueDists.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="text-xs text-slate-400 pb-1">Showing {filteredSchools.length} schools</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredSchools.map(s => (
          <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex justify-between"><h4 className="font-bold text-slate-900 text-sm">{s.name}</h4><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.strength === 'high' ? 'text-indigo-700 bg-indigo-50 border border-indigo-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>{s.strength}</span></div>
            <div className="text-xs text-slate-400">{s.stateCode} / {s.districtCode} / {s.blockCode}</div>
            <div className="flex gap-4 text-xs pt-1 border-t border-slate-100"><span>👨‍🏫 {s.teachersCount} teachers</span><span className={s.isAccessLocked ? 'text-red-600' : 'text-green-600'}>{s.isAccessLocked ? '🔒 Locked' : '🔓 Active'}</span></div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'districts') {
    const userState = currentUser.stateCode || 'PB';
    const stateDistricts = DISTRICTS.filter(d => d.state === userState);
    const [expandedDist, setExpandedDist] = useState<string | null>(null);
    const distSchools = expandedDist ? SCHOOLS_MOCK.filter(s => s.districtCode === expandedDist) : [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="State Districts" value={stateDistricts.length} subtext={`${userState} jurisdiction`} icon={MapPin} />
          <MetricCard title="Total Schools" value={stateDistricts.reduce((a, d) => a + d.schools, 0)} subtext="Registered facilities" icon={SchoolIcon} />
          <MetricCard title="Total Students" value={stateDistricts.reduce((a, d) => a + d.students, 0)} subtext="Across all districts" icon={Users} />
          <MetricCard title="Avg Certification" value={`${Math.round(stateDistricts.reduce((a, d) => a + d.certifiedRate, 0) / stateDistricts.length)}%`} subtext="State weighted average" icon={Award} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* District list */}
          <div className={`${expandedDist ? 'lg:col-span-1' : 'lg:col-span-3'} bg-white border border-slate-200 rounded-xl p-5 shadow-sm`}>
            <PageHeader title="District Overview" desc={`${userState} — Performance metrics by district`} icon={<MapPin className="h-5 w-5" />} />
            <div className="space-y-2 mt-4">{stateDistricts.map(d => {
              const isExpanded = expandedDist === d.code;
              const schoolList = SCHOOLS_MOCK.filter(s => s.districtCode === d.code);
              const studentCount = schoolList.reduce((a, s) => a + (STUDENTS_MOCK.filter(st => st.schoolId === s.id).length), 0);
              return (
                <div key={d.code}>
                  <button onClick={() => setExpandedDist(isExpanded ? null : d.code)} className={`w-full flex items-center gap-4 p-3 border rounded-lg text-left hover:bg-slate-50 transition-all ${isExpanded ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100'}`}>
                    <div className="w-16"><span className="font-bold text-sm">{d.code}</span><span className="text-[10px] text-slate-400 ml-1">({d.state})</span></div>
                    <div className="flex-1"><span className="text-sm font-semibold">{d.name}</span></div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span><strong className="text-slate-800">{studentCount}</strong> students</span>
                      <span><strong className="text-slate-800">{schoolList.length}</strong> schools</span>
                    </div>
                    <div className="w-24"><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.certifiedRate}%` }} /></div><div className="text-[10px] text-slate-400 mt-0.5 text-right">{d.certifiedRate}% certified</div></div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              );
            })}</div>
          </div>

          {/* Schools in selected district */}
          {expandedDist && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Schools in {expandedDist}</h3>
                  <button onClick={() => setExpandedDist(null)} className="text-xs text-slate-400 hover:text-slate-600 font-mono">Close</button>
                </div>
                <div className="grid grid-cols-1 gap-4">{distSchools.map(sch => {
                  const students = STUDENTS_MOCK.filter(st => st.schoolId === sch.id);
                  const certified = students.filter(st => st.currentLevel >= 5).length;
                  const avgLevel = students.length > 0 ? Math.round(students.reduce((a, st) => a + st.currentLevel, 0) / students.length) : 0;
                  return (
                    <div key={sch.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-400 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900">{sch.name}</h4>
                          <p className="text-xs text-slate-400">{sch.id} · {sch.blockCode} · {sch.stateCode}/{sch.districtCode}</p>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sch.strength === 'high' ? 'text-indigo-700 bg-indigo-50 border border-indigo-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>{sch.strength}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 pt-3 border-t border-slate-100">
                        <div className="text-center"><div className="text-lg font-bold text-slate-900">{students.length}</div><div className="text-[10px] text-slate-400">Students</div></div>
                        <div className="text-center"><div className="text-lg font-bold text-slate-900">{sch.teachersCount}</div><div className="text-[10px] text-slate-400">Teachers</div></div>
                        <div className="text-center"><div className="text-lg font-bold text-emerald-600">{certified}</div><div className="text-[10px] text-slate-400">Certified</div></div>
                        <div className="text-center"><div className="text-lg font-bold text-slate-900">L{avgLevel}</div><div className="text-[10px] text-slate-400">Avg Level</div></div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>Certification Rate</span><span>{students.length > 0 ? Math.round(certified / students.length * 100) : 0}%</span></div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${students.length > 0 ? (certified / students.length) * 100 : 0}%` }} /></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">{students.map(st => (
                        <span key={st.id} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${st.levelHistory.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{st.name.split(' ')[0]} L{st.currentLevel}</span>
                      ))}</div>
                    </div>
                  );
                })}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (panel === 'blocks') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Block Administration" desc="All blocks under your district jurisdiction" icon={<MapPin className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{BLOCKS.map(b => (
          <div key={b.code} className="border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between"><span className="font-bold text-sm">{b.code}</span><span className="text-xs text-slate-400">Dist: {b.district}</span></div>
            <div className="flex gap-4 text-xs"><span>🏫 {b.schools} schools</span><span>👨‍🎓 {b.students} students</span></div>
            <div><div className="flex justify-between text-[10px] mb-0.5"><span>Certification</span><span>{b.certifiedRate}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${b.certifiedRate}%` }} /></div></div>
          </div>
        ))}</div>
      </div>
    );
  }

  // ===================== SUPERADMIN PANELS =====================
  if (panel === 'users') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="User Management" desc="All registered users across the FLN system" icon={<Users className="h-5 w-5" />} />
        <div className="space-y-2">{USERS_MOCK.map(u => (
          <div key={u.email} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg">
            <div><div className="font-medium text-sm">{u.name}</div><div className="text-xs text-slate-400 font-mono">{u.email}</div></div>
            <div className="flex items-center gap-3"><span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{u.role}</span><span className="text-xs text-slate-400">{u.scope}</span><span className="text-[10px] font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">{u.status}</span></div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'question_bank') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Question Bank" desc="Curated repository of FLN assessment questions across all 59 levels" icon={<BookOpen className="h-5 w-5" />} />
        <div className="space-y-2">{QUESTION_BANK.map(q => (
          <div key={q.id} className="p-3 border border-slate-100 rounded-lg">
            <div className="flex justify-between items-start"><div><span className="text-[10px] font-mono font-bold text-slate-400">{q.id}</span><span className="text-sm font-medium ml-2">{q.question}</span></div><div className="flex gap-1 shrink-0"><span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{q.topic}</span><span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">L{q.level}</span><span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{q.difficulty}</span></div></div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'worksheet_templates') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Worksheet Templates" desc="Pre-designed assessment templates for each grade and cycle" icon={<ClipboardList className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{WS_TEMPLATES.map(t => (
          <div key={t.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between"><span className="font-bold text-sm">{t.name}</span><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${t.status === 'Published' ? 'text-green-700 bg-green-50 border border-green-200' : t.status === 'Draft' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-blue-700 bg-blue-50 border border-blue-200'}`}>{t.status}</span></div>
            <div className="text-xs text-slate-400">{t.id} · Grade: {t.grade}</div>
            <div className="flex gap-3 text-xs text-slate-500"><span>📝 {t.questions} questions</span><span>⏱ {t.duration}</span></div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'content') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Content Library" desc="Educational resources, lesson plans, and teaching aids" icon={<BookMarked className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{CONTENT_ITEMS.map(c => (
          <div key={c.id} className="border border-slate-200 rounded-lg p-4 space-y-2 hover:border-slate-400 transition-all">
            <div className="flex justify-between"><span className="font-bold text-sm">{c.title}</span><span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${c.status === 'Approved' ? 'text-green-700 bg-green-50 border border-green-200' : c.status === 'Draft' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-blue-700 bg-blue-50 border border-blue-200'}`}>{c.status}</span></div>
            <div className="text-xs text-slate-400">{c.type} · Level {c.level}</div>
            <div className="text-xs text-slate-500">Languages: {c.language}</div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (panel === 'analytics') {
    const isAdmin = [UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(currentUser.role);
    const data = isAdmin ? DISTRICTS : SCHOOLS_MOCK;
    const title = isAdmin ? 'Geographical Analytics' : 'Performance Analytics';
    const desc = isAdmin ? 'Cross-regional performance metrics and benchmarking' : 'School-level performance data and trends';
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Schools" value={SCHOOLS_MOCK.length} subtext="All facilities" icon={SchoolIcon} />
          <MetricCard title="Total Students" value={STUDENTS_MOCK.length} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg FLN Level" value={`L${Math.round(STUDENTS_MOCK.reduce((a, s) => a + s.currentLevel, 0) / STUDENTS_MOCK.length)}`} subtext="System average" icon={BarChart3} />
          <MetricCard title="Certification Rate" value={`${Math.round(STUDENTS_MOCK.filter(s => s.currentLevel >= 5).length / STUDENTS_MOCK.length * 100)}%`} subtext="Level 5+ benchmark" icon={Award} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <PageHeader title={title} desc={desc} icon={<BarChart3 className="h-5 w-5" />} />
          <div className="space-y-3 mt-4">{data.map((d: any) => (
            <div key={d.code || d.id} className="flex items-center gap-4 p-3 border border-slate-100 rounded-lg">
              <span className="font-bold text-sm w-20">{d.code || d.id}</span>
              <span className="text-sm flex-1">{d.name || d.districtCode}</span>
              <span className="text-xs text-slate-400 w-24">{d.schools || '—'} schools</span>
              <div className="w-32"><div className="flex justify-between text-[10px] mb-0.5"><span>{d.certifiedRate || 0}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.certifiedRate || 0}%` }} /></div></div>
            </div>
          ))}</div>
        </div>
      </div>
    );
  }

  if (panel === 'system_settings') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Configuration" desc="Core platform settings and infrastructure" icon={<Settings className="h-5 w-5" />} />
          <div className="space-y-3">{[
            { label: 'Platform Name', value: 'National FLN Assessment Portal' },
            { label: 'Version', value: 'v2.4.1 (Build 2026.07)' },
            { label: 'Environment', value: 'Production' },
            { label: 'Database', value: 'PostgreSQL 15.2 / Redis 7.0' },
            { label: 'API Rate Limit', value: '1000 req/min per user' },
            { label: 'Session Timeout', value: '120 minutes' },
            { label: 'Auth Provider', value: 'Email + Password (SLA §3.2)' },
            { label: 'AI Model', value: 'Gemini 1.5 Pro (Fine-tuned FLN)' },
          ].map(c => (
            <div key={c.label} className="flex justify-between text-sm py-2 border-b border-slate-50"><span className="text-slate-500">{c.label}</span><span className="font-medium text-slate-800 font-mono text-xs">{c.value}</span></div>
          ))}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="System Health" desc="Recent operational logs and status" icon={<Database className="h-5 w-5" />} />
          <div className="space-y-2">{SYSTEM_LOGS_MOCK.map(l => (
            <div key={l.action} className="flex items-center gap-3 p-2 border border-slate-100 rounded text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${l.status === 'Success' ? 'bg-green-500' : l.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className="font-medium w-32">{l.action}</span>
              <span className="text-slate-400 flex-1">{l.details}</span>
              <span className="text-slate-400 font-mono">{l.timestamp}</span>
            </div>
          ))}</div>
          <button className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 mt-2"><RefreshCw className="w-3 h-3" /> Refresh Status</button>
        </div>
      </div>
    );
  }

  // Fallback for any unmatched panel — renders the roles workspace (dashboard) as the content
  return null;
};
