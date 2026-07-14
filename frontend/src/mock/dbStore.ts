import { User, UserRole, School, ClassGroup, Student, Question, Worksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Announcement } from '../types';
import { generateQuestionsForLevel } from '../utils/levelGenerator';

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
    { id: 'gps-mt-001', name: 'GPS Model Town Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'standard', teachersCount: 2 },
    { id: 'gps-vl-002', name: 'GPS Rural Village Moga', stateCode: 'PB', districtCode: 'MOG', blockCode: 'MOG-02', strength: 'standard', teachersCount: 0 },
    { id: 'gps-amb-003', name: 'GPS Cantt Ambala', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-01', strength: 'standard', teachersCount: 1 },
    { id: 'gps-jai-004', name: 'GPS Govind Dev Jaipur', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-01', strength: 'standard', teachersCount: 1 },
    { id: 'gps-lko-005', name: 'GPS Hazratganj Lucknow', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01', strength: 'standard', teachersCount: 1 },
    { id: 'gps-bth-006', name: 'GPS Bathinda City', stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01', strength: 'standard', teachersCount: 2 },
    { id: 'gps-asr-007', name: 'GPS Amritsar Golden', stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01', strength: 'standard', teachersCount: 1 },
    { id: 'gps-pkl-008', name: 'GPS Panchkula Sector', stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01', strength: 'standard', teachersCount: 2 },
    { id: 'gps-jai2-009', name: 'GPS Jaipur Rural North', stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02', strength: 'standard', teachersCount: 1 },
    { id: 'gps-uda-010', name: 'GPS Udaipur City', stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01', strength: 'standard', teachersCount: 2 },
    { id: 'gps-lko2-011', name: 'GPS Lucknow Aliganj', stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02', strength: 'standard', teachersCount: 1 },
    { id: 'gps-knp-012', name: 'GPS Kanpur Cantt', stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01', strength: 'standard', teachersCount: 1 },
    { id: 'gps-pb-ldh2-013', name: 'GPS Gill Village Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02', strength: 'standard', teachersCount: 1 },
    { id: 'gps-hr-amb2-014', name: 'GPS Ambala City South', stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02', strength: 'standard', teachersCount: 2 }
  ];

  const users: User[] = [
    { id: 'u1', email: 'superadmin@fln.org', name: 'Jinal Gupta', role: UserRole.SUPERADMIN },
    { id: 'u2', email: 'admin.pb@fln.org', name: 'State Coordinator Punjab', role: UserRole.ADMIN, stateCode: 'PB' },
    { id: 'u2_hr', email: 'admin.hr@fln.org', name: 'State Coordinator Haryana', role: UserRole.ADMIN, stateCode: 'HR' },
    { id: 'u2_rj', email: 'admin.rj@fln.org', name: 'State Coordinator Rajasthan', role: UserRole.ADMIN, stateCode: 'RJ' },
    { id: 'u2_up', email: 'admin.up@fln.org', name: 'State Coordinator Uttar Pradesh', role: UserRole.ADMIN, stateCode: 'UP' },
    { id: 'u3', email: 'district.ldh@fln.org', name: 'Ludhiana District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'PB', districtCode: 'LDH' },
    { id: 'u3_amb', email: 'district.amb@fln.org', name: 'Ambala District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'HR', districtCode: 'AMB' },
    { id: 'u3_jai', email: 'district.jai@fln.org', name: 'Jaipur District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'RJ', districtCode: 'JAI' },
    { id: 'u3_lko', email: 'district.lko@fln.org', name: 'Lucknow District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'UP', districtCode: 'LKO' },
    { id: 'u4', email: 'block.ldh-01@fln.org', name: 'Ludhiana Block Admin 1', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01' },
    { id: 'u4_lko', email: 'block.lko-01@fln.org', name: 'Lucknow Block Admin 1', role: UserRole.BLOCK_ADMIN, stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-01' },
    { id: 'u5', email: 'gps-mt-001@fln.org', name: 'GPS Model Town Principal', role: UserRole.SCHOOL, schoolId: 'gps-mt-001' },
    { id: 'u5_amb', email: 'gps-amb-003@fln.org', name: 'GPS Cantt Principal', role: UserRole.SCHOOL, schoolId: 'gps-amb-003' },
    { id: 'u5_jai', email: 'gps-jai-004@fln.org', name: 'GPS Govind Dev Principal', role: UserRole.SCHOOL, schoolId: 'gps-jai-004' },
    { id: 'u5_lko', email: 'gps-lko-005@fln.org', name: 'GPS Hazratganj Principal', role: UserRole.SCHOOL, schoolId: 'gps-lko-005' },
    { id: 'u6', email: 'gps-mt-001.t01@fln.org', name: 'Ritu Sharma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-mt-001' },
    { id: 'u6_amb', email: 'gps-amb-003.t01@fln.org', name: 'Meena Kumari (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-amb-003' },
    { id: 'u6_jai', email: 'gps-jai-004.t01@fln.org', name: 'Ram Gopal (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-jai-004' },
    { id: 'u6_lko', email: 'gps-lko-005.t01@fln.org', name: 'Suresh Kumar (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-lko-005' },
    { id: 'u7', email: 'vol.rahul@fln.org', name: 'Rahul Kumar (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-vl-002'] },
    { id: 'u7_amit', email: 'vol.amit@fln.org', name: 'Amit Saini (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-vl-002', 'gps-jai-004'] },
    { id: 'u7_sneha', email: 'vol.up_sneha@fln.org', name: 'Sneha Verma (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-lko-005'] },
    { id: 'u7_vipin', email: 'vol.hr_vipin@fln.org', name: 'Vipin Yadav (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-amb-003'] },
    // District admins for new districts
    { id: 'u3_bth', email: 'district.bth@fln.org', name: 'Bathinda District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'PB', districtCode: 'BTH' },
    { id: 'u3_asr', email: 'district.asr@fln.org', name: 'Amritsar District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'PB', districtCode: 'ASR' },
    { id: 'u3_pkl', email: 'district.pkl@fln.org', name: 'Panchkula District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'HR', districtCode: 'PKL' },
    { id: 'u3_uda', email: 'district.uda@fln.org', name: 'Udaipur District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'RJ', districtCode: 'UDA' },
    { id: 'u3_knp', email: 'district.knp@fln.org', name: 'Kanpur District Officer', role: UserRole.DISTRICT_ADMIN, stateCode: 'UP', districtCode: 'KNP' },
    // Block admins for new blocks
    { id: 'u4_bth', email: 'block.bth-01@fln.org', name: 'Bathinda Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'BTH', blockCode: 'BTH-01' },
    { id: 'u4_asr', email: 'block.asr-01@fln.org', name: 'Amritsar Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'ASR', blockCode: 'ASR-01' },
    { id: 'u4_pkl', email: 'block.pkl-01@fln.org', name: 'Panchkula Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'HR', districtCode: 'PKL', blockCode: 'PKL-01' },
    { id: 'u4_jai2', email: 'block.jai-02@fln.org', name: 'Jaipur Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'RJ', districtCode: 'JAI', blockCode: 'JAI-02' },
    { id: 'u4_uda', email: 'block.uda-01@fln.org', name: 'Udaipur Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'RJ', districtCode: 'UDA', blockCode: 'UDA-01' },
    { id: 'u4_lko2', email: 'block.lko-02@fln.org', name: 'Lucknow Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'UP', districtCode: 'LKO', blockCode: 'LKO-02' },
    { id: 'u4_knp', email: 'block.knp-01@fln.org', name: 'Kanpur Block Admin', role: UserRole.BLOCK_ADMIN, stateCode: 'UP', districtCode: 'KNP', blockCode: 'KNP-01' },
    { id: 'u4_ldh2', email: 'block.ldh-02@fln.org', name: 'Ludhiana Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-02' },
    { id: 'u4_amb2', email: 'block.amb-02@fln.org', name: 'Ambala Block Admin 2', role: UserRole.BLOCK_ADMIN, stateCode: 'HR', districtCode: 'AMB', blockCode: 'AMB-02' },
    // Principals for new schools
    { id: 'u5_bth', email: 'gps-bth-006@fln.org', name: 'GPS Bathinda Principal', role: UserRole.SCHOOL, schoolId: 'gps-bth-006' },
    { id: 'u5_asr', email: 'gps-asr-007@fln.org', name: 'GPS Amritsar Principal', role: UserRole.SCHOOL, schoolId: 'gps-asr-007' },
    { id: 'u5_pkl', email: 'gps-pkl-008@fln.org', name: 'GPS Panchkula Principal', role: UserRole.SCHOOL, schoolId: 'gps-pkl-008' },
    { id: 'u5_jai2', email: 'gps-jai2-009@fln.org', name: 'GPS Jaipur Rural Principal', role: UserRole.SCHOOL, schoolId: 'gps-jai2-009' },
    { id: 'u5_uda', email: 'gps-uda-010@fln.org', name: 'GPS Udaipur Principal', role: UserRole.SCHOOL, schoolId: 'gps-uda-010' },
    { id: 'u5_lko2', email: 'gps-lko2-011@fln.org', name: 'GPS Aliganj Principal', role: UserRole.SCHOOL, schoolId: 'gps-lko2-011' },
    { id: 'u5_knp', email: 'gps-knp-012@fln.org', name: 'GPS Kanpur Principal', role: UserRole.SCHOOL, schoolId: 'gps-knp-012' },
    { id: 'u5_ldh2', email: 'gps-pb-ldh2-013@fln.org', name: 'GPS Gill Village Principal', role: UserRole.SCHOOL, schoolId: 'gps-pb-ldh2-013' },
    { id: 'u5_amb2', email: 'gps-hr-amb2-014@fln.org', name: 'GPS Ambala South Principal', role: UserRole.SCHOOL, schoolId: 'gps-hr-amb2-014' },
    // Teachers for new schools
    { id: 'u6_bth_a', email: 'gps-bth-006.t01@fln.org', name: 'Harpreet Kaur (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-bth-006' },
    { id: 'u6_bth_b', email: 'gps-bth-006.t02@fln.org', name: 'Jaswant Singh (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-bth-006' },
    { id: 'u6_asr', email: 'gps-asr-007.t01@fln.org', name: 'Gurvinder Singh (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-asr-007' },
    { id: 'u6_pkl_a', email: 'gps-pkl-008.t01@fln.org', name: 'Kavita Sharma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-pkl-008' },
    { id: 'u6_pkl_b', email: 'gps-pkl-008.t02@fln.org', name: 'Rajesh Kumar (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-pkl-008' },
    { id: 'u6_jai2', email: 'gps-jai2-009.t01@fln.org', name: 'Ravi Verma (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-jai2-009' },
    { id: 'u6_uda_a', email: 'gps-uda-010.t01@fln.org', name: 'Madhu Saxena (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-uda-010' },
    { id: 'u6_uda_b', email: 'gps-uda-010.t02@fln.org', name: 'Prakash Choudhary (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-uda-010' },
    { id: 'u6_lko2', email: 'gps-lko2-011.t01@fln.org', name: 'Alok Mishra (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-lko2-011' },
    { id: 'u6_knp', email: 'gps-knp-012.t01@fln.org', name: 'Sunita Devi (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-knp-012' },
    { id: 'u6_ldh2', email: 'gps-pb-ldh2-013.t01@fln.org', name: 'Balwinder Kaur (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-pb-ldh2-013' },
    { id: 'u6_amb2', email: 'gps-hr-amb2-014.t01@fln.org', name: 'Nisha Rani (Teacher)', role: UserRole.TEACHER, schoolId: 'gps-hr-amb2-014' },
    // Volunteers for new schools
    { id: 'u7_asr', email: 'vol.asr@fln.org', name: 'Mandeep Kaur (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-asr-007'] },
    { id: 'u7_jai2_vol', email: 'vol.jai2@fln.org', name: 'Deepak Sharma (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-jai2-009'] },
    { id: 'u7_knp_vol', email: 'vol.knp@fln.org', name: 'Anita Singh (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-knp-012'] },
    { id: 'u7_ldh2_vol', email: 'vol.ldh2@fln.org', name: 'Gurpreet Kaur (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-pb-ldh2-013'] }
  ];

  const classes: ClassGroup[] = [
    { id: 'c1', schoolId: 'gps-mt-001', className: 'Class 2', section: 'A', teacherId: 'u6' },
    { id: 'c2', schoolId: 'gps-mt-001', className: 'Class 3', section: 'A', teacherId: 'u6' },
    { id: 'c3', schoolId: 'gps-vl-002', className: 'Class 2', section: 'A', teacherId: '' },
    { id: 'c4', schoolId: 'gps-amb-003', className: 'Class 3', section: 'A', teacherId: 'u6_amb' },
    { id: 'c5', schoolId: 'gps-jai-004', className: 'Class 4', section: 'A', teacherId: 'u6_jai' },
    { id: 'c6', schoolId: 'gps-lko-005', className: 'Class 3', section: 'A', teacherId: 'u6_lko' },
    { id: 'c7', schoolId: 'gps-bth-006', className: 'Class 3', section: 'A', teacherId: 'u6_bth_a' },
    { id: 'c8', schoolId: 'gps-bth-006', className: 'Class 4', section: 'A', teacherId: 'u6_bth_b' },
    { id: 'c9', schoolId: 'gps-asr-007', className: 'Class 2', section: 'A', teacherId: 'u6_asr' },
    { id: 'c10', schoolId: 'gps-pkl-008', className: 'Class 3', section: 'A', teacherId: 'u6_pkl_a' },
    { id: 'c11', schoolId: 'gps-pkl-008', className: 'Class 4', section: 'A', teacherId: 'u6_pkl_b' },
    { id: 'c12', schoolId: 'gps-jai2-009', className: 'Class 2', section: 'A', teacherId: 'u6_jai2' },
    { id: 'c13', schoolId: 'gps-uda-010', className: 'Class 4', section: 'A', teacherId: 'u6_uda_a' },
    { id: 'c14', schoolId: 'gps-uda-010', className: 'Class 3', section: 'A', teacherId: 'u6_uda_b' },
    { id: 'c15', schoolId: 'gps-lko2-011', className: 'Class 2', section: 'A', teacherId: 'u6_lko2' },
    { id: 'c16', schoolId: 'gps-lko2-011', className: 'Class 3', section: 'A', teacherId: 'u6_lko2' },
    { id: 'c17', schoolId: 'gps-knp-012', className: 'Class 2', section: 'A', teacherId: 'u6_knp' },
    { id: 'c18', schoolId: 'gps-pb-ldh2-013', className: 'Class 2', section: 'A', teacherId: 'u6_ldh2' },
    { id: 'c19', schoolId: 'gps-hr-amb2-014', className: 'Class 3', section: 'A', teacherId: 'u6_amb2' },
    { id: 'c20', schoolId: 'gps-mt-001', className: 'Class 4', section: 'A', teacherId: 'u6' }
  ];

  const students: Student[] = [
    { id: 's1', name: 'Amanpreet Singh', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 2, currentSubLevel: 0, targetLevel: 3, aadharMasked: 'XXXX-XXXX-4521', levelHistory: [{ level: 1, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }], streak: 5 },
    { id: 's2', name: 'Simran Kaur', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 3, currentSubLevel: 0, targetLevel: 4, aadharMasked: 'XXXX-XXXX-9874', levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }], streak: 3 },
    { id: 's3', name: 'Gurpreet Singh', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 4, currentSubLevel: 0, targetLevel: 5, aadharMasked: 'XXXX-XXXX-1122', levelHistory: [{ level: 3, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }], streak: 7 },
    { id: 's4', name: 'Manpreet Lal', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-5566', levelHistory: [{ level: 1, date: '2026-05-15', reason: 'Volunteer Diagnostic Placement' }], streak: 1 },
    { id: 's5', name: 'Harjeet Sandhu', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 2, currentSubLevel: 0, targetLevel: 3, aadharMasked: 'XXXX-XXXX-8811', levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Volunteer Diagnostic Placement' }], streak: 2 },
    { id: 's6', name: 'Sandeep Kumar', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 3, currentSubLevel: 0, targetLevel: 4, aadharMasked: 'XXXX-XXXX-7231', levelHistory: [{ level: 2, date: '2026-06-01', reason: 'Onboarding Diagnostic Placement' }], streak: 4 },
    { id: 's7', name: 'Sneha Sharma', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 5, currentSubLevel: 0, targetLevel: 6, aadharMasked: 'XXXX-XXXX-1002', levelHistory: [{ level: 3, date: '2026-06-01', reason: 'Onboarding Diagnostic Placement' }], streak: 9 },
    { id: 's8', name: 'Rajesh Saini', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 2, currentSubLevel: 0, targetLevel: 3, aadharMasked: 'XXXX-XXXX-3490', levelHistory: [{ level: 2, date: '2026-06-01', reason: 'Onboarding Diagnostic Placement' }], streak: 3 },
    { id: 's9', name: 'Priya Patel', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 4, currentSubLevel: 0, targetLevel: 5, aadharMasked: 'XXXX-XXXX-1992', levelHistory: [{ level: 3, date: '2026-06-15', reason: 'Onboarding Diagnostic Placement' }], streak: 6 },
    { id: 's10', name: 'Amit Kumar', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 5, currentSubLevel: 0, targetLevel: 6, aadharMasked: 'XXXX-XXXX-8822', levelHistory: [{ level: 4, date: '2026-06-15', reason: 'Onboarding Diagnostic Placement' }], streak: 11 },
    { id: 's11', name: 'Divya Gupta', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 3, currentSubLevel: 0, targetLevel: 4, aadharMasked: 'XXXX-XXXX-3344', levelHistory: [{ level: 2, date: '2026-06-15', reason: 'Onboarding Diagnostic Placement' }], streak: 5 },
    { id: 's12', name: 'Kabir Mehra', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-4545', levelHistory: [{ level: 1, date: '2026-06-05', reason: 'Volunteer Diagnostic Placement' }], streak: 2 },
    { id: 's13', name: 'Jyoti Yadav', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 2, currentSubLevel: 0, targetLevel: 3, aadharMasked: 'XXXX-XXXX-2121', levelHistory: [{ level: 1, date: '2026-06-05', reason: 'Volunteer Diagnostic Placement' }], streak: 3 },
    { id: 's14', name: 'Rajiv Malhotra', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko-005', teacherId: 'u6_lko', currentLevel: 3, currentSubLevel: 0, targetLevel: 4, aadharMasked: 'XXXX-XXXX-1155', levelHistory: [{ level: 2, date: '2026-06-20', reason: 'Onboarding Diagnostic Placement' }], streak: 6 },
    { id: 's15', name: 'Neha Agrawal', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko-005', teacherId: 'u6_lko', currentLevel: 4, currentSubLevel: 0, targetLevel: 5, aadharMasked: 'XXXX-XXXX-2266', levelHistory: [{ level: 3, date: '2026-06-20', reason: 'Onboarding Diagnostic Placement' }], streak: 8 },
    { id: 's16', name: 'Karan Johar', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko-005', teacherId: 'u6_lko', currentLevel: 5, currentSubLevel: 0, targetLevel: 6, aadharMasked: 'XXXX-XXXX-3377', levelHistory: [{ level: 4, date: '2026-06-20', reason: 'Onboarding Diagnostic Placement' }], streak: 12 },
    
    // ── Unplaced students (empty levelHistory) for Pending Diagnostics ──
    { id: 's_new_1', name: 'Gurleen Kaur', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-6677', levelHistory: [], streak: 0 },
    { id: 's_new_2', name: 'Vikram Yadav', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-7788', levelHistory: [], streak: 0 },
    { id: 's_new_3', name: 'Ananya Mishra', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-8899', levelHistory: [], streak: 0 },
    { id: 's_new_4', name: 'Rohit Sharma', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-9900', levelHistory: [], streak: 0 },
    { id: 's_new_5', name: 'Meera Joshi', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1100', levelHistory: [], streak: 0 },
    // ── Additional placed students at Level 8 ──
    { id: 's17', name: 'Arjun Mehta', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 8, currentSubLevel: 0, targetLevel: 9, aadharMasked: 'XXXX-XXXX-1201', levelHistory: [{ level: 4, date: '2026-04-15', reason: 'Onboarding Diagnostic Placement' }, { level: 6, date: '2026-05-20', reason: 'Mid-year worksheet performance' }, { level: 8, date: '2026-07-01', reason: 'End-of-year worksheet performance' }], streak: 15 },
    { id: 's18', name: 'Kavya Reddy', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-bth-006', teacherId: 'u6_bth_a', currentLevel: 8, currentSubLevel: 1, targetLevel: 9, aadharMasked: 'XXXX-XXXX-1202', levelHistory: [{ level: 3, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-10', reason: 'Baseline worksheet' }, { level: 8, date: '2026-07-03', reason: 'Mid-year worksheet' }], streak: 10 },
    { id: 's19', name: 'Rohan Das', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 8, currentSubLevel: 2, targetLevel: 9, aadharMasked: 'XXXX-XXXX-1203', levelHistory: [{ level: 2, date: '2026-04-20', reason: 'Onboarding Diagnostic Placement' }, { level: 8, date: '2026-06-25', reason: 'Remedial intervention' }], streak: 6 },
    // ── Students at Level 10 ──
    { id: 's20', name: 'Pooja Verma', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 10, currentSubLevel: 0, targetLevel: 11, aadharMasked: 'XXXX-XXXX-1204', levelHistory: [{ level: 5, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 7, date: '2026-05-15', reason: 'Baseline worksheet' }, { level: 10, date: '2026-06-30', reason: 'Mid-year worksheet' }], streak: 18 },
    { id: 's21', name: 'Vivek Saxena', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko-005', teacherId: 'u6_lko', currentLevel: 10, currentSubLevel: 0, targetLevel: 11, aadharMasked: 'XXXX-XXXX-1205', levelHistory: [{ level: 6, date: '2026-05-05', reason: 'Onboarding Diagnostic Placement' }, { level: 8, date: '2026-06-01', reason: 'Baseline worksheet' }, { level: 10, date: '2026-07-02', reason: 'Mid-year worksheet' }], streak: 14 },
    // ── Students at Level 12 ──
    { id: 's22', name: 'Anika Gupta', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-pkl-008', teacherId: 'u6_pkl_a', currentLevel: 12, currentSubLevel: 0, targetLevel: 13, aadharMasked: 'XXXX-XXXX-1206', levelHistory: [{ level: 7, date: '2026-04-25', reason: 'Onboarding Diagnostic Placement' }, { level: 10, date: '2026-06-05', reason: 'Baseline worksheet' }, { level: 12, date: '2026-07-04', reason: 'Mid-year worksheet' }], streak: 20 },
    { id: 's23', name: 'Ishaan Kapoor', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-uda-010', teacherId: 'u6_uda_b', currentLevel: 12, currentSubLevel: 0, targetLevel: 13, aadharMasked: 'XXXX-XXXX-1207', levelHistory: [{ level: 8, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 12, date: '2026-06-28', reason: 'Baseline worksheet' }], streak: 11 },
    // ── Students at Level 15 ──
    { id: 's24', name: 'Tanvi Bhatia', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 15, currentSubLevel: 0, targetLevel: 16, aadharMasked: 'XXXX-XXXX-1208', levelHistory: [{ level: 8, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 11, date: '2026-05-20', reason: 'Baseline worksheet' }, { level: 15, date: '2026-07-01', reason: 'Mid-year worksheet' }], streak: 25 },
    { id: 's25', name: 'Kabir Malhotra', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 15, currentSubLevel: 1, targetLevel: 16, aadharMasked: 'XXXX-XXXX-1209', levelHistory: [{ level: 10, date: '2026-05-15', reason: 'Onboarding Diagnostic Placement' }, { level: 15, date: '2026-07-02', reason: 'Baseline worksheet' }], streak: 8 },
    // ── Students at various other levels ──
    { id: 's26', name: 'Naina Agarwal', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 5, currentSubLevel: 0, targetLevel: 6, aadharMasked: 'XXXX-XXXX-1210', levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-20', reason: 'Baseline worksheet' }], streak: 7 },
    { id: 's27', name: 'Reyansh Singh', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-vl-002', currentLevel: 3, currentSubLevel: 0, targetLevel: 4, aadharMasked: 'XXXX-XXXX-1211', levelHistory: [{ level: 1, date: '2026-05-15', reason: 'Volunteer Diagnostic Placement' }, { level: 3, date: '2026-06-25', reason: 'Baseline worksheet' }], streak: 4 },
    { id: 's28', name: 'Myra Choudhary', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-bth-006', teacherId: 'u6_bth_a', currentLevel: 6, currentSubLevel: 0, targetLevel: 7, aadharMasked: 'XXXX-XXXX-1212', levelHistory: [{ level: 2, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 4, date: '2026-06-05', reason: 'Baseline worksheet' }, { level: 6, date: '2026-07-01', reason: 'Mid-year worksheet' }], streak: 9 },
    { id: 's29', name: 'Advik Nair', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-asr-007', teacherId: 'u6_asr', currentLevel: 4, currentSubLevel: 1, targetLevel: 5, aadharMasked: 'XXXX-XXXX-1213', levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Volunteer Diagnostic Placement' }, { level: 4, date: '2026-07-02', reason: 'Baseline worksheet' }], streak: 3 },
    { id: 's30', name: 'Aadhya Iyer', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-pkl-008', teacherId: 'u6_pkl_a', currentLevel: 7, currentSubLevel: 0, targetLevel: 8, aadharMasked: 'XXXX-XXXX-1214', levelHistory: [{ level: 3, date: '2026-04-25', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-01', reason: 'Baseline worksheet' }, { level: 7, date: '2026-07-03', reason: 'Mid-year worksheet' }], streak: 12 },
    { id: 's31', name: 'Vihaan Joshi', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 6, currentSubLevel: 2, targetLevel: 7, aadharMasked: 'XXXX-XXXX-1215', levelHistory: [{ level: 2, date: '2026-04-20', reason: 'Onboarding Diagnostic Placement' }, { level: 6, date: '2026-06-18', reason: 'Baseline worksheet' }], streak: 5 },
    { id: 's32', name: 'Anvi Kaur', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko-005', teacherId: 'u6_lko', currentLevel: 9, currentSubLevel: 0, targetLevel: 10, aadharMasked: 'XXXX-XXXX-1216', levelHistory: [{ level: 5, date: '2026-05-05', reason: 'Onboarding Diagnostic Placement' }, { level: 7, date: '2026-06-10', reason: 'Baseline worksheet' }, { level: 9, date: '2026-07-02', reason: 'Mid-year worksheet' }], streak: 13 },
    { id: 's33', name: 'Shaurya Patel', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko2-011', teacherId: 'u6_lko2', currentLevel: 11, currentSubLevel: 0, targetLevel: 12, aadharMasked: 'XXXX-XXXX-1217', levelHistory: [{ level: 6, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 8, date: '2026-06-15', reason: 'Baseline worksheet' }, { level: 11, date: '2026-07-04', reason: 'Mid-year worksheet' }], streak: 16 },
    { id: 's34', name: 'Krisha Sharma', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-hr-amb2-014', teacherId: 'u6_amb2', currentLevel: 7, currentSubLevel: 0, targetLevel: 8, aadharMasked: 'XXXX-XXXX-1218', levelHistory: [{ level: 3, date: '2026-05-20', reason: 'Onboarding Diagnostic Placement' }, { level: 7, date: '2026-07-01', reason: 'Baseline worksheet' }], streak: 8 },
    { id: 's35', name: 'Dhruv Thakur', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 11, currentSubLevel: 1, targetLevel: 12, aadharMasked: 'XXXX-XXXX-1219', levelHistory: [{ level: 6, date: '2026-05-15', reason: 'Onboarding Diagnostic Placement' }, { level: 9, date: '2026-06-20', reason: 'Baseline worksheet' }, { level: 11, date: '2026-07-03', reason: 'Mid-year worksheet' }], streak: 9 },
    { id: 's36', name: 'Aanya Gupta', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-bth-006', teacherId: 'u6_bth_b', currentLevel: 13, currentSubLevel: 0, targetLevel: 14, aadharMasked: 'XXXX-XXXX-1220', levelHistory: [{ level: 8, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 11, date: '2026-06-10', reason: 'Baseline worksheet' }, { level: 13, date: '2026-07-02', reason: 'Mid-year worksheet' }], streak: 17 },
    { id: 's37', name: 'Arush Bhat', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-uda-010', teacherId: 'u6_uda_a', currentLevel: 14, currentSubLevel: 0, targetLevel: 15, aadharMasked: 'XXXX-XXXX-1221', levelHistory: [{ level: 9, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 12, date: '2026-06-20', reason: 'Baseline worksheet' }, { level: 14, date: '2026-07-04', reason: 'Mid-year worksheet' }], streak: 19 },
    { id: 's38', name: 'Sara Khan', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-pkl-008', teacherId: 'u6_pkl_b', currentLevel: 9, currentSubLevel: 2, targetLevel: 10, aadharMasked: 'XXXX-XXXX-1222', levelHistory: [{ level: 4, date: '2026-04-25', reason: 'Onboarding Diagnostic Placement' }, { level: 9, date: '2026-06-28', reason: 'Baseline worksheet' }], streak: 7 },
    { id: 's39', name: 'Yuvan Reddy', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 6, currentSubLevel: 0, targetLevel: 7, aadharMasked: 'XXXX-XXXX-1223', levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 4, date: '2026-05-25', reason: 'Baseline worksheet' }, { level: 6, date: '2026-07-01', reason: 'Mid-year worksheet' }], streak: 11 },
    // ── Students in Bathinda (lagging district) ──
    { id: 's40', name: 'Simranjit Kaur', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-bth-006', teacherId: 'u6_bth_a', currentLevel: 2, currentSubLevel: 2, targetLevel: 3, aadharMasked: 'XXXX-XXXX-1224', levelHistory: [{ level: 1, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 2, date: '2026-06-20', reason: 'Baseline worksheet' }], streak: 2 },
    { id: 's41', name: 'Gurleen Kaur Bajwa', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-bth-006', teacherId: 'u6_bth_a', currentLevel: 1, currentSubLevel: 1, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1225', levelHistory: [{ level: 1, date: '2026-06-01', reason: 'Volunteer Diagnostic Placement' }], streak: 1 },
    { id: 's42', name: 'Mandeep Singh', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-bth-006', teacherId: 'u6_bth_b', currentLevel: 3, currentSubLevel: 0, targetLevel: 4, aadharMasked: 'XXXX-XXXX-1226', levelHistory: [{ level: 1, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 3, date: '2026-06-25', reason: 'Baseline worksheet' }], streak: 4 },
    // ── Students in Amritsar (Amritsar school) ──
    { id: 's43', name: 'Navjot Singh', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-asr-007', teacherId: 'u6_asr', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1227', levelHistory: [{ level: 1, date: '2026-06-10', reason: 'Volunteer Diagnostic Placement' }], streak: 1 },
    { id: 's44', name: 'Harleen Kaur', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-asr-007', teacherId: 'u6_asr', currentLevel: 2, currentSubLevel: 0, targetLevel: 3, aadharMasked: 'XXXX-XXXX-1228', levelHistory: [{ level: 1, date: '2026-06-10', reason: 'Volunteer Diagnostic Placement' }, { level: 2, date: '2026-07-01', reason: 'Baseline worksheet' }], streak: 2 },
    // ── Students in Jaipur Rural North ──
    { id: 's45', name: 'Lakshya Sharma', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-jai2-009', teacherId: 'u6_jai2', currentLevel: 5, currentSubLevel: 0, targetLevel: 6, aadharMasked: 'XXXX-XXXX-1229', levelHistory: [{ level: 2, date: '2026-05-15', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-28', reason: 'Baseline worksheet' }], streak: 6 },
    { id: 's46', name: 'Ritu Yadav', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-jai2-009', teacherId: 'u6_jai2', currentLevel: 3, currentSubLevel: 1, targetLevel: 4, aadharMasked: 'XXXX-XXXX-1230', levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Volunteer Diagnostic Placement' }, { level: 3, date: '2026-07-01', reason: 'Baseline worksheet' }], streak: 3 },
    // ── Unplaced students needing diagnostics ──
    { id: 's_new_6', name: 'Krishna Murari', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-mt-001', teacherId: 'u6', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1231', levelHistory: [], streak: 0 },
    { id: 's_new_7', name: 'Shivani Gupta', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-pkl-008', teacherId: 'u6_pkl_a', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1232', levelHistory: [], streak: 0 },
    { id: 's_new_8', name: 'Ravi Prakash', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko2-011', teacherId: 'u6_lko2', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1233', levelHistory: [], streak: 0 },
    { id: 's_new_9', name: 'Pooja Kumari', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-uda-010', teacherId: 'u6_uda_a', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1234', levelHistory: [], streak: 0 },
    { id: 's_new_10', name: 'Amit Verma', age: 7, classGroup: 'Class 2', section: 'A', schoolId: 'gps-knp-012', teacherId: 'u6_knp', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1235', levelHistory: [], streak: 0 },
    { id: 's_new_11', name: 'Priyanka Das', age: 8, classGroup: 'Class 2', section: 'A', schoolId: 'gps-pb-ldh2-013', teacherId: 'u6_ldh2', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1236', levelHistory: [], streak: 0 },
    { id: 's_new_12', name: 'Arjun Yadav', age: 8, classGroup: 'Class 3', section: 'A', schoolId: 'gps-hr-amb2-014', teacherId: 'u6_amb2', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1237', levelHistory: [], streak: 0 },
    { id: 's_new_13', name: 'Sana Sheikh', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-lko-005', teacherId: 'u6_lko', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1238', levelHistory: [], streak: 0 },
    { id: 's_new_14', name: 'Rohini Patil', age: 9, classGroup: 'Class 3', section: 'A', schoolId: 'gps-amb-003', teacherId: 'u6_amb', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1239', levelHistory: [], streak: 0 },
    { id: 's_new_15', name: 'Farhan Ali', age: 10, classGroup: 'Class 4', section: 'A', schoolId: 'gps-jai-004', teacherId: 'u6_jai', currentLevel: 1, currentSubLevel: 0, targetLevel: 2, aadharMasked: 'XXXX-XXXX-1240', levelHistory: [], streak: 0 }
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
      userRole: UserRole.VOLUNTEER,
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
      userRole: UserRole.VOLUNTEER,
      activityType: 'verify',
      status: 'Success',
      details: 'Onboarded new students Navjot Singh and Harleen Kaur at Amritsar school'
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
      userRole: UserRole.VOLUNTEER,
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
      userRole: UserRole.VOLUNTEER,
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
      message: 'Bathinda district is flagged as lagging with only 38% average certification rate. All block admins must prioritize remedial interventions in affected schools.',
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
