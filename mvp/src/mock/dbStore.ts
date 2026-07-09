import { User, UserRole, School, ClassGroup, Student, Question, Worksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Announcement } from '../types';
import { generateQuestionsForLevel } from '../utils/levelGenerator';
import { initialTeacherLogins } from './login/teacher';
import { initialStudentLogins } from './login/student';
import { initialSuperadminLogins } from './login/superadmin';

const MOCK_DB_KEY = 'fln_mock_db_store';

export interface MockDatabaseSchema {
  users: User[];
  schools: School[];
  classes: ClassGroup[];
  students: Student[];
  worksheets: Worksheet[];
  answerSubmissions: AnswerSubmission[];
  evaluationReports: EvaluationReport[];
  tickets: Ticket[];
  logbook: LogEntry[];
  announcements: Announcement[];
}

// Generate realistic question pool
function getSeedQuestions(): Question[] {
  const questions: Question[] = [];
  for (let lvl = 1; lvl <= 59; lvl++) {
    questions.push(...generateQuestionsForLevel(lvl, 0));
  }
  return questions;
}

export function getInitialSeedData(): MockDatabaseSchema {
  const schools: School[] = [
    { id: 'gps-mt-001', name: 'GPS Model Town Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'high', teachersCount: 2 },
    { id: 'gps-vl-002', name: 'GPS Rural Village Moga', stateCode: 'PB', districtCode: 'MOG', blockCode: 'MOG-02', strength: 'low', teachersCount: 0 },
    { id: 'gps-amb-003', name: 'GPS Cantt Ambala', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01', strength: 'high', teachersCount: 1 },
    { id: 'gps-jai-004', name: 'GPS Govind Dev Jaipur', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-01', strength: 'low', teachersCount: 1 },
    { id: 'gps-lko-005', name: 'GPS Hazratganj Lucknow', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01', strength: 'high', teachersCount: 1 },
    { id: 'gps-bth-006', name: 'GPS Bathinda City', stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01', strength: 'high', teachersCount: 2 },
    { id: 'gps-asr-007', name: 'GPS Amritsar Golden', stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01', strength: 'low', teachersCount: 1 },
    { id: 'gps-pkl-008', name: 'GPS Panchkula Sector', stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01', strength: 'high', teachersCount: 2 },
    { id: 'gps-jai2-009', name: 'GPS Jaipur Rural North', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02', strength: 'low', teachersCount: 1 },
    { id: 'gps-uda-010', name: 'GPS Udaipur City', stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01', strength: 'high', teachersCount: 2 },
    { id: 'gps-lko2-011', name: 'GPS Lucknow Aliganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02', strength: 'high', teachersCount: 1 },
    { id: 'gps-knp-012', name: 'GPS Kanpur Cantt', stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01', strength: 'low', teachersCount: 1 },
    { id: 'gps-pb-ldh2-013', name: 'GPS Gill Village Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02', strength: 'low', teachersCount: 1 },
    { id: 'gps-hr-amb2-014', name: 'GPS Ambala City South', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02', strength: 'high', teachersCount: 2 }
  ];

  const users: User[] = [
    ...initialSuperadminLogins,
    ...initialTeacherLogins
  ];

  const classes: ClassGroup[] = [
    { id: 'c1', schoolId: 'gps-mt-001', className: 'Class 2', section: 'A', teacherId: 'u6' }
  ];

  const students: Student[] = [
    ...initialStudentLogins
  ];

  const seedQuestions = getSeedQuestions();

  const worksheets: Worksheet[] = [
    {
      id: 'WS_1001',
      classId: 'c1',
      className: 'Class 2',
      section: 'A',
      schoolId: 'gps-mt-001',
      generatedByRole: UserRole.TEACHER,
      generatedByEmail: 'gps-mt-001.t01@fln.org',
      cycle: 'Baseline',
      date: '2026-06-15',
      questions: [
        { ...seedQuestions[0], question_id: 's1_L1_Q1', question: '[For Amanpreet Singh - Level 2] Count the apples...' },
        { ...seedQuestions[2], question_id: 's1_L2_Q1', question: '[For Amanpreet Singh - Level 2] Calculate: 3 + 4...' },
        { ...seedQuestions[1], question_id: 's2_L1_Q2', question: '[For Simran Kaur - Level 3] Count the circles...' },
        { ...seedQuestions[4], question_id: 's2_L3_Q1', question: '[For Simran Kaur - Level 3] If a pencil is 8 centimeters...' }
      ],
      locks: {
        locked: true,
        lockedByRole: UserRole.TEACHER,
        lockedByEmail: 'gps-mt-001.t01@fln.org',
        timestamp: '2026-06-15T09:00:00Z'
      },
      timing: {
        examDate: '2026-06-15',
        printWindowStart: '2026-06-15T09:00:00Z',
        printWindowEnd: '2026-06-15T10:00:00Z',
        examWindowStart: '2026-06-15T10:00:00Z',
        examWindowEnd: '2026-06-15T10:45:00Z',
        submissionWindowEnd: '2026-06-15T11:45:00Z'
      },
      delayLogs: {
        delayedAttemptsCount: 0,
        submittingTeachers: []
      }
    },
    {
      id: 'WS_1002',
      classId: 'c2',
      className: 'Class 3',
      section: 'A',
      schoolId: 'gps-mt-001',
      generatedByRole: UserRole.TEACHER,
      generatedByEmail: 'gps-mt-001.t01@fln.org',
      cycle: 'Mid-year',
      date: '2026-07-02',
      questions: [
        { ...seedQuestions[4], question_id: 's3_L3_Q1', question: '[For Gurpreet Singh - Level 4] Pencil centimeter subtraction...' },
        { ...seedQuestions[5], question_id: 's20_L4_Q1', question: '[For Pooja Verma - Level 10] Fraction pizza...' }
      ],
      locks: {
        locked: true,
        lockedByRole: UserRole.TEACHER,
        lockedByEmail: 'gps-mt-001.t01@fln.org',
        timestamp: '2026-07-02T09:00:00Z'
      },
      timing: {
        examDate: '2026-07-02',
        printWindowStart: '2026-07-02T09:00:00Z',
        printWindowEnd: '2026-07-02T10:00:00Z',
        examWindowStart: '2026-07-02T10:00:00Z',
        examWindowEnd: '2026-07-02T10:45:00Z',
        submissionWindowEnd: '2026-07-02T11:45:00Z'
      },
      delayLogs: {
        delayedAttemptsCount: 1,
        submittingTeachers: ['gps-mt-001.t01@fln.org']
      }
    },
    {
      id: 'WS_1003',
      classId: 'c7',
      className: 'Class 3',
      section: 'A',
      schoolId: 'gps-bth-006',
      generatedByRole: UserRole.TEACHER,
      generatedByEmail: 'gps-bth-006.t01@fln.org',
      cycle: 'Baseline',
      date: '2026-07-01',
      questions: [
        { ...seedQuestions[0], question_id: 's18_L1_Q1', question: '[For Kavya Reddy - Level 8] Counting objects...' },
        { ...seedQuestions[4], question_id: 's40_L3_Q1', question: '[For Simranjit Kaur - Level 2] Pencil subtraction...' },
        { ...seedQuestions[6], question_id: 's28_L4_Q1', question: '[For Myra Choudhary - Level 6] Money change...' }
      ],
      locks: {
        locked: true,
        lockedByRole: UserRole.TEACHER,
        lockedByEmail: 'gps-bth-006.t01@fln.org',
        timestamp: '2026-07-01T09:00:00Z'
      },
      timing: {
        examDate: '2026-07-01',
        printWindowStart: '2026-07-01T09:00:00Z',
        printWindowEnd: '2026-07-01T10:00:00Z',
        examWindowStart: '2026-07-01T10:00:00Z',
        examWindowEnd: '2026-07-01T10:45:00Z',
        submissionWindowEnd: '2026-07-01T11:45:00Z'
      },
      delayLogs: {
        delayedAttemptsCount: 0,
        submittingTeachers: []
      }
    },
    {
      id: 'WS_1004',
      classId: 'c10',
      className: 'Class 3',
      section: 'A',
      schoolId: 'gps-pkl-008',
      generatedByRole: UserRole.TEACHER,
      generatedByEmail: 'gps-pkl-008.t01@fln.org',
      cycle: 'Baseline',
      date: '2026-07-03',
      questions: [
        { ...seedQuestions[3], question_id: 's22_L2_Q2', question: '[For Anika Gupta - Level 12] Pattern completion...' },
        { ...seedQuestions[7], question_id: 's30_L5_Q1', question: '[For Aadhya Iyer - Level 7] Multiplication...' }
      ],
      locks: {
        locked: true,
        lockedByRole: UserRole.TEACHER,
        lockedByEmail: 'gps-pkl-008.t01@fln.org',
        timestamp: '2026-07-03T09:00:00Z'
      },
      timing: {
        examDate: '2026-07-03',
        printWindowStart: '2026-07-03T09:00:00Z',
        printWindowEnd: '2026-07-03T10:00:00Z',
        examWindowStart: '2026-07-03T10:00:00Z',
        examWindowEnd: '2026-07-03T10:45:00Z',
        submissionWindowEnd: '2026-07-03T11:45:00Z'
      },
      delayLogs: {
        delayedAttemptsCount: 0,
        submittingTeachers: []
      }
    },
    {
      id: 'WS_1005',
      classId: 'c6',
      className: 'Class 3',
      section: 'A',
      schoolId: 'gps-lko-005',
      generatedByRole: UserRole.TEACHER,
      generatedByEmail: 'gps-lko-005.t01@fln.org',
      cycle: 'Mid-year',
      date: '2026-07-04',
      questions: [
        { ...seedQuestions[5], question_id: 's21_L4_Q1', question: '[For Vivek Saxena - Level 10] Fraction pizza...' },
        { ...seedQuestions[6], question_id: 's32_L4_Q2', question: '[For Anvi Kaur - Level 9] Money change...' }
      ],
      locks: {
        locked: true,
        lockedByRole: UserRole.TEACHER,
        lockedByEmail: 'gps-lko-005.t01@fln.org',
        timestamp: '2026-07-04T09:00:00Z'
      },
      timing: {
        examDate: '2026-07-04',
        printWindowStart: '2026-07-04T09:00:00Z',
        printWindowEnd: '2026-07-04T10:00:00Z',
        examWindowStart: '2026-07-04T10:00:00Z',
        examWindowEnd: '2026-07-04T10:45:00Z',
        submissionWindowEnd: '2026-07-04T11:45:00Z'
      },
      delayLogs: {
        delayedAttemptsCount: 0,
        submittingTeachers: []
      }
    }
  ];

  const answerSubmissions: AnswerSubmission[] = [
    {
      id: 'sub_s1_1001',
      worksheetId: 'WS_1001',
      studentId: 's1',
      studentName: 'Amanpreet Singh',
      schoolId: 'gps-mt-001',
      classId: 'c1',
      submittedAt: '2026-06-15T11:10:00Z',
      isDelayed: false,
      answers: { 's1_L1_Q1': '5', 's1_L2_Q1': '7' }
    },
    {
      id: 'sub_s3_1002',
      worksheetId: 'WS_1002',
      studentId: 's3',
      studentName: 'Gurpreet Singh',
      schoolId: 'gps-mt-001',
      classId: 'c2',
      submittedAt: '2026-07-02T11:30:00Z',
      isDelayed: true,
      answers: { 's3_L3_Q1': '5', 's20_L4_Q1': '3/4' }
    },
    {
      id: 'sub_s18_1003',
      worksheetId: 'WS_1003',
      studentId: 's18',
      studentName: 'Kavya Reddy',
      schoolId: 'gps-bth-006',
      classId: 'c7',
      submittedAt: '2026-07-01T11:05:00Z',
      isDelayed: false,
      answers: { 's18_L1_Q1': '5', 's40_L3_Q1': '5', 's28_L4_Q1': '35' }
    },
    {
      id: 'sub_s22_1004',
      worksheetId: 'WS_1004',
      studentId: 's22',
      studentName: 'Anika Gupta',
      schoolId: 'gps-pkl-008',
      classId: 'c10',
      submittedAt: '2026-07-03T11:20:00Z',
      isDelayed: false,
      answers: { 's22_L2_Q2': 'Blue Circle', 's30_L5_Q1': '60' }
    },
    {
      id: 'sub_s21_1005',
      worksheetId: 'WS_1005',
      studentId: 's21',
      studentName: 'Vivek Saxena',
      schoolId: 'gps-lko-005',
      classId: 'c6',
      submittedAt: '2026-07-04T11:15:00Z',
      isDelayed: false,
      answers: { 's21_L4_Q1': '3/4', 's32_L4_Q2': '35' }
    },
    {
      id: 'sub_s4_1001',
      worksheetId: 'WS_1001',
      studentId: 's4',
      studentName: 'Manpreet Lal',
      schoolId: 'gps-vl-002',
      classId: 'c1',
      submittedAt: '2026-06-15T11:25:00Z',
      isDelayed: false,
      answers: { 's1_L1_Q1': '5', 's1_L2_Q1': '7' }
    },
    {
      id: 'sub_s20_1002',
      worksheetId: 'WS_1002',
      studentId: 's20',
      studentName: 'Pooja Verma',
      schoolId: 'gps-mt-001',
      classId: 'c2',
      submittedAt: '2026-07-02T11:45:00Z',
      isDelayed: true,
      answers: { 's3_L3_Q1': '5', 's20_L4_Q1': '3/4' }
    },
    {
      id: 'sub_s40_1003',
      worksheetId: 'WS_1003',
      studentId: 's40',
      studentName: 'Simranjit Kaur',
      schoolId: 'gps-bth-006',
      classId: 'c7',
      submittedAt: '2026-07-01T11:10:00Z',
      isDelayed: false,
      answers: { 's18_L1_Q1': '5', 's40_L3_Q1': '2', 's28_L4_Q1': '35' }
    }
  ];

  const evaluationReports: EvaluationReport[] = [
    {
      id: 'rep_s1_1001',
      studentId: 's1',
      worksheetId: 'WS_1001',
      score: 100,
      totalQuestions: 2,
      conceptMastery: { 'Number Sense': 'Strong', 'Number Operations': 'Strong' },
      narrative: 'Amanpreet demonstrated absolute competence in counting objects and doing simple addition arithmetic.',
      recommendedLevel: 2,
      timestamp: '2026-06-15T11:15:00Z'
    },
    {
      id: 'rep_s3_1002',
      studentId: 's3',
      worksheetId: 'WS_1002',
      score: 100,
      totalQuestions: 2,
      conceptMastery: { 'Number Operations': 'Strong', 'Fractions': 'Strong' },
      narrative: 'Gurpreet scored full marks in measurement and fractions. Ready to advance to next level.',
      recommendedLevel: 5,
      timestamp: '2026-07-02T11:35:00Z'
    },
    {
      id: 'rep_s18_1003',
      studentId: 's18',
      worksheetId: 'WS_1003',
      score: 67,
      totalQuestions: 3,
      conceptMastery: { 'Number Sense': 'Strong', 'Measurement': 'Strong', 'Money': 'Needs Practice' },
      narrative: 'Kavya shows strength in counting and measurement but needs more practice with money transactions.',
      recommendedLevel: 8,
      timestamp: '2026-07-01T11:15:00Z'
    },
    {
      id: 'rep_s22_1004',
      studentId: 's22',
      worksheetId: 'WS_1004',
      score: 100,
      totalQuestions: 2,
      conceptMastery: { 'Patterns': 'Strong', 'Number Operations': 'Strong' },
      narrative: 'Anika demonstrated flawless pattern recognition and multiplication skills.',
      recommendedLevel: 12,
      timestamp: '2026-07-03T11:25:00Z'
    },
    {
      id: 'rep_s21_1005',
      studentId: 's21',
      worksheetId: 'WS_1005',
      score: 100,
      totalQuestions: 2,
      conceptMastery: { 'Fractions': 'Strong', 'Money': 'Strong' },
      narrative: 'Vivek displays strong conceptual understanding of fractions and monetary calculations.',
      recommendedLevel: 10,
      timestamp: '2026-07-04T11:20:00Z'
    },
    {
      id: 'rep_s24_diag',
      studentId: 's24',
      worksheetId: 'diagnostic',
      score: 5,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Shapes': 'Strong', 'Fractions': 'Strong' },
      narrative: 'Tanvi performed very well on the diagnostic, demonstrating strong number sense.',
      recommendedLevel: 15,
      recommendedSubLevel: 0,
      timestamp: '2026-07-01T10:00:00Z'
    },
    // ── Additional diagnostic evaluation reports for students with diagnostics ──
    {
      id: 'rep_s2_diag',
      studentId: 's2',
      worksheetId: 'diagnostic',
      score: 4,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Shapes': 'Satisfactory', 'Fractions': 'Needs Practice' },
      narrative: 'Simran shows good counting ability but needs practice with shape identification and basic fractions.',
      recommendedLevel: 3,
      recommendedSubLevel: 0,
      timestamp: '2026-04-10T11:00:00Z'
    },
    {
      id: 'rep_s5_diag',
      studentId: 's5',
      worksheetId: 'diagnostic',
      score: 3,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Satisfactory', 'Shapes': 'Needs Practice', 'Fractions': 'Needs Practice' },
      narrative: 'Harjeet can count up to 20 but struggles with shape sorting. Needs remedial support.',
      recommendedLevel: 2,
      recommendedSubLevel: 0,
      timestamp: '2026-05-20T09:30:00Z'
    },
    {
      id: 'rep_s6_diag',
      studentId: 's6',
      worksheetId: 'diagnostic',
      score: 5,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Shapes': 'Strong', 'Fractions': 'Satisfactory' },
      narrative: 'Sandeep demonstrates solid foundational math skills across most concepts.',
      recommendedLevel: 3,
      recommendedSubLevel: 0,
      timestamp: '2026-06-01T10:00:00Z'
    },
    {
      id: 'rep_s7_diag',
      studentId: 's7',
      worksheetId: 'diagnostic',
      score: 6,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Strong', 'Shapes': 'Strong' },
      narrative: 'Sneha scored perfectly on the diagnostic. Ready for advanced Level 5+ material.',
      recommendedLevel: 5,
      recommendedSubLevel: 0,
      timestamp: '2026-06-01T10:30:00Z'
    },
    {
      id: 'rep_s9_diag',
      studentId: 's9',
      worksheetId: 'diagnostic',
      score: 4,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Strong', 'Subtraction': 'Satisfactory' },
      narrative: 'Priya understands number operations well and is ready for Level 4 content.',
      recommendedLevel: 4,
      recommendedSubLevel: 0,
      timestamp: '2026-06-15T09:00:00Z'
    },
    {
      id: 'rep_s10_diag',
      studentId: 's10',
      worksheetId: 'diagnostic',
      score: 5,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Strong', 'Subtraction': 'Strong' },
      narrative: 'Amit demonstrated exceptional diagnostic performance. Placed at Level 5.',
      recommendedLevel: 5,
      recommendedSubLevel: 0,
      timestamp: '2026-06-15T09:30:00Z'
    },
    {
      id: 'rep_s14_diag',
      studentId: 's14',
      worksheetId: 'diagnostic',
      score: 4,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Satisfactory', 'Subtraction': 'Needs Practice' },
      narrative: 'Rajiv shows understanding of basic counting but needs additional subtraction practice.',
      recommendedLevel: 3,
      recommendedSubLevel: 0,
      timestamp: '2026-06-20T10:00:00Z'
    },
    {
      id: 'rep_s15_diag',
      studentId: 's15',
      worksheetId: 'diagnostic',
      score: 5,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Strong', 'Shapes': 'Strong' },
      narrative: 'Neha performed excellently. Demonstrates strong foundational math skills.',
      recommendedLevel: 4,
      recommendedSubLevel: 0,
      timestamp: '2026-06-20T10:30:00Z'
    },
    {
      id: 'rep_s16_diag',
      studentId: 's16',
      worksheetId: 'diagnostic',
      score: 6,
      totalQuestions: 6,
      conceptMastery: { 'Number Sense': 'Strong', 'Addition': 'Strong', 'Subtraction': 'Strong', 'Shapes': 'Strong' },
      narrative: 'Karan achieved a perfect diagnostic score. Ready for Level 5 enrichment.',
      recommendedLevel: 5,
      recommendedSubLevel: 0,
      timestamp: '2026-06-20T11:00:00Z'
    },
    // ── Additional worksheet evaluation reports ──
    {
      id: 'rep_s4_ws1001',
      studentId: 's4',
      worksheetId: 'WS_1001',
      score: 2,
      totalQuestions: 2,
      conceptMastery: { 'Number Sense': 'Strong', 'Number Operations': 'Satisfactory' },
      narrative: 'Manpreel correctly answered counting and basic addition questions.',
      recommendedLevel: 1,
      timestamp: '2026-06-15T11:20:00Z'
    },
    {
      id: 'rep_s20_ws1002',
      studentId: 's20',
      worksheetId: 'WS_1002',
      score: 1,
      totalQuestions: 1,
      conceptMastery: { 'Fractions': 'Satisfactory' },
      narrative: 'Pooja correctly identified the fraction representation.',
      recommendedLevel: 10,
      timestamp: '2026-07-02T11:40:00Z'
    },
    {
      id: 'rep_s40_ws1003',
      studentId: 's40',
      worksheetId: 'WS_1003',
      score: 1,
      totalQuestions: 2,
      conceptMastery: { 'Number Sense': 'Strong', 'Measurement': 'Needs Practice' },
      narrative: 'Simranjit showed counting ability but needs more practice with measurement concepts.',
      recommendedLevel: 2,
      recommendedSubLevel: 2,
      timestamp: '2026-07-01T11:20:00Z'
    }
  ];

  const logbook: LogEntry[] = [
    {
      id: 'log1',
      timestamp: '2026-07-05T10:30:00Z',
      schoolId: 'gps-mt-001',
      schoolName: 'GPS Model Town Ludhiana',
      userId: 'u6',
      userEmail: 'gps-mt-001.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'print',
      status: 'Success',
      details: 'Downloaded printed worksheets for Amanpreet Singh and Simran Kaur'
    },
    {
      id: 'log2',
      timestamp: '2026-07-04T14:15:00Z',
      schoolId: 'gps-vl-002',
      schoolName: 'GPS Rural Village Moga',
      userId: 'u7',
      userEmail: 'vol.rahul@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'Uploaded evaluation scan sheet for Manpreet Lal (Class 2)'
    },
    {
      id: 'log3',
      timestamp: '2026-07-03T11:00:00Z',
      schoolId: 'gps-amb-003',
      schoolName: 'GPS Cantt Ambala',
      userId: 'u6_amb',
      userEmail: 'gps-amb-003.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'verify',
      status: 'Success',
      details: 'Onboarded and validated Aadhar details for student Sneha Sharma'
    },
    {
      id: 'log4',
      timestamp: '2026-07-04T09:45:00Z',
      schoolId: 'gps-bth-006',
      schoolName: 'GPS Bathinda City',
      userId: 'u6_bth_a',
      userEmail: 'gps-bth-006.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'conduct',
      status: 'Success',
      details: 'Conducted baseline diagnostic for Class 3 students in Bathinda'
    },
    {
      id: 'log5',
      timestamp: '2026-07-05T15:20:00Z',
      schoolId: 'gps-pkl-008',
      schoolName: 'GPS Panchkula Sector',
      userId: 'u6_pkl_a',
      userEmail: 'gps-pkl-008.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'Scored and evaluated worksheets for Class 3 students (Anika Gupta, Aadhya Iyer)'
    },
    {
      id: 'log6',
      timestamp: '2026-07-04T16:30:00Z',
      schoolId: 'gps-lko-005',
      schoolName: 'GPS Hazratganj Lucknow',
      userId: 'u6_lko',
      userEmail: 'gps-lko-005.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'conduct',
      status: 'Success',
      details: 'Evaluated personalized worksheet for student Vivek Saxena'
    },
    {
      id: 'log7',
      timestamp: '2026-07-06T08:15:00Z',
      schoolId: 'gps-asr-007',
      schoolName: 'GPS Amritsar Golden',
      userId: 'u7_asr',
      userEmail: 'vol.asr@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'verify',
      status: 'Success',
      details: 'Onboarded new students Navjot Singh and Harleen Kaur at Amritsar low-strength school'
    },
    {
      id: 'log8',
      timestamp: '2026-07-05T10:00:00Z',
      schoolId: 'gps-jai2-009',
      schoolName: 'GPS Jaipur Rural North',
      userId: 'u6_jai2',
      userEmail: 'gps-jai2-009.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'conduct',
      status: 'Success',
      details: 'Ran diagnostic assessment for Class 2 students Lakshya Sharma and Ritu Yadav'
    },
    {
      id: 'log9',
      timestamp: '2026-07-06T11:30:00Z',
      schoolId: 'gps-mt-001',
      schoolName: 'GPS Model Town Ludhiana',
      userId: 'u6',
      userEmail: 'gps-mt-001.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'download',
      status: 'Delayed',
      details: 'SUBMISSION DELAYED: Answers for Gurpreet Singh uploaded after the 1-hour submission window closed.'
    },
    {
      id: 'log10',
      timestamp: '2026-07-06T14:00:00Z',
      schoolId: 'gps-uda-010',
      schoolName: 'GPS Udaipur City',
      userId: 'u6_uda_a',
      userEmail: 'gps-uda-010.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'print',
      status: 'Success',
      details: 'Printed personalized worksheets for Class 4 students Arush Bhat and others'
    },
    // ── ICR Scan activity log entries ──
    {
      id: 'log11',
      timestamp: '2026-07-07T09:15:00Z',
      schoolId: 'gps-mt-001',
      schoolName: 'GPS Model Town Ludhiana',
      userId: 'u6',
      userEmail: 'gps-mt-001.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Diagnostic answer sheet for Simran Kaur scanned and evaluated. Placed at L3.0'
    },
    {
      id: 'log12',
      timestamp: '2026-07-07T10:00:00Z',
      schoolId: 'gps-vl-002',
      schoolName: 'GPS Rural Village Moga',
      userId: 'u7',
      userEmail: 'vol.rahul@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Processed diagnostic answer sheet for Manpreet Lal via ICR-9000 scanner. Placed at L1.0'
    },
    {
      id: 'log13',
      timestamp: '2026-07-08T08:30:00Z',
      schoolId: 'gps-amb-003',
      schoolName: 'GPS Cantt Ambala',
      userId: 'u6_amb',
      userEmail: 'gps-amb-003.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Batch scanned diagnostic sheets for Sandeep Kumar, Sneha Sharma, Rajesh Saini. All placed.'
    },
    {
      id: 'log14',
      timestamp: '2026-07-08T10:45:00Z',
      schoolId: 'gps-jai-004',
      schoolName: 'GPS Govind Dev Jaipur',
      userId: 'u6_jai',
      userEmail: 'gps-jai-004.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Extracted and evaluated Priya Patel diagnostic answers. L4.0 placed.'
    },
    {
      id: 'log15',
      timestamp: '2026-07-08T14:20:00Z',
      schoolId: 'gps-lko-005',
      schoolName: 'GPS Hazratganj Lucknow',
      userId: 'u6_lko',
      userEmail: 'gps-lko-005.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Worksheet WS_1005 scanned and evaluated for Vivek Saxena. Score: 2/2, L10 maintained.'
    },
    {
      id: 'log16',
      timestamp: '2026-07-09T11:00:00Z',
      schoolId: 'gps-bth-006',
      schoolName: 'GPS Bathinda City',
      userId: 'u6_bth_a',
      userEmail: 'gps-bth-006.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Worksheet WS_1003 evaluated for Kavya Reddy. Score: 2/3, L8 maintained with remedial needs.'
    },
    {
      id: 'log17',
      timestamp: '2026-07-09T15:30:00Z',
      schoolId: 'gps-pkl-008',
      schoolName: 'GPS Panchkula Sector',
      userId: 'u6_pkl_a',
      userEmail: 'gps-pkl-008.t01@fln.org',
      userRole: UserRole.TEACHER,
      activityType: 'scan',
      status: 'Success',
      details: 'ICR SCAN: Anika Gupta worksheet WS_1004 evaluated via ICR. Score: 2/2, L12 confirmed.'
    }
  ];

  const tickets: Ticket[] = [
    {
      id: 'tkt1',
      userId: 'u6',
      userEmail: 'gps-mt-001.t01@fln.org',
      userName: 'Ritu Sharma',
      userRole: UserRole.TEACHER,
      type: 'curriculum',
      subject: 'Ambiguous wording in Level 3 patterns question',
      description: 'The shapes used in the patterns question of Level 3 are hard for Class 2 children to identify. Recommend replacing with simpler fruit SVGs.',
      status: 'Open',
      createdAt: '2026-07-04T09:00:00Z'
    },
    {
      id: 'tkt2',
      userId: 'u6_bth_a',
      userEmail: 'gps-bth-006.t01@fln.org',
      userName: 'Harpreet Kaur',
      userRole: UserRole.TEACHER,
      type: 'general',
      subject: 'Delay in receiving printed worksheets for Bathinda school',
      description: 'The printed worksheets for Class 3 students in Bathinda have not arrived. Please check logistics.',
      status: 'Open',
      createdAt: '2026-07-05T14:30:00Z'
    },
    {
      id: 'tkt3',
      userId: 'u6_pkl_a',
      userEmail: 'gps-pkl-008.t01@fln.org',
      userName: 'Kavita Sharma',
      userRole: UserRole.TEACHER,
      type: 'curriculum',
      subject: 'Level 8 subtraction questions too advanced for Class 2',
      description: 'Some students placed at Level 8 are struggling with subtraction with borrowing. Suggest revisiting the difficulty curve.',
      status: 'Reviewed',
      createdAt: '2026-07-03T11:00:00Z'
    },
    {
      id: 'tkt4',
      userId: 'u7',
      userEmail: 'vol.rahul@fln.org',
      userName: 'Rahul Kumar',
      userRole: UserRole.TEACHER,
      type: 'general',
      subject: 'Volunteer access to diagnostic tools in Moga village',
      description: 'Unable to generate diagnostic worksheets for students at GPS Rural Village Moga. Access restricted.',
      status: 'Open',
      createdAt: '2026-07-06T09:15:00Z'
    }
  ];

  const announcements: Announcement[] = [
    {
      id: 'ann1',
      title: 'Mid-Year Assessment Cycle Starts Next Week',
      message: 'All district coordinators and school principals are requested to complete student rosters and run onboarding diagnostics. The Mid-year paper generation will unlock on July 12th.',
      isUrgent: true,
      authorEmail: 'superadmin@fln.org',
      createdAt: '2026-07-05T12:00:00Z'
    },
    {
      id: 'ann2',
      title: 'Bathinda District Performance Alert',
      message: 'Bathinda district is flagged as lagging with only 38% average certification rate. All block admins must prioritize remedial interventions in low-strength schools.',
      isUrgent: true,
      authorEmail: 'admin.pb@fln.org',
      createdAt: '2026-07-06T08:00:00Z'
    },
    {
      id: 'ann3',
      title: 'New Teacher Onboarding Training Sessions',
      message: 'Virtual training sessions for newly onboarded teachers will be held on July 15-16, 2026. Attendance is mandatory for all teachers from new schools.',
      isUrgent: false,
      authorEmail: 'superadmin@fln.org',
      createdAt: '2026-07-04T10:00:00Z'
    }
  ];

  return {
    users,
    schools,
    classes,
    students,
    worksheets,
    answerSubmissions,
    evaluationReports,
    tickets,
    logbook,
    announcements
  };
}

export function loadMockDB(): MockDatabaseSchema {
  const raw = localStorage.getItem(MOCK_DB_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {}
  }
  const seed = getInitialSeedData();
  saveMockDB(seed);
  return seed;
}

export function saveMockDB(data: MockDatabaseSchema) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(data));
}
