import fs from 'fs/promises';
import path from 'path';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'db.json');

// Types & Interfaces corresponding to MongoDB Collections in SRS §10
export enum UserRole {
  SUPERADMIN = 'superadmin',
  TEACHER = 'teacher'
}

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[]; // for Volunteers
  delayedAttemptsCount?: number;
  isBanned?: boolean;
}

export interface School {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: 'high' | 'low'; // High-strength vs. Low-strength (§1.2)
  teachersCount: number;
  isAccessLocked?: boolean;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  className: string; // e.g. "Class 2", "Class 3", "Class 4"
  section: string; // e.g. "A", "B"
  teacherId: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  classGroup: string; // "Class 2" | "Class 3" | "Class 4"
  section: string;
  schoolId: string;
  teacherId?: string;
  currentLevel: number;
  currentSubLevel?: number;
  targetLevel: number;
  aadharMasked: string; // Mandatory, unique identifier masked (§13.2 R-6)
  levelHistory: { level: number; subLevel?: number; date: string; reason: string }[];
  streak: number;
}

export interface Question {
  question_id: string;
  question: string;
  answer: string;
  answer_type: 'text' | 'number' | 'choice';
  choices?: string[];
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_level: number; // Mapping to mathematical level
  svgAsset?: string; // Standard pre-built SVG asset category
}

export interface Worksheet {
  id: string; // Exam ID
  classId: string;
  className: string;
  section: string;
  schoolId: string;
  generatedByRole: UserRole;
  generatedByEmail: string;
  cycle: 'Baseline' | 'Mid-year' | 'End-of-year';
  date: string;
  questions: Question[];
  printed: boolean;
  locks: {
    locked: boolean;
    lockedByRole: UserRole | null;
    lockedByEmail: string | null;
    timestamp: string | null;
  };
  timing: {
    examDate: string; // e.g. "2026-07-06"
    printWindowStart: string; // ISO String
    printWindowEnd: string; // ISO String
    examWindowStart: string; // ISO String
    examWindowEnd: string; // ISO String
    submissionWindowEnd: string; // ISO String
  };
  delayLogs: {
    delayedAttemptsCount: number;
    submittingTeachers: string[];
  };
}

export interface AnswerSubmission {
  id: string;
  worksheetId: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  classId: string;
  submittedAt: string;
  isDelayed: boolean;
  answers: { [questionId: string]: string }; // Q1 -> A, Q2 -> 5, etc.
}

export interface EvaluationReport {
  id: string;
  studentId: string;
  worksheetId: string;
  score: number;
  totalQuestions: number;
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  narrative: string; // Narrative summary for parent/teacher
  recommendedLevel: number;
  recommendedSubLevel?: number;
  timestamp: string;
}

export interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  type: 'general' | 'curriculum';
  subject: string;
  description: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  activityType: 'download' | 'print' | 'conduct' | 'scan' | 'verify' | 'ticket';
  status: 'Success' | 'Failed' | 'Delayed';
  details: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  isUrgent: boolean;
  authorEmail: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: User[];
  schools: School[];
  classes: ClassGroup[];
  students: Student[];
  questions: Question[];
  worksheets: Worksheet[];
  answerSubmissions: AnswerSubmission[];
  evaluationReports: EvaluationReport[];
  tickets: Ticket[];
  logbook: LogEntry[];
  announcements: Announcement[];
}

export class DBStore {
  private data: DatabaseSchema | null = null;

  async init() {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
    } catch (_) {}

    try {
      const content = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(content);
      
      // Auto-merge any newly defined pre-seeded users, schools, classes, and students
      const seed = this.getSeedData();
      let modified = false;

      if (!this.data.users) {
        this.data.users = [];
        modified = true;
      }
      for (const u of seed.users) {
        if (!this.data.users.some(existing => existing.email.toLowerCase() === u.email.toLowerCase())) {
          this.data.users.push(u);
          modified = true;
        }
      }

      if (!this.data.schools) {
        this.data.schools = [];
        modified = true;
      }
      for (const s of seed.schools) {
        if (!this.data.schools.some(existing => existing.id === s.id)) {
          this.data.schools.push(s);
          modified = true;
        }
      }

      if (!this.data.classes) {
        this.data.classes = [];
        modified = true;
      }
      for (const c of seed.classes) {
        if (!this.data.classes.some(existing => existing.id === c.id)) {
          this.data.classes.push(c);
          modified = true;
        }
      }

      if (!this.data.students) {
        this.data.students = [];
        modified = true;
      }
      for (const std of seed.students) {
        if (!this.data.students.some(existing => existing.id === std.id)) {
          this.data.students.push(std);
          modified = true;
        }
      }

      if (!this.data.announcements) {
        this.data.announcements = [];
        modified = true;
      }
      if (!this.data.tickets) {
        this.data.tickets = [];
        modified = true;
      }
      if (!this.data.logbook) {
        this.data.logbook = [];
        modified = true;
      }

      // Auto-migrate worksheets to include `printed` field
      if (this.data.worksheets) {
        for (const ws of this.data.worksheets) {
          if (ws.printed === undefined) {
            ws.printed = false;
            modified = true;
          }
        }
      }

      if (modified) {
        await this.save();
      }
    } catch (_) {
      // If DB file does not exist, pre-seed data
      this.data = this.getSeedData();
      await this.save();
    }
  }

  private async save() {
    if (!this.data) return;
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async reset() {
    this.data = this.getSeedData();
    await this.save();
  }

  // --- Collection Accessors ---

  async getUsers() { return this.data!.users; }
  async getSchools() { return this.data!.schools; }
  async getClasses() { return this.data!.classes; }
  async getStudents() { return this.data!.students; }
  async getQuestions() { return this.data!.questions; }
  async getWorksheets() { return this.data!.worksheets; }
  async getAnswerSubmissions() { return this.data!.answerSubmissions; }
  async getEvaluationReports() { return this.data!.evaluationReports; }
  async getTickets() { return this.data!.tickets; }
  async getLogbook() { return this.data!.logbook; }
  async getAnnouncements() { return this.data!.announcements; }

  // --- Write / Update Helpers ---

  async addUser(user: User) {
    this.data!.users.push(user);
    await this.save();
    return user;
  }

  async addSchool(school: School) {
    this.data!.schools.push(school);
    await this.save();
    return school;
  }

  async addClass(cls: ClassGroup) {
    this.data!.classes.push(cls);
    await this.save();
    return cls;
  }

  async addStudent(student: Student) {
    this.data!.students.push(student);
    await this.save();
    return student;
  }

  async updateStudent(studentId: string, updates: Partial<Student>) {
    const s = this.data!.students.find(x => x.id === studentId);
    if (s) {
      Object.assign(s, updates);
      await this.save();
    }
    return s;
  }

  async updateClass(cls: ClassGroup) {
    const existing = this.data!.classes.find(c => c.id === cls.id);
    if (existing) {
      Object.assign(existing, cls);
      await this.save();
    }
    return existing;
  }

  async addWorksheet(ws: Worksheet) {
    this.data!.worksheets.push(ws);
    await this.save();
    return ws;
  }

  async updateWorksheet(worksheetId: string, updates: Partial<Worksheet>) {
    const ws = this.data!.worksheets.find(x => x.id === worksheetId);
    if (ws) {
      Object.assign(ws, updates);
      await this.save();
    }
    return ws;
  }

  async addAnswerSubmission(sub: AnswerSubmission) {
    this.data!.answerSubmissions.push(sub);
    await this.save();
    return sub;
  }

  async addEvaluationReport(rep: EvaluationReport) {
    this.data!.evaluationReports.push(rep);
    await this.save();
    return rep;
  }

  async addTicket(t: Ticket) {
    this.data!.tickets.push(t);
    await this.save();
    return t;
  }

  async updateTicket(id: string, updates: Partial<Ticket>) {
    const t = this.data!.tickets.find(x => x.id === id);
    if (t) {
      Object.assign(t, updates);
      await this.save();
    }
    return t;
  }

  async updateUser(userId: string, updates: Partial<User>) {
    const u = this.data!.users.find(x => x.id === userId);
    if (u) {
      Object.assign(u, updates);
      await this.save();
    }
    return u;
  }

  async updateSchool(schoolId: string, updates: Partial<School>) {
    const s = this.data!.schools.find(x => x.id === schoolId);
    if (s) {
      Object.assign(s, updates);
      await this.save();
    }
    return s;
  }

  async addLog(log: LogEntry) {
    this.data!.logbook.unshift(log);
    await this.save();
    return log;
  }

  async addAnnouncement(ann: Announcement) {
    this.data!.announcements.unshift(ann);
    await this.save();
    return ann;
  }

  // --- Preloaded Question Pool (Mathematical Curriculum Questions Classes 2-4) ---
  private getSeedQuestions(): Question[] {
    return [
      // Level 1: Preschool & Intro Counting
      {
        question_id: 'L1_Q1',
        question: 'Count the apples in the picture. How many apples are there?',
        answer: '5',
        answer_type: 'number',
        topic: 'Number Sense',
        subtopic: 'Counting',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'fruits'
      },
      {
        question_id: 'L1_Q2',
        question: 'Count the circles and write the total number.',
        answer: '3',
        answer_type: 'number',
        topic: 'Shapes',
        subtopic: 'Recognition',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'shapes'
      },
      // Level 2: Class 1 Addition & Simple Shapes
      {
        question_id: 'L2_Q1',
        question: 'Calculate: 3 + 4 = ?',
        answer: '7',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Addition',
        difficulty: 'easy',
        source_level: 2,
        svgAsset: 'numbers'
      },
      {
        question_id: 'L2_Q2',
        question: 'Complete the pattern: Red Circle, Blue Circle, Red Circle, ?',
        answer: 'Blue Circle',
        answer_type: 'choice',
        choices: ['Red Circle', 'Blue Circle', 'Green Circle'],
        topic: 'Patterns',
        subtopic: 'Completing Patterns',
        difficulty: 'medium',
        source_level: 2,
        svgAsset: 'shapes'
      },
      // Level 3: Class 2 Measurement, Time, Simple Operations
      {
        question_id: 'L3_Q1',
        question: 'If a pencil is 8 centimeters long and we cut 3 centimeters off, how long is it now?',
        answer: '5',
        answer_type: 'number',
        topic: 'Measurement',
        subtopic: 'Length Subtraction',
        difficulty: 'medium',
        source_level: 3,
        svgAsset: 'tracing'
      },
      {
        question_id: 'L3_Q2',
        question: 'Look at the clock. If the short hand points to 3 and the long hand points to 12, what hour is it?',
        answer: '3',
        answer_type: 'number',
        topic: 'Calendar and Time',
        subtopic: 'Reading Hours',
        difficulty: 'easy',
        source_level: 3,
        svgAsset: 'numbers'
      },
      // Level 4: Class 3 Fractions, 2D/3D shapes, Money
      {
        question_id: 'L4_Q1',
        question: 'Ramu has a pizza cut into 4 equal slices. He eats 1 slice. What fraction of the pizza is left?',
        answer: '3/4',
        answer_type: 'choice',
        choices: ['1/4', '2/4', '3/4', '4/4'],
        topic: 'Fractions',
        subtopic: 'Fraction Representation',
        difficulty: 'medium',
        source_level: 4,
        svgAsset: 'shapes'
      },
      {
        question_id: 'L4_Q2',
        question: 'You buy a toy for 15 rupees and give the shopkeeper a 50-rupee note. How many rupees do you get back?',
        answer: '35',
        answer_type: 'number',
        topic: 'Money',
        subtopic: 'Transaction Change',
        difficulty: 'hard',
        source_level: 4,
        svgAsset: 'numbers'
      },
      // Level 5: Class 4 Double-digit operations, Multiplication, Decimals intro
      {
        question_id: 'L5_Q1',
        question: 'Multiply: 12 x 5 = ?',
        answer: '60',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'easy',
        source_level: 5,
        svgAsset: 'numbers'
      },
      {
        question_id: 'L5_Q2',
        question: 'In a class there are 5 benches. Each bench holds 4 students. How many students can sit in total?',
        answer: '20',
        answer_type: 'number',
        topic: 'Data Handling',
        subtopic: 'Simple Arithmetic Multiplication',
        difficulty: 'medium',
        source_level: 5,
        svgAsset: 'animals'
      },
      // Level 6: Higher level calendar, division, data charts
      {
        question_id: 'L6_Q1',
        question: 'Divide: 48 / 6 = ?',
        answer: '8',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Division',
        difficulty: 'medium',
        source_level: 6,
        svgAsset: 'numbers'
      },
      {
        question_id: 'L6_Q2',
        question: 'If July 1st is a Monday, what day of the week is July 8th?',
        answer: 'Monday',
        answer_type: 'choice',
        choices: ['Monday', 'Tuesday', 'Sunday', 'Wednesday'],
        topic: 'Calendar and Time',
        subtopic: 'Calendar Arithmetic',
        difficulty: 'hard',
        source_level: 6,
        svgAsset: 'numbers'
      }
    ];
  }

  // --- Comprehensive Pre-Seeded Workspace Data ---
  private getSeedData(): DatabaseSchema {
    const schools: School[] = [
      { id: 'gps-mt-001', name: 'GPS Model Town Ludhiana', stateCode: 'PB', districtCode: 'LDH', blockCode: 'LDH-01', strength: 'high', teachersCount: 1 },
    ];

    const users: User[] = [
      { id: 'u1', email: 'superadmin@fln.org', name: 'Jinal Gupta', password: 'Fln@2026', role: UserRole.SUPERADMIN },
      { id: 'u6', email: 'gps-mt-001.t01@fln.org', name: 'Amanpreet Kaur (Teacher)', password: 'Fln@2026', role: UserRole.TEACHER, schoolId: 'gps-mt-001' },
  ];

  const classes: ClassGroup[] = [
      { id: 'c1', schoolId: 'gps-mt-001', className: 'Class 2', section: 'A', teacherId: 'u6' },
    ];

    const students: Student[] = [
      {
        id: 's1',
        name: 'Amanpreet Singh',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-4521',
        levelHistory: [{ level: 1, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }],
        streak: 5
      },
      {
        id: 's2',
        name: 'Simran Kaur',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-9874',
        levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }],
        streak: 3
      },
      {
        id: 's3',
        name: 'Gurpreet Singh',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-3344',
        levelHistory: [{ level: 1, date: '2026-04-12', reason: 'Onboarding Diagnostic Placement' }],
        streak: 2
      },
      {
        id: 's4',
        name: 'Pooja Verma',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-5567',
        levelHistory: [{ level: 3, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }],
        streak: 6
      },
      {
        id: 's5',
        name: 'Ravi Kumar',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-8890',
        levelHistory: [{ level: 1, date: '2026-04-15', reason: 'Onboarding Diagnostic Placement' }],
        streak: 4
      },
    ];

    const seedQuestions = this.getSeedQuestions();

    // --- Preseeded Worksheet Variations ---
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
        printed: true,
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
        id: 'log12',
        timestamp: '2026-07-06T11:30:00Z',
        schoolId: 'gps-mt-001',
        schoolName: 'GPS Model Town Ludhiana',
        userId: 'u6',
        userEmail: 'gps-mt-001.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'download',
        status: 'Delayed',
        details: 'SUBMISSION DELAYED: Answers for Gurpreet Singh uploaded after the 1-hour submission window closed.'
      }
    ];

    const tickets: Ticket[] = [
      {
        id: 'tkt1',
        userId: 'u6',
        userEmail: 'gps-mt-001.t01@fln.org',
        userName: 'Amanpreet Kaur',
        userRole: UserRole.TEACHER,
        type: 'curriculum',
        subject: 'Ambiguous wording in Level 3 patterns question',
        description: 'The shapes used in the patterns question of Level 3 are hard for Class 2 children to identify. Recommend replacing with simpler fruit SVGs.',
        status: 'Open',
        createdAt: '2026-07-04T09:00:00Z'
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
      questions: seedQuestions,
      worksheets,
      answerSubmissions,
      evaluationReports,
      tickets,
      logbook,
      announcements
    };
  }
}

export const dbStore = new DBStore();