import { apiFetch, withBase } from '../services/apiClient';
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Student, ClassGroup, School, EvaluationReport, LogEntry, Ticket } from '../types';
import {
  Users,
  ShieldAlert,
  BookOpen,
  UserCheck,
  Calendar,
  ArrowRight,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Layers,
  Award,
  MapPin,
  School as SchoolIcon,
  BarChart3,
  FileText,
  ClipboardList,
  Building2,
  GraduationCap,
  BookMarked,
  Globe,
  Settings,
  Database,
  RefreshCw,
  Search,
  ChevronDown,
  Download,
  Printer,
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, ClassGroup, School, Worksheet, LogEntry, Ticket } from '../types';
import { Users, BookOpen, Calendar, ArrowRight, SlidersHorizontal, Layers, Award, MapPin, School as SchoolIcon, BarChart3, FileText, Building2, BookMarked, Globe, Settings, Database, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { Table, Column } from './Table';
import { MetricCard } from './Card';
import { STATE_NAMES, DISTRICT_NAMES, BLOCK_NAMES } from '../constants';
import { FLN_LEVELS_LIST, parseCSVText, LevelBadge } from './RoleDashboards';
import { usePanelData } from './panels/usePanelData';
import { AdaptiveTestPanel } from './panels/AdaptiveTestPanel';
import { TestHistoryPanel } from './panels/TestHistoryPanel';
import { WorksheetTemplatesPanel } from './panels/WorksheetTemplatesPanel';
import { SystemSettingsPanel } from './panels/SystemSettingsPanel';
import { StudentListPanel } from './panels/StudentListPanel';
import { AadhaarRevealPanel } from './panels/AadhaarRevealPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { DiagnosticTestPanel } from './panels/DiagnosticTestPanel';
import { PerformancePanel } from './panels/PerformancePanel';
import { WorksheetsPanel } from './panels/WorksheetsPanel';
import { AssignedSchoolsPanel } from './panels/AssignedSchoolsPanel';
import { StudentProgressPanel } from './panels/StudentProgressPanel';
import { AttendancePanel } from './panels/AttendancePanel';
import { TeachersPanel } from './panels/TeachersPanel';
import { SchoolsPanel } from './panels/SchoolsPanel';
import { UsersPanel } from './panels/UsersPanel';
import { ContentPanel } from './panels/ContentPanel';
import { DistrictsPanel } from './panels/DistrictsPanel';
import { BlocksPanel } from './panels/BlocksPanel';
import { AnalyticsPanel } from './panels/AnalyticsPanel';
import { StudentProfilePanel } from './panels/StudentProfilePanel';

interface PanelViewsProps {
  activePanel: string;
  currentUser: User;
  token: string;
  /**
   * Routes the admin to a different panel (e.g. `security`) when
   * a sub-flow needs to hand off. The Aadhaar reveal dialog uses
   * this to send admins to the Security panel when they don't have
   * an enrolled authenticator yet. Optional so other entry points
   * (where the sub-flow is never reached) don't need to thread it.
   */
  onSelectView?: (view: string) => void;
}

// Panels that render without ever reading the `students` variable — skipping
// the fetch on these avoids an up-to-86,400-record national payload on
// screens that don't display any student data.
const STUDENTS_NOT_NEEDED_PANELS = new Set(['users', 'worksheet_templates', 'content', 'system_settings']);

const STUDENTS_FALLBACK: Student[] = [
  { id: 's1', name: 'Amanpreet Singh', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 12, currentSubLevel: 0, targetLevel: 13, aadharMasked: 'XXXX-XXXX-1234', levelHistory: [{ level: 12, subLevel: 0, date: '2026-03-15', reason: 'Diagnostic' }], streak: 3 },
  { id: 's2', name: 'Jasmine Kaur', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 8, currentSubLevel: 1, targetLevel: 12, aadharMasked: 'XXXX-XXXX-5678', levelHistory: [{ level: 8, subLevel: 1, date: '2026-02-20', reason: 'Mid-year' }], streak: 1 },
  { id: 's3', name: 'Rohit Kumar', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', currentLevel: 36, currentSubLevel: 0, targetLevel: 37, aadharMasked: 'XXXX-XXXX-9012', levelHistory: [{ level: 36, date: '2026-01-10', reason: 'Baseline' }], streak: 5 },
  { id: 's4', name: 'Priya Sharma', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 10, currentSubLevel: 2, targetLevel: 14, aadharMasked: 'XXXX-XXXX-3456', levelHistory: [], streak: 0 },
  { id: 's5', name: 'Arjun Verma', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', currentLevel: 6, currentSubLevel: 0, targetLevel: 11, aadharMasked: 'XXXX-XXXX-7890', levelHistory: [{ level: 6, date: '2026-04-01', reason: 'Diagnostic' }], streak: 2 },
  { id: 's6', name: 'Neha Gupta', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', currentLevel: 38, currentSubLevel: 1, targetLevel: 40, aadharMasked: 'XXXX-XXXX-2345', levelHistory: [{ level: 38, date: '2026-03-01', reason: 'Mid-year' }], streak: 4 },
  { id: 's7', name: 'Simran Kaur', age: 6, classGroup: 'Class 1', section: 'A', schoolId: 'gps-mt-001', currentLevel: 4, currentSubLevel: 0, targetLevel: 8, aadharMasked: 'XXXX-XXXX-6789', levelHistory: [], streak: 0 },
];

type RankedStudent = {
  student: Student;
  rank: number;
  issuedAt?: string;
};

const ordinal = (rank: number) => {
  const endings = ['th', 'st', 'nd', 'rd'];
  const remainder = rank % 100;
  return `${rank}${endings[(remainder - 20) % 10] || endings[remainder] || endings[0]}`;
};

const printCertificate = async (certificate?: HTMLDivElement) => {
  await document.fonts?.ready;
  const originalParent = certificate?.parentNode;
  const originalNextSibling = certificate?.nextSibling;

  // Normal certificates live below the student-profile header and tabs. Move
  // only that print target to the body while the dialog is open so none of its
  // screen-layout ancestors can contribute a top offset to the printed page.
  if (certificate) document.body.appendChild(certificate);

  const cleanup = () => {
    document.body.classList.remove('printing-certificate');
    document.body.classList.remove('printing-normal-certificate');
    if (certificate && originalParent) {
      originalParent.insertBefore(certificate, originalNextSibling ?? null);
    }
  };
  document.body.classList.add('printing-certificate');
  if (certificate) document.body.classList.add('printing-normal-certificate');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
};

function RankCertificate({ ranked, teacherName, allStudents, certificateRef }: { ranked: RankedStudent; teacherName: string; allStudents: Student[]; certificateRef?: React.RefObject<HTMLDivElement | null> }) {
  const issuedAt = ranked.issuedAt ? new Date(ranked.issuedAt) : new Date();
  const issuedDate = issuedAt.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const weekOfMonth = Math.ceil(issuedAt.getDate() / 7);
  const month = issuedAt.toLocaleDateString('en-IN', { month: 'long' });
  const classmates = allStudents
    .filter(student => student.classGroup === ranked.student.classGroup && student.section === ranked.student.section)
    .sort((a, b) => b.currentLevel - a.currentLevel || b.streak - a.streak || a.name.localeCompare(b.name));
  const classRank = classmates.findIndex(student => student.id === ranked.student.id) + 1;

  return (
    <div ref={certificateRef} data-certificate-preview className="rank-certificate">
      <div className="rank-certificate__paper">
        <span className="rank-certificate__corner rank-certificate__corner--tl" aria-hidden="true" />
        <span className="rank-certificate__corner rank-certificate__corner--br" aria-hidden="true" />

        <div className="rank-certificate__content">
          <p className="rank-certificate__portal">FLN PORTAL · FOUNDATIONAL LITERACY &amp; NUMERACY</p>
          <p className="rank-certificate__title">
            <span className="rank-certificate__title-main">Certificate</span>
            <span className="rank-certificate__title-sub">of Appreciation</span>
          </p>
          <p className="rank-certificate__awarded">This Certificate is Awarded to :</p>
          <p className="rank-certificate__name">{ranked.student.name}</p>
          <div className="rank-certificate__divider" />
          <p className="rank-certificate__achievement">For coming in top 5 as of {ordinal(weekOfMonth)} week of {month}</p>
          <div className="rank-certificate__facts">
            <span>Class <b>{ranked.student.classGroup} {ranked.student.section}</b></span>
            <span>Class comparison <b>#{classRank} of {classmates.length}</b></span>
            <span>Level <b>L{ranked.student.currentLevel}.{ranked.student.currentSubLevel ?? 0}</b></span>
          </div>
          <div className="rank-certificate__bottom">
            <div className="rank-certificate__signatures">
              <div><strong>{issuedDate}</strong><span>Date</span></div>
            </div>
            <div className="rank-certificate__medal" aria-label={`${ordinal(ranked.rank)} rank`}>
              <svg className="rank-certificate__medal-ribbon" viewBox="0 0 287 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M220.027 0H143.341H66.6835L0 147.997L66.6549 122.761L91.8911 189.416L143.341 75.1915L194.791 189.416L220.027 122.761L286.682 147.997L220.027 0Z" fill="#2298FF" />
              </svg>
              <span className="rank-certificate__medal-ring-outer" aria-hidden="true" />
              <span className="rank-certificate__medal-ring-inner" aria-hidden="true" />
              <span className="rank-certificate__medal-circle"><span>{ranked.rank}</span></span>
            </div>
            <div className="rank-certificate__signatures">
              <div><strong>{teacherName}</strong><span>Teacher</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

const SCHOOLS_FALLBACK: School[] = [
  { id: 'gps-mt-001', name: 'GPS Model Town', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'standard', teachersCount: 8, isAccessLocked: false },
  { id: 'gps-vl-002', name: 'GPS Village Lohara', stateCode: 'PB', districtCode: 'MOG', blockCode: 'MOG-01', strength: 'standard', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-amb-003', name: 'GPS Ambala Cantt', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01', strength: 'standard', teachersCount: 6, isAccessLocked: false },
  { id: 'gps-jai-004', name: 'GPS Govind Dev Ji', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-01', strength: 'standard', teachersCount: 7, isAccessLocked: true },
  { id: 'gps-lko-005', name: 'GPS Hazratganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01', strength: 'standard', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-bth-006', name: 'GPS Bathinda City', stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01', strength: 'standard', teachersCount: 4, isAccessLocked: false },
  { id: 'gps-asr-007', name: 'GPS Amritsar', stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01', strength: 'standard', teachersCount: 6, isAccessLocked: false },
  { id: 'gps-pkl-008', name: 'GPS Panchkula', stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01', strength: 'standard', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-jai2-009', name: 'GPS Jaipur Rural', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02', strength: 'standard', teachersCount: 3, isAccessLocked: false },
  { id: 'gps-uda-010', name: 'GPS Udaipur', stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01', strength: 'standard', teachersCount: 3, isAccessLocked: false },
  { id: 'gps-lko2-011', name: 'GPS Aliganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02', strength: 'standard', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-knp-012', name: 'GPS Kanpur', stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01', strength: 'standard', teachersCount: 5, isAccessLocked: false },
  { id: 'gps-pb-ldh2-013', name: 'GPS Gill Village', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02', strength: 'standard', teachersCount: 2, isAccessLocked: false },
  { id: 'gps-hr-amb2-014', name: 'GPS Ambala South', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02', strength: 'standard', teachersCount: 2, isAccessLocked: false },
];

const USERS_FALLBACK = [
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

const WS_TEMPLATES = [
  { id: 'WST-001', name: 'Baseline Assessment L1-L5', grade: 'Preschool 1-2', questions: 8, duration: '30 min', status: 'Published' },
  { id: 'WST-002', name: 'Number Sense L6-L11', grade: 'Class 1', questions: 10, duration: '45 min', status: 'Published' },
  { id: 'WST-003', name: 'Operations L12-L23', grade: 'Class 2', questions: 12, duration: '45 min', status: 'Draft' },
  { id: 'WST-004', name: 'Adv. Operations L24-L35', grade: 'Class 2 Review', questions: 10, duration: '60 min', status: 'Published' },
  { id: 'WST-005', name: 'Multiplication & Division L36-L48', grade: 'Class 3-4', questions: 15, duration: '60 min', status: 'Draft' },
  { id: 'WST-006', name: 'Fractions & Decimals L76-L93', grade: 'Class 4+', questions: 12, duration: '60 min', status: 'Review' },
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
    <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
      {icon && <div className="text-slate-500 dark:text-slate-400">{icon}</div>}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function EmptyStudents({ students }: { students: Student[] }) {
  const cols: Column<Student>[] = [
    { header: 'ID', accessor: 'id', className: 'font-mono text-xs text-slate-400 dark:text-slate-500' },
    { header: 'Name', accessor: 'name', sortKey: 'name', className: 'font-semibold text-slate-800 dark:text-slate-100' },
    { header: 'Class', accessor: 'classGroup', className: '' },
    { header: 'Level', accessor: (s) => `L${s.currentLevel}.${s.currentSubLevel ?? 0}`, className: 'font-mono' },
    { header: 'Streak', accessor: (s) => `${s.streak} 🔥`, className: '' },
  ];
  return <Table data={students} columns={cols} searchPlaceholder="Search students..." searchKey="name" />;
}

export const PanelViews: React.FC<PanelViewsProps> = ({ activePanel, currentUser, token }) => {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [distFilter, setDistFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [sel, setSel] = useState('');
  const [profileTab, setProfileTab] = useState<
    'overview' | 'academic' | 'personal' | 'activity' | 'certificate'
  >('overview');

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<Student>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'assessment' | 'level_change'>('all');
  const [expandedDistRpt, setExpandedDistRpt] = useState<string | null>(null);
  const [expandedDist, setExpandedDist] = useState<string | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState('superadmin');
  const [userSearch, setUserSearch] = useState('');
  const [rankCertificate, setRankCertificate] = useState<RankedStudent | null>(null);
  const certificatePreviewRef = useRef<HTMLDivElement>(null);
  const rankCertificatePreviewRef = useRef<HTMLDivElement>(null);

  const [apiStudents, setApiStudents] = useState<Student[]>([]);
  const [apiSchools, setApiSchools] = useState<School[]>([]);
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [apiReports, setApiReports] = useState<EvaluationReport[]>([]);
  const [apiTeachers, setApiTeachers] = useState<any[]>([]);

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/api/schools', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiSchools(d); }).catch(() => {});
    apiFetch('/api/admin/coordinators', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiUsers(d); }).catch(() => {});
    apiFetch('/api/evaluation/reports', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiReports(d); }).catch(() => {});
    if (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.BLOCK_ADMIN) {
      apiFetch('/api/teachers', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiTeachers(d); }).catch(() => {});
    }
  }, [token, currentUser.role]);

  // GET /api/students returns the caller's whole role-scoped list — up to
  // 86,400 records nationally for Superadmin — so skip it entirely on the
  // handful of Superadmin-only panels that never read `students` at all
  // (verified by grepping for the identifier in each branch below).
  useEffect(() => {
    if (apiStudents.length > 0) return;
    if (STUDENTS_NOT_NEEDED_PANELS.has(activePanel)) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/api/students', { headers }).then(r => r.json()).then(d => { if (Array.isArray(d)) setApiStudents(d); }).catch(() => {});
  }, [token, activePanel, apiStudents.length]);

const students = apiStudents.length > 0 ? apiStudents : STUDENTS_FALLBACK;
  const schools = apiSchools.length > 0 ? apiSchools : SCHOOLS_FALLBACK;
  const usersList = apiUsers.length > 0 ? apiUsers : USERS_FALLBACK;
  const reportsList: EvaluationReport[] = apiReports.length > 0 ? apiReports : REPORTS_MOCK;
  const teachersList = apiTeachers.length > 0 ? apiTeachers : TEACHERS_MOCK;

  // Real per-district / per-block rollups, derived from the already-fetched
  // schools + students (no dedicated aggregation endpoint exists).
  const getDistrictStats = (stateCode: string) => {
    const stateSchools = schools.filter(s => s.stateCode === stateCode);
    const codes: string[] = Array.from(new Set(stateSchools.map(s => s.districtCode)));
    return codes.map(code => {
      const distSchools = stateSchools.filter(s => s.districtCode === code);
      const distStudents = students.filter(st => distSchools.some(s => s.id === st.schoolId));
      const certified = distStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: DISTRICT_NAMES[code] || code,
        state: stateCode,
        schools: distSchools.length,
        students: distStudents.length,
        certifiedRate: distStudents.length > 0 ? Math.round((certified / distStudents.length) * 100) : 0,
      };
    });
  };

  const getBlockStats = (districtCode: string) => {
    const distSchools = schools.filter(s => s.districtCode === districtCode);
    const codes: string[] = Array.from(new Set(distSchools.map(s => s.blockCode)));
    return codes.map(code => {
      const blockSchools = distSchools.filter(s => s.blockCode === code);
      const blockStudents = students.filter(st => blockSchools.some(s => s.id === st.schoolId));
      const certified = blockStudents.filter(st => st.currentLevel >= 5).length;
      return {
        code,
        name: BLOCK_NAMES[code] || code,
        district: districtCode,
        schools: blockSchools.length,
        students: blockStudents.length,
        certifiedRate: blockStudents.length > 0 ? Math.round((certified / blockStudents.length) * 100) : 0,
      };
    });
  };

  useEffect(() => {
    if (students.length > 0 && !sel) {
      setSel(students[0].id);
    }
  }, [students, sel]);

  const filteredSchools = schools.filter(s => {
    if (stateFilter !== 'all' && s.stateCode !== stateFilter) return false;
    if (distFilter !== 'all' && s.districtCode !== distFilter) return false;
    if (blockFilter !== 'all' && s.blockCode !== blockFilter) return false;
    return true;
  });

  const panel = activePanel;
  const canIssueCertificates = [UserRole.TEACHER, UserRole.VOLUNTEER].includes(currentUser.role);

  useEffect(() => {
    if (!canIssueCertificates && profileTab === 'certificate') {
      setProfileTab('overview');
    } else if (canIssueCertificates && panel === 'certificates') {
      setProfileTab('certificate');
    }
  }, [canIssueCertificates, panel, profileTab]);

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
          <div class="title">FLN Portal</div>
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
          Generated automatically by the FLN Portal. Confidential Student Academic Record.
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

  const legacyDownloadCertificate = async (student: Student) => {
    // Certificates are deliberately available only in the teacher workspace. The
    // values below are the selected student returned by the authenticated roster
    // API and the authenticated teacher's name, rather than form input.
    if (currentUser.role !== UserRole.TEACHER) return;

    // This must happen synchronously within the click event. Opening it after
    // awaiting the API request makes modern browsers block it as a popup.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download the certificate as a PDF.');
      return;
    }
    printWindow.document.write('<title>Preparing certificate…</title><p style="font-family:system-ui;padding:2rem">Preparing your PDF certificate…</p>');

    const certificate: {
      student: Pick<Student, 'name' | 'classGroup' | 'section' | 'currentLevel' | 'currentSubLevel' | 'streak'>;
      teacherName: string;
      issuedOn: string;
    } = {
      // `student` is the selected record from the authenticated /api/students
      // roster; `currentUser` is the authenticated teacher session.
      student: {
        name: student.name,
        classGroup: student.classGroup,
        section: student.section,
        currentLevel: student.currentLevel,
        currentSubLevel: student.currentSubLevel,
        streak: student.streak,
      },
      teacherName: currentUser.name,
      issuedOn: new Date().toISOString(),
    };

    const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char] || char));
    const issueDate = new Date(certificate.issuedOn).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const isClassOne = /^class\s*1(?:\D|$)/i.test(certificate.student.classGroup.trim());
    const isClassTwo = /^class\s*2(?:\D|$)/i.test(certificate.student.classGroup.trim());

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Certificate - ${escapeHtml(certificate.student.name)}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Luxurious+Script&family=Caveat:wght@700&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 landscape; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; background: #f8fafc; color: #172554; font-family: Georgia, 'Times New Roman', serif; }
            .certificate { position: relative; width: 297mm; min-height: 210mm; overflow: hidden; background: #fffdf8; padding: 18mm 26mm; }
            .certificate::before, .certificate::after { content: ''; position: absolute; inset: 8mm; border: 3px solid #fb923c; pointer-events: none; }
            .certificate::after { inset: 11mm; border: 2px solid #facc15; }
            .ribbon { position: absolute; top: 0; left: 0; right: 0; height: 15mm; background: linear-gradient(90deg, #ef4444, #fb923c, #facc15); }
            .corner { position: absolute; font-family: Arial, sans-serif; font-size: 42px; line-height: 1; z-index: 1; }
            .one { top: 19mm; left: 16mm; color: #facc15; } .two { top: 18mm; right: 17mm; color: #14b8a6; }
            .three { bottom: 14mm; left: 17mm; color: #fb923c; } .four { bottom: 15mm; right: 17mm; color: #f43f5e; }
            .content { position: relative; z-index: 2; text-align: center; }
            .seal { display: inline-flex; width: 32mm; height: 32mm; align-items: center; justify-content: center; border-radius: 50%; background: #facc15; border: 4px solid #f97316; color: #fff; font: 700 34px Arial, sans-serif; box-shadow: 0 0 0 5px #fffdf8, 0 0 0 8px #14b8a6; }
            .portal { margin: 6mm 0 2mm; color: #0f766e; font: 700 12px Arial, sans-serif; letter-spacing: 3px; text-transform: uppercase; }
            h1 { margin: 2mm 0 4mm; color: #172554; font-size: 27pt; letter-spacing: 1px; }
            .excellence { margin: 0; color: #f97316; font: 800 34pt Arial, sans-serif; letter-spacing: 3px; text-transform: uppercase; }
            .intro { margin: 12mm 0 5mm; font-size: 16pt; color: #475569; }
            .student { display: inline-block; min-width: 145mm; padding: 0 10mm 3mm; border-bottom: 2px solid #172554; color: #1d4ed8; font-size: 26pt; font-weight: 700; }
            .summary { margin: 8mm auto 10mm; max-width: 195mm; color: #334155; font-size: 14pt; line-height: 1.6; }
            .summary strong { color: #0f766e; }
            .facts { display: flex; justify-content: center; gap: 8mm; margin: 7mm auto 15mm; }
            .fact { min-width: 52mm; padding: 4mm 6mm; border-radius: 6mm; background: #ecfeff; border: 1px solid #67e8f9; color: #155e75; font: 700 11pt Arial, sans-serif; }
            .fact b { display: block; margin-top: 1mm; color: #0f766e; font-size: 17pt; }
            .signatures { display: flex; justify-content: center; gap: 48mm; color: #334155; font-size: 11pt; }
            .signature { width: 62mm; padding-top: 5mm; border-top: 1.5px solid #334155; }
            .signature strong { display: block; margin-bottom: 1mm; color: #172554; font-family: Arial, sans-serif; }
            .download-note { position: absolute; right: 18mm; bottom: 16mm; color: #64748b; font: 9pt Arial, sans-serif; }
            /* A playful, early-years treatment used only for Class 1 certificates. */
            .certificate.class-one { background: #fff; font-family: 'Comic Sans MS', 'Trebuchet MS', Arial, sans-serif; }
            .class-one::before { border-color: #ff5d3b; border-width: 2px; }
            .class-one::after { border-color: #ffbd15; border-width: 3px; }
            .class-one .ribbon { height: 3mm; background: linear-gradient(90deg, #ff4055, #ff6530, #ffc51a); }
            .class-one .seal { display: none; }
            .class-one .portal { margin-top: 14mm; color: #55bdca; font-size: 10pt; letter-spacing: 2px; }
            .class-one h1 { margin-top: 2mm; color: #000; font-size: 34pt; font-family: 'Comic Sans MS', 'Trebuchet MS', Arial, sans-serif; }
            .class-one .excellence { color: #ff5c28; font-size: 47pt; font-family: 'Comic Sans MS', 'Trebuchet MS', Arial, sans-serif; letter-spacing: 1px; }
            .class-one .intro { margin-top: 9mm; color: #5b4b2c; font-size: 17pt; }
            .class-one .student { color: #111; font-size: 25pt; min-width: 160mm; }
            .class-one .summary { margin-top: 5mm; color: #5b4b2c; font-size: 13pt; }
            .class-one .facts { margin-top: 5mm; margin-bottom: 10mm; }
            .class-one .fact { background: #fffdf4; border-color: #ffd76a; color: #7a521d; border-radius: 5mm; }
            .class-one .fact b { color: #f35d2a; }
            .class-one-decor { position: absolute; z-index: 1; font-family: Arial, sans-serif; }
            .class-one-sun { top: 11mm; left: 13mm; color: #ffc21a; font-size: 72pt; line-height: 1; text-shadow: 0 2px 0 #f7941d; }
            .class-one-sun span { display: block; color: #58c3cf; font: 700 11pt 'Comic Sans MS', Arial; transform: rotate(-17deg); margin-top: -15px; }
            .class-one-rainbow { top: 9mm; right: 15mm; padding: 7mm 5mm 3mm; border: 8px solid #ff6631; border-bottom: 0; border-radius: 80mm 80mm 0 0; color: #fff; background: #54c4ce; font: 700 18pt 'Comic Sans MS', Arial; transform: rotate(12deg); }
            .class-one-trophy { right: 26mm; bottom: 43mm; color: #f4a329; font-size: 45pt; }
            .class-one-stars { bottom: 15mm; left: 22mm; color: #ffc21a; font-size: 30pt; letter-spacing: 18mm; }
            /* Class 2 gets its own colourful school-themed certificate. */
            .certificate.class-two { background: #cfe9fb; padding: 18mm 26mm; font-family: Arial, sans-serif; }
            .class-two::before { border-color: #0D99FF; border-radius: 20px; }
            .class-two::after { border-color: #0D99FF; border-radius: 14px; background: none; box-shadow: none; opacity: 1; }
            .class-two .ribbon, .class-two .seal, .class-two .corner { display: none; }
            .class-two .content { padding: 12mm 10mm; z-index: 2; }
            .class-two .portal { color: #0D99FF; }
            .class-two h1 { margin: 5mm 0 3mm; color: #0D99FF; font-family: 'Luxurious Script', cursive; font-size: 44pt; font-weight: 400; letter-spacing: 0; }
            .class-two .excellence { color: #0D99FF; font-family: 'Caveat', cursive; font-size: 52pt; font-weight: 700; letter-spacing: 0; text-transform: none; }
            .class-two .intro { margin-top: 15mm; color: #0D99FF; font-size: 17pt; letter-spacing: 2px; }
            .class-two .student { color: #1E1E1E; font: 700 28pt Arial, sans-serif; min-width: 145mm; border-color: #0D99FF; }
            .class-two .summary { color: #0D99FF; font-size: 13pt; margin-top: 7mm; }
            .class-two .facts { margin-top: 6mm; margin-bottom: 11mm; }
            .class-two .fact { background: #fff; border-color: #0D99FF; color: #0D99FF; }
            .class-two .fact b { color: #0D99FF; }
            .class-two-star { position: absolute; z-index: 3; color: #facc15; -webkit-text-stroke: 2px #fff; paint-order: stroke fill; }
            .class-two-star.big { font-size: 52pt; } .class-two-star.med { font-size: 26pt; } .class-two-star.small { font-size: 18pt; }
            .class-two-star.tl-1 { top: 6mm; left: 12mm; } .class-two-star.tl-2 { top: 20mm; left: 26mm; } .class-two-star.tl-3 { top: 15mm; left: 38mm; }
            .class-two-star.tr-1 { top: 4mm; right: 12mm; } .class-two-star.bl-1 { bottom: 16mm; left: 16mm; }
            @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { background: #fff; } .certificate { page-break-after: avoid; } }
          </style>
        </head>
        <body>
          <main class="certificate${isClassOne ? ' class-one' : isClassTwo ? ' class-two' : ''}">
            <div class="ribbon"></div>${isClassOne
              ? '<div class="class-one-decor class-one-sun">☀<span>FANTASTIC!</span></div><div class="class-one-decor class-one-rainbow">Brilliant!</div><div class="class-one-decor class-one-trophy">🏆</div><div class="class-one-decor class-one-stars">★ ✦ ★</div>'
              : isClassTwo
                ? '<div class="class-two-star big tl-1">★</div><div class="class-two-star med tl-2">★</div><div class="class-two-star small tl-3">★</div><div class="class-two-star big tr-1">★</div><div class="class-two-star small bl-1">★</div>'
              : '<div class="corner one">★</div><div class="corner two">✦</div><div class="corner three">✶</div><div class="corner four">✹</div>'}
            <div class="content">
              <div class="seal">★</div>
              <div class="portal">FLN Portal · Foundational Literacy &amp; Numeracy</div>
              <h1>Certificate of</h1>
              <p class="excellence">Excellence</p>
              <p class="intro">This certificate is proudly presented to</p>
              <div class="student">${escapeHtml(certificate.student.name)}</div>
              <p class="summary">for their dedicated learning journey and progress in foundational literacy and numeracy.</p>
              <div class="facts">
                <div class="fact">Class<b>${escapeHtml(`${certificate.student.classGroup} - ${certificate.student.section}`)}</b></div>
                <div class="fact">Current Level<b>L${certificate.student.currentLevel}.${certificate.student.currentSubLevel ?? 0}</b></div>
                <div class="fact">Learning Streak<b>${certificate.student.streak} days</b></div>
              </div>
              <div class="signatures">
                <div class="signature"><strong>${issueDate}</strong>Date issued</div>
                <div class="signature"><strong>${escapeHtml(certificate.teacherName)}</strong>Teacher signature</div>
              </div>
            </div>
            <div class="download-note">Issued digitally by FLN Portal</div>
          </main>
          <script>
            // Native print-to-PDF preserves the page's HTML and CSS as vectors;
            // unlike the old canvas screenshot, it does not reduce print quality.
            window.onload = () => window.setTimeout(() => window.print(), 300);
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintCertificate = async () => {
    if (!certificatePreviewRef.current) return;
    try {
      await printCertificate(certificatePreviewRef.current);
    } catch (error) {
      console.error(error);
      alert('The certificate could not be printed. Please try again.');
    }
  };

  const printRankCertificate = async () => {
    if (!rankCertificate || !rankCertificatePreviewRef.current) return;
    try {
      await printCertificate();
    } catch (error) {
      console.error(error);
      alert('The certificate could not be printed. Please try again.');
    }
  };

  // ===================== TEACHER PANELS =====================
  if (panel === 'student_list') {
    return (
      <StudentListPanel
        students={students}
        studentsLoading={studentsLoading}
        currentUser={currentUser}
        token={token}
        refreshStudents={refreshStudents}
      />
    );
  }

  if (panel === 'student_profile' || panel === 'certificates') {
    const s = students.find(x => x.id === sel) || students[0];

    const filteredStudents = students.filter(x =>
      x.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      x.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const reports = reportsList.filter(r => r.studentId === s.id);
    const studentSchool = schools.find(sch => sch.id === s.schoolId);
    const att = ATTENDANCE_MOCK.find(a => a.student === s.name);
    const enrollmentDate = s.levelHistory[0]?.date;
    const daysSinceEnroll = enrollmentDate ? Math.floor((Date.now() - new Date(enrollmentDate).getTime()) / 86400000) : null;
    const canEditProfile = (() => {
      switch (currentUser.role) {
        case UserRole.SUPERADMIN:
        case UserRole.ADMIN:
        case UserRole.DISTRICT_ADMIN:
        case UserRole.BLOCK_ADMIN:
          return true;
        case UserRole.SCHOOL:
        case UserRole.TEACHER:
          return s.schoolId === currentUser.schoolId;
        case UserRole.VOLUNTEER:
          return currentUser.assignedSchools?.includes(s.schoolId) ?? false;
        default:
          return false;
      }
    })();
    // Mirrors the backend's redaction in GET /api/students — admins/volunteers
    // never receive guardianContact/address at all, so those fields are
    // indistinguishable from "not set" unless we check role here too.
    const canSeeGuardianPII = currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.TEACHER;
    const startEditingProfile = () => {
      setProfileDraft({
        gender: s.gender, dob: s.dob, guardianName: s.guardianName, guardianRelation: s.guardianRelation,
        guardianContact: s.guardianContact, address: s.address, bloodGroup: s.bloodGroup,
        disabilityStatus: s.disabilityStatus, midDayMealBeneficiary: s.midDayMealBeneficiary,
        busRoute: s.busRoute, siblingsInSchool: s.siblingsInSchool, teacherNotes: s.teacherNotes,
      });
      setEditingProfile(true);
    };
    const saveProfile = async () => {
      setSavingProfile(true);
      try {
        const res = await apiFetch(`/api/students/${s.id}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(profileDraft),
        });
        if (res.ok) {
          setApiStudents(prev => prev.map(st => st.id === s.id ? { ...st, ...profileDraft } : st));
          setEditingProfile(false);
        }
      } finally {
        setSavingProfile(false);
      }
    };
    const classStudents = students.filter(st => st.classGroup === s.classGroup);
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
    const isClassOne = /^class\s*1(?:\D|$)/i.test(s.classGroup.trim());
    const isClassTwo = /^class\s*2(?:\D|$)/i.test(s.classGroup.trim());

    const tabs = [
      { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
      { key: 'academic' as const, label: 'Academic Record', icon: BookOpen },
      { key: 'personal' as const, label: 'Personal Details', icon: Users },
      { key: 'activity' as const, label: 'Activity Log', icon: Calendar },
      ...(canIssueCertificates ? [{ key: 'certificate' as const, label: 'Certificate', icon: Award }] : []),
    ];

    return (
      <div className="space-y-6">
        {/* Student selector header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">{s.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{s.name}</h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">ID: {s.id}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${s.levelHistory.length > 0 ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{s.levelHistory.length > 0 ? 'Active' : 'Pending Diagnostic'}</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate"><strong>{studentSchool?.name || 'N/A'}</strong> · {s.classGroup} - {s.section}{daysSinceEnroll !== null && ` · Enrolled ${daysSinceEnroll} days ago`}</p>
            </div>
            {/* Searchable student selector */}
            <div className="relative shrink-0">
              <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 min-w-[180px] text-left">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="flex-1 truncate">{s.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..." className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No students found</p>
                      ) : filteredStudents.map(x => {
                        const isSelected = x.id === sel;
                        const xAtt = ATTENDANCE_MOCK.find(a => a.student === x.name);
                        return (
                          <button key={x.id} onClick={() => { setSel(x.id); setProfileTab('overview'); setShowDropdown(false); setSearchQuery(''); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{x.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{x.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
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
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-center"><div className="text-lg font-bold text-slate-900 dark:text-white">{reports.length}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Assessments</div></div>
            <div className="text-center"><div className={`text-lg font-bold ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{avgScore > 0 ? `${avgScore}%` : '—'}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Avg Score</div></div>
            <div className="text-center"><div className="text-lg font-bold text-amber-600">L{s.currentLevel}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Current Level</div></div>
            <div className="text-center"><div className="text-lg font-bold text-slate-900 dark:text-white">{s.streak}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Day Streak</div></div>
            <div className="text-center hidden sm:block"><div className={`text-lg font-bold ${att ? (att.percentage >= 85 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}`}>{att ? `${att.percentage}%` : '—'}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">Attendance</div></div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setProfileTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${profileTab === t.key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
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
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Class Comparison</h3>
                <div className="space-y-3">
                  <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-500 dark:text-slate-400">This Student</span><span className="font-bold text-indigo-600">L{s.currentLevel}</span></div><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(s.currentLevel / 93) * 100}%` }} /></div></div>
                  <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-500 dark:text-slate-400">Class Average ({classStudents.length} students)</span><span className="font-bold text-slate-700 dark:text-slate-200">L{classAvg}</span></div><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-slate-500 rounded-full transition-all" style={{ width: `${(classAvg / 93) * 100}%` }} /></div></div>
                  <div className={`p-2 rounded-lg text-xs font-medium text-center ${s.currentLevel > classAvg ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : s.currentLevel === classAvg ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}`}>
                    {s.currentLevel > classAvg ? `↑ ${s.currentLevel - classAvg} levels above class average` : s.currentLevel === classAvg ? 'At class average' : `↓ ${classAvg - s.currentLevel} levels below class average`}
                  </div>
                </div>
                {/* Class rank */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Class Rank</span><span className="font-bold font-mono text-slate-800 dark:text-slate-100">#{classStudents.sort((a, b) => b.currentLevel - a.currentLevel).findIndex(x => x.id === s.id) + 1} / {classStudents.length}</span></div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-2.5 text-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Quick Info</h3>
                {[['Age', `${s.age} yrs`], ['Class & Section', `${s.classGroup} - ${s.section}`], ['Current Level', `L${s.currentLevel}`], ['Attendance', att ? `${att.present}/${att.total} (${att.percentage}%)` : 'N/A']].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5"><span className="text-slate-500 dark:text-slate-400">{l}</span><span className="font-medium text-slate-800 dark:text-slate-100">{v || 'N/A'}</span></div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {/* Score Trend Chart */}
              {reports.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Score Trend</h3>
                  <div className="relative">
                    <div className="flex items-end gap-3 h-40 border-b border-l border-slate-200 dark:border-slate-700 ml-8 pb-2 pl-2">
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
                            <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">{pct}%</span>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative overflow-hidden flex-1 self-stretch" style={{ height: `${barH}px` }}>
                              <div className={`absolute bottom-0 inset-x-0 rounded-t-lg transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                              <span className={`text-[8px] ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>{isUp ? '↑' : '↓'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {reports.length >= 2 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Trend: <strong className={avgScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{avgScore}% avg</strong></span>
                        <span>Best: <strong className="text-emerald-600">{Math.max(...reports.map(r => Math.round((r.score / r.totalQuestions) * 100)))}%</strong></span>
                        <span>Last: <strong>{Math.round((reports[reports.length - 1].score / reports[reports.length - 1].totalQuestions) * 100)}%</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Level Journey */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Level Journey</h3>
                {s.levelHistory.length > 0 ? (
                  <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                    {[...s.levelHistory].reverse().map((lh, i) => (
                      <div key={i} className="flex gap-4 pb-4 relative pl-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow mt-1 shrink-0 z-10" />
                        <div className="flex-1"><div className="flex justify-between"><div><span className="font-bold text-sm text-slate-900 dark:text-white">Level {lh.level}{lh.subLevel !== undefined ? `.${lh.subLevel}` : ''}</span><p className="text-xs text-slate-500 dark:text-slate-400">{lh.reason}</p></div><span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">{lh.date}</span></div></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-6"><p className="text-xs text-slate-400 dark:text-slate-500">No level history yet.</p></div>}
                {s.levelHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Next Targets</h4>
                    <div className="flex items-center gap-1 text-[10px] font-mono flex-wrap">
                      {Array.from({ length: Math.min(5, s.targetLevel - s.currentLevel + 1) }, (_, i) => s.currentLevel + i).map((lvl, i) => (
                        <React.Fragment key={lvl}>{i > 0 && <span className="text-slate-300 dark:text-slate-600">→</span>}<span className={`px-2 py-0.5 rounded border ${lvl <= s.currentLevel ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'}`}>L{lvl}</span></React.Fragment>
                      ))}
                      {s.targetLevel > s.currentLevel + 5 && <span className="text-slate-300 dark:text-slate-600">… → L{s.targetLevel}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Skills Grid */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Skill Proficiency</h3>
                {latestSkills.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {latestSkills.map(([topic, mastery]) => {
                      const pct = mastery === 'Strong' ? 90 : mastery === 'Satisfactory' ? 60 : 30;
                      const history = allSkills.get(topic) || [];
                      const improving = history.length >= 2 && history[0].mastery !== history[history.length - 1].mastery;
                      return (
                        <div key={topic} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{topic}</span>
                            <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${mastery === 'Strong' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : mastery === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                              {mastery}
                              {improving && <span className="text-emerald-500">↑</span>}
                            </span>
                          </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${mastery === 'Strong' ? 'bg-emerald-500' : mastery === 'Satisfactory' ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          {history.length >= 2 && (
                            <div className="flex gap-1 mt-1.5">
                              {history.map((h, hi) => (
                                <span key={hi} className={`text-[7px] font-mono px-1 py-0.5 rounded ${h.mastery === 'Strong' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : h.mastery === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'}`}>
                                  {h.mastery === 'Strong' ? 'S' : h.mastery === 'Satisfactory' ? 'Sat' : 'NP'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="text-center py-6"><p className="text-xs text-slate-400 dark:text-slate-500">No skill data yet.</p></div>}
              </div>

  if (panel === 'adaptive_test') return <AdaptiveTestPanel />;

  if (panel === 'test_history') return <TestHistoryPanel currentUser={currentUser} token={token} />;

  if (panel === 'worksheets') return <WorksheetsPanel reportsList={reportsList} worksheetsList={worksheetsList} students={students} currentUser={currentUser} token={token} refreshStudents={refreshStudents} />;

  if (panel === 'performance') return <PerformancePanel students={students} currentUser={currentUser} />;

        {/* ===== ACTIVITY TAB ===== */}
        {profileTab === 'activity' && (
          <div className="max-w-2xl">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recent Activity</h3>
                <div className="flex gap-1">
                  {(['all', 'assessment', 'level_change'] as const).map(f => (
                    <button key={f} onClick={() => setActivityFilter(f)} className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${activityFilter === f ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                      {f === 'all' ? 'All' : f === 'assessment' ? 'Assessments' : 'Level Changes'}
                    </button>
                  ))}
                </div>
              </div>
              {filteredActivity.length > 0 ? (
                <div className="space-y-0 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {filteredActivity.map((act, i) => (
                    <div key={i} className="flex gap-4 pb-5 relative pl-2">
                      <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow mt-1 shrink-0 z-10 ${act.type === 'assessment' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <div className="flex-1"><div className="flex justify-between"><div><span className="font-semibold text-sm text-slate-900 dark:text-white">{act.label}</span><p className="text-xs text-slate-500 dark:text-slate-400">{act.detail}</p></div><span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">{new Date(act.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8"><p className="text-xs text-slate-400 dark:text-slate-500">{activityFilter === 'all' ? 'No activity recorded yet.' : `No ${activityFilter === 'assessment' ? 'assessment' : 'level change'} activity found.`}</p></div>}
            </div>
          </div>
        )}

        {/* ===== CERTIFICATE TAB (teacher only) ===== */}
        {canIssueCertificates && profileTab === 'certificate' && (
          <div className="max-w-4xl">
            <div ref={certificatePreviewRef} data-certificate-preview className={`aspect-[297/210] overflow-hidden rounded-2xl border-4 shadow-lg ${isClassOne ? 'border-orange-400 bg-white' : isClassTwo ? 'border-[#0D99FF] bg-[#CFE9FB] p-2' : 'border-amber-300 bg-[#fffdf8]'}`}>
              <div className={isClassTwo ? '' : `h-3 ${isClassOne ? 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-300' : 'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300'}`} />
              <div className={`relative px-6 py-10 text-center sm:px-12 ${isClassTwo ? 'h-full rounded-xl border-2 border-[#0D99FF]' : ''}`}>
                {isClassOne ? <>
                  <div className="absolute left-4 top-3 text-6xl text-amber-400">☀</div><div className="absolute left-4 top-20 -rotate-12 text-[10px] font-black text-cyan-500">FANTASTIC!</div>
                  <div className="absolute right-5 top-7 rotate-12 rounded-t-full border-8 border-b-0 border-orange-500 bg-cyan-400 px-3 py-2 text-sm font-black text-white">Brilliant!</div>
                  <div className="absolute bottom-5 left-7 text-3xl text-amber-400">★ ✦</div><div className="absolute bottom-4 right-8 text-4xl">🏆</div>
                </> : isClassTwo ? <>
                  <div className="certificate-star absolute left-3 top-2 text-3xl">★</div>
                  <div className="certificate-star absolute left-9 top-9 text-base">★</div>
                  <div className="certificate-star absolute left-14 top-6 text-xs">★</div>
                  <div className="certificate-star absolute right-4 top-2 text-3xl">★</div>
                  <div className="certificate-star absolute bottom-3 left-6 text-base">★</div>
                </> : <>
                  <div className="absolute left-5 top-5 text-4xl text-amber-400">★</div><div className="absolute right-6 top-7 text-4xl text-teal-500">✦</div>
                  <div className="absolute bottom-5 left-8 text-3xl text-orange-400">✶</div><div className="absolute bottom-5 right-8 text-3xl text-rose-500">✹</div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-orange-500 bg-amber-300 text-3xl text-white shadow-[0_0_0_5px_#fffdf8,0_0_0_8px_#14b8a6]">★</div>
                </>}
                <p className={`mt-5 text-[10px] font-bold uppercase tracking-[0.25em] ${isClassTwo ? 'text-[#0D99FF]' : 'text-teal-700'}`}>FLN Portal · Foundational Literacy &amp; Numeracy</p>
                <h3 className={`mt-3 text-3xl font-bold sm:text-4xl ${isClassTwo ? 'font-script font-normal text-[#0D99FF] normal-case' : `text-slate-900 ${isClassOne ? 'font-sans' : 'font-serif'}`}`}>Certificate of</h3>
                <p className={`mt-1 text-3xl sm:text-5xl ${isClassTwo ? 'font-hand font-bold normal-case tracking-normal text-[#0D99FF] text-4xl sm:text-6xl' : `font-black uppercase tracking-wider text-orange-500 ${isClassOne ? 'font-sans' : ''}`}`}>Excellence</p>
                <p className={`mt-7 text-base ${isClassTwo ? 'text-[#0D99FF]' : 'text-slate-600'}`}>This certificate is proudly presented to</p>
                <p className={`mx-auto mt-3 max-w-xl border-b-2 px-4 pb-2 text-2xl font-bold sm:text-4xl ${isClassTwo ? 'border-[#0D99FF] text-[#1E1E1E]' : 'border-slate-700 text-blue-700'}`}>{s.name}</p>
                <p className={`mx-auto mt-6 max-w-2xl text-sm leading-6 ${isClassTwo ? 'text-[#0D99FF]' : 'text-slate-600'}`}>for dedication and progress in foundational literacy and numeracy.</p>
                <div className="mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    ['Class', `${s.classGroup} - ${s.section}`],
                    ['Current Level', `L${s.currentLevel}.${s.currentSubLevel ?? 0}`],
                    ['Learning Streak', `${s.streak} days`],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-xl border px-3 py-3 text-xs font-bold ${isClassTwo ? 'border-[#0D99FF] bg-white text-[#0D99FF]' : 'border-cyan-200 bg-cyan-50 text-cyan-900'}`}>
                      {label}<span className={`mt-1 block text-lg ${isClassTwo ? 'text-[#0D99FF]' : 'text-teal-700'}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className={`mx-auto mt-10 grid max-w-xl grid-cols-2 gap-10 text-xs ${isClassTwo ? 'text-[#0D99FF]' : 'text-slate-600'}`}>
                  <div className={`border-t pt-2 ${isClassTwo ? 'border-[#0D99FF]' : 'border-slate-600'}`}><strong className={`block ${isClassTwo ? 'text-[#1E1E1E]' : 'text-slate-800'}`}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>Date issued</div>
                  <div className={`border-t pt-2 ${isClassTwo ? 'border-[#0D99FF]' : 'border-slate-600'}`}><strong className={`block ${isClassTwo ? 'text-[#1E1E1E]' : 'text-slate-800'}`}>{currentUser.name}</strong>Teacher signature</div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => void handlePrintCertificate()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                <Printer className="h-4 w-4" /> Print Certificate
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (panel === 'diagnostic_test') {
    const pending = students.filter(s => s.levelHistory.length === 0);
    const completed = students.filter(s => s.levelHistory.length > 0);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Pending Diagnostics" desc={`${pending.length} students need initial assessment`} icon={<ShieldAlert className="h-5 w-5 text-amber-500" />} />
          {pending.length === 0 ? <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">All students placed.</p> : (
            <div className="space-y-3">{pending.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400 dark:text-slate-500">{s.classGroup} - {s.section}</div></div>
                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">Run Diagnostic</span>
              </div>
            ))}</div>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Completed Diagnostics" desc={`${completed.length} students have been placed`} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
          <div className="space-y-3">{completed.map(s => (
            <div key={s.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-slate-400 dark:text-slate-500">Placed at L{s.currentLevel}.{s.currentSubLevel ?? 0}</div></div>
              <span className="text-[10px] font-mono font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded border border-green-200 dark:border-green-800">Completed</span>
            </div>
          ))}</div>
        </div>
      </div>
    );
  }

  if (panel === 'adaptive_test') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
        <PageHeader title="Adaptive Assessment" desc="Computer-adaptive testing that adjusts to student ability" icon={<SlidersHorizontal className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Active Sessions" value="3" subtext="Students currently testing" icon={Users} />
          <MetricCard title="Avg Adaptive Score" value="72%" subtext="Across all levels" icon={BarChart3} />
          <MetricCard title="Completion Rate" value="85%" subtext="Tests finished on time" icon={CheckCircle2} />
        </div>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 bg-slate-50 dark:bg-slate-800 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">How Adaptive Testing Works</h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">The system selects questions dynamically based on the student's previous answers. Correct answers lead to harder questions; incorrect answers adjust to easier ones. This pinpoints the exact FLN level.</p>
          <div className="flex gap-4 pt-2">
            <button className="bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">Start New Adaptive Test</button>
            <button className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">View Session Logs</button>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'test_history') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Test History" desc="Complete record of all diagnostic and worksheet evaluations" icon={<FileText className="h-5 w-5" />} />
        <div className="space-y-3">{DIAGNOSTIC_HISTORY.map(h => (
          <div key={h.id} className="flex justify-between items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
            <div><div className="font-semibold text-sm">{h.student}</div><div className="text-xs text-slate-400 dark:text-slate-500">{h.date} · Evaluated by {h.evaluator}</div></div>
            <div className="text-right"><div className="font-mono font-bold">{h.score}/{h.total}</div><div className="text-xs text-slate-400 dark:text-slate-500">Placed L{h.placedLevel}</div></div>
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title="Worksheet Cycles" desc="Baseline, Mid-year, and End-of-year assessments" />
          <div className="space-y-3 mt-4">{WORKSHEETS_MOCK.map(w => (
            <div key={w.id} className="flex justify-between items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div><div className="font-semibold text-sm">{w.cycle} — {w.class}</div><div className="text-xs text-slate-400 dark:text-slate-500">{w.date} · {w.questions} questions</div></div>
              <div className="text-right"><span className={`text-xs font-mono font-bold px-2 py-1 rounded ${w.status === 'Evaluated' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'}`}>{w.status}</span><div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Avg: {w.avgScore}</div></div>
            </div>
          ))}</div>
        </div>
      </div>
    );
  }

  if (panel === 'performance') {
    const canIssueRankCertificates = canIssueCertificates;
    const topStudents = [...students]
      .sort((a, b) => b.currentLevel - a.currentLevel || b.streak - a.streak || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((student, index) => ({ student, rank: index + 1 }));
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Students" value={students.length} subtext="Active roster" icon={Users} />
          <MetricCard title="Avg Level" value={`L${Math.round(students.reduce((a, s) => a + s.currentLevel, 0) / students.length)}`} subtext="Class average" icon={BarChart3} />
          <MetricCard title="Certified" value={`${students.filter(s => s.currentLevel >= 5).length}`} subtext="Level 5+ achieved" icon={Award} />
          <MetricCard title="Pending Diagnostic" value={students.filter(s => s.levelHistory.length === 0).length} subtext="Need placement" icon={ShieldAlert} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <PageHeader title={canIssueRankCertificates ? "Class Performance" : "School Performance"} desc="FLN level distribution and trends" />
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Top Performing Students</h4>
            <div className="space-y-2">{topStudents.map(({ student: s, rank }) => (
              <div key={s.id} className="flex flex-wrap justify-between items-center gap-3 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-700">{rank}</span><span className="text-sm font-semibold">{s.name}</span><span className="text-xs text-slate-400 dark:text-slate-500">{s.classGroup}</span></div>
                <div className="flex items-center gap-3"><div className="w-24 sm:w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.currentLevel / 59) * 100}%` }} /></div><span className="font-mono font-bold text-sm">L{s.currentLevel}</span>{canIssueRankCertificates && <button onClick={() => setRankCertificate({ student: s, rank })} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"><Award className="h-3.5 w-3.5" /> Certificate</button>}</div>
            <div className="space-y-2">{topStudents.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-3"><span className="text-sm font-semibold">{s.name}</span><span className="text-xs text-slate-400 dark:text-slate-500">{s.classGroup}</span></div>
                <div className="flex items-center gap-4"><div className="w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.currentLevel / 93) * 100}%` }} /></div><span className="font-mono font-bold text-sm">L{s.currentLevel}</span></div>
              </div>
            ))}</div>
          </div>
        </div>
        {canIssueRankCertificates && rankCertificate && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-4 sm:p-8">
            <div className="w-full max-w-6xl">
              <div className="mb-3 flex items-center justify-between gap-3 text-white">
                <div><p className="text-sm font-bold">Top 5 Rank Certificate</p><p className="text-xs text-slate-300">{rankCertificate.student.name} · {ordinal(rankCertificate.rank)} rank</p></div>
                <div className="flex gap-2"><button onClick={() => void printRankCertificate()} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"><Printer className="h-4 w-4" /> Print Certificate</button><button onClick={() => setRankCertificate(null)} className="rounded-lg border border-white/35 px-3 py-2 text-sm font-semibold hover:bg-white/10">Close</button></div>
              </div>
              <RankCertificate ranked={rankCertificate} teacherName={currentUser.name} allStudents={students} certificateRef={rankCertificatePreviewRef} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (panel === 'reports') {
    const isStateAdmin = currentUser.role === UserRole.ADMIN;
    if (isStateAdmin) {
      const userState = currentUser.stateCode || 'PB';
      const stateSchools = schools.filter(s => s.stateCode === userState);
      const stateDistricts = Array.from(new Set(stateSchools.map(s => s.districtCode))) as string[];
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Total Reports" value={reportsList.length} subtext="All evaluations" icon={FileText} />
            <MetricCard title="Avg Score" value={reportsList.length > 0 ? `${Math.round(reportsList.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / reportsList.length)}%` : '—'} subtext="Across reports" icon={BarChart3} />
            <MetricCard title="Schools" value={stateSchools.length} subtext={`In ${userState}`} icon={SchoolIcon} />
            <MetricCard title="Districts" value={stateDistricts.length} subtext="Active jurisdictions" icon={MapPin} />
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
            <PageHeader title={`District-Wise School Reports — ${userState}`} desc="Evaluation reports organized by district and school" />
            <div className="space-y-3 mt-4">{stateDistricts.map(dc => {
              const isExpanded = expandedDistRpt === dc;
              const distSchools = stateSchools.filter(s => s.districtCode === dc);
              return (
                <div key={dc}>
                  <button onClick={() => setExpandedDistRpt(isExpanded ? null : dc)} className={`w-full flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-all ${isExpanded ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-100 dark:border-slate-700'}`}>
                    <span className="font-bold text-sm w-16">{dc}</span>
                    <span className="text-sm flex-1">{DISTRICT_NAMES[dc] || dc}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{distSchools.length} schools</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-2 space-y-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
                      {distSchools.map(sch => {
                        const schStudents = students.filter(st => st.schoolId === sch.id);
                        const schReports = reportsList.filter(r => schStudents.some(st => st.id === r.studentId));
                        const avgScore = schReports.length > 0 ? Math.round(schReports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / schReports.length) : 0;
                        return (
                          <div key={sch.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-900 dark:text-white text-sm">{sch.name}</h4><span className="text-xs text-slate-400 dark:text-slate-500">{sch.blockCode} · {sch.strength}</span></div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2"><div className="text-lg font-bold text-slate-900 dark:text-white">{schReports.length}</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Reports</div></div>
                              <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2"><div className={`text-lg font-bold ${avgScore >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{avgScore}%</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Avg Score</div></div>
                              <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2"><div className="text-lg font-bold text-slate-900 dark:text-white">{schStudents.length}</div><div className="text-[10px] text-slate-400 dark:text-slate-500">Students</div></div>
                            </div>
                            {schReports.length > 0 ? (
                              <div className="space-y-2">{schReports.map(r => {
                                const student = schStudents.find(st => st.id === r.studentId);
                                const scorePct = Math.round((r.score / r.totalQuestions) * 100);
                                return (
                                  <div key={r.id} className="border border-slate-100 dark:border-slate-700 rounded-lg p-3 text-sm">
                                    <div className="flex justify-between items-center"><span className="font-semibold">{student?.name || 'N/A'}</span><span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${scorePct >= 80 ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : scorePct >= 60 ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>{r.score}/{r.totalQuestions} ({scorePct}%)</span></div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.narrative}</p>
                                    <div className="flex gap-1 mt-1.5">{Object.entries(r.conceptMastery).map(([t, m]) => (
                                      <span key={t} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${m === 'Strong' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : m === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'}`}>{t}</span>
                                    ))}</div>
                                  </div>
                                );
                              })}</div>
                            ) : <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">No evaluation reports for this school yet.</p>}
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
          <MetricCard title="Total Reports" value={reportsList.length} subtext="All evaluations" icon={FileText} />
          <MetricCard title="Avg Score" value={reportsList.length > 0 ? `${Math.round(reportsList.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / reportsList.length)}%` : '—'} subtext="Across reports" icon={BarChart3} />
          <MetricCard title="Strong Concepts" value={reportsList.reduce((a, r) => a + Object.values(r.conceptMastery).filter(v => v === 'Strong').length, 0)} subtext="Mastered topics" icon={Award} />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <PageHeader title="Evaluation Reports" desc="Detailed assessment narratives and concept mastery breakdowns" />
          {reportsList.map(r => {
            const student = students.find(s => s.id === r.studentId);
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
              <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                <div className="flex justify-between items-center"><span className="font-semibold text-sm">{student?.name || 'Unknown'}</span><span className="text-xs text-slate-400 dark:text-slate-500">{new Date(r.timestamp).toLocaleDateString()}</span></div>
                <div className="flex gap-4 text-sm"><span>Score: <strong>{r.score}/{r.totalQuestions}</strong></span><span>Level: <strong>L{r.recommendedLevel}.{r.recommendedSubLevel ?? 0}</strong></span></div>
                
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-3">
                  <span className="text-[9px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Evaluation Report Narrative</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">{r.narrative}</p>
                </div>

                <div className="flex flex-wrap gap-2">{Object.entries(r.conceptMastery).map(([t, m]) => (
                  <span key={t} className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${m === 'Strong' ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : m === 'Satisfactory' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>{t}: {m}</span>
                ))}</div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
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
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Assigned from Diagnostic Pipeline</span>
                </div>

                {isExpanded && (
                  <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 text-xs">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">Side-by-Side Exam Grader Report</div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {examResponses.map((item, idx) => (
                        <div key={idx} className="p-3 space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{item.question}</div>
                          <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-dotted border-slate-200 dark:border-slate-700">
                            <div>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-mono block">Student Response</span>
                              <span className={`font-medium ${item.status === 'Correct' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{item.studentAnswer}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-mono block">Correct Keys</span>
                              <span className="font-medium text-slate-800 dark:text-slate-100">{item.correctAnswer}</span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold font-mono rounded ${item.status === 'Correct' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>{item.status === 'Correct' ? 'PASS' : 'FAIL'}</span>
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
  if (panel === 'assigned_schools') return <AssignedSchoolsPanel schools={schools} students={students} />;

  if (panel === 'student_progress') return <StudentProgressPanel students={students} />;

  if (panel === 'attendance') return <AttendancePanel students={students} reportsList={reportsList} />;

  // ===================== PRINCIPAL / SCHOOL ADMIN PANELS =====================
  if (panel === 'teachers' && (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.BLOCK_ADMIN)) return <TeachersPanel schools={schools} teachersList={teachersList} currentUser={currentUser} />;

  // Fix #446: Principal Students navigation (view='students') had no matching
  // panel handler, so PanelViews returned null and rendered nothing.
  // Reuse StudentListPanel — the same component used by teachers for
  // 'student_list'. StudentListPanel already gates the Register/CSV-import
  // actions behind isTeacherOrVolunteer, so the principal gets a read-only
  // roster view without any code duplication.
  if (panel === 'students' && currentUser.role === UserRole.SCHOOL) {
    return (
      <StudentListPanel
        students={students}
        studentsLoading={studentsLoading}
        currentUser={currentUser}
        token={token}
        refreshStudents={refreshStudents}
      />
    );
  }

  // ===================== BLOCK/DISTRICT/STATE ADMIN + SUPERADMIN SHARED PANELS =====================
  if (panel === 'schools') return <SchoolsPanel schools={schools} />;

  if (panel === 'districts') return <DistrictsPanel currentUser={currentUser} schools={schools} students={students} getDistrictStats={getDistrictStats} />;

  if (panel === 'blocks') return <BlocksPanel currentUser={currentUser} getBlockStats={getBlockStats} />;

  // ===================== SUPERADMIN PANELS =====================
  if (panel === 'users') return <UsersPanel usersList={usersList} />;


  if (panel === 'worksheet_templates') return <WorksheetTemplatesPanel />;

  if (panel === 'content') return <ContentPanel />;

  if (panel === 'analytics') return <AnalyticsPanel currentUser={currentUser} schools={schools} students={students} getDistrictStats={getDistrictStats} getBlockStats={getBlockStats} />;

  if (panel === 'system_settings') return <SystemSettingsPanel />;

  // Admin-only Step-Up Aadhaar Reveal (see backend/src/routes/aadhaarDetokenize.ts).
  // The panel itself enforces role gating as a defence-in-depth; the menu
  // also gates visibility to admin roles in Layout.tsx.
  if (panel === 'aadhaar_reveal') {
    return (
      <AadhaarRevealPanel
        students={students}
        currentUser={currentUser}
        token={token}
        onSelectView={onSelectView}
      />
    );
  }

  // Account-level Authenticator enrollment (admin roles only — see
  // Layout.tsx). The SecurityPanel is the ONLY place a QR is rendered;
  // the per-student reveal dialog never renders a QR or calls the
  // enroll endpoint. See CLAUDE.md "Hard invariant" on TOTP factors.
  if (panel === 'security') {
    return <SecurityPanel currentUser={currentUser} token={token} />;
  }

  // Fallback for any unmatched panel — renders the roles workspace (dashboard) as the content
  return null;
};
