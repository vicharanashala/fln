import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import { MongoClient, Db } from 'mongodb';
import { ConceptMasteryProfile } from './conceptMastery';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'db.json');

// Every seeded demo account shares one password, stored ONLY as a bcrypt hash
// (never as plaintext). Defaults to the well-known demo password shown on the login
// screen; override with SEED_DEMO_PASSWORD for a private deployment.
const SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Fln@2026';
const SEED_DEMO_PASSWORD_HASH = bcrypt.hashSync(SEED_DEMO_PASSWORD, 10);

export let mongoClient: MongoClient | null = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.warn("⚠️  MONGODB_URI or MONGO_URI not set — using file-based DB fallback.");
    return;
  }
  try {
    mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 3000,
      socketTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000,
    });
    await mongoClient.connect();
    console.log("✅ MongoDB Connected");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ MongoDB connection failed:", message);
    console.warn("⚠️  Server will start without MongoDB. Using file-based DB fallback.");
    mongoClient = null;
  }
};

// Types & Interfaces corresponding to MongoDB Collections in SRS §10
export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  DISTRICT_ADMIN = 'district_admin',
  BLOCK_ADMIN = 'block_admin',
  SCHOOL = 'school',
  TEACHER = 'teacher',
  VOLUNTEER = 'volunteer'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string; // bcrypt hash; verified at login. Never sent to clients.
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

/**
 * One rendered file coming out of the standalone Levels_backend batch
 * pipeline (POST /api/generate-batch) for a single student x sublevel x
 * set. answerKey/coords are stored verbatim (shape from that service's
 * buildCleanAnswerKey / captureCoords) so the ICR evaluation pipeline can
 * mark against the real thing instead of a placeholder.
 */
export interface LevelWorksheet {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  levelId: number;
  sublevelId: string;
  setNum: number;
  pdfUrl: string;
  answerKey: any;
  coords: any;
  generatedAt: string;
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

export type InterventionStrategyType = 'small_group' | 'one_on_one' | 'peer_tutoring' | 'visual_aids' | 'manipulatives' | 'worksheets' | 'game_based' | 'other';

export interface Intervention {
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
  strategyType: InterventionStrategyType;
  strategyDescription: string;
  duration: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending_review';
  outcome?: {
    improved: boolean;
    previousLevel: number;
    newLevel?: number;
    improvementDetails?: string;
    assessmentId?: string;
    detectedAt?: string;
  };
  isPromoted: boolean;
  promotedAt?: string;
  createdAt: string;
}

export interface BestPractice {
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
}

interface DatabaseSchema {
  users: User[];
  schools: School[];
  classes: ClassGroup[];
  students: Student[];
  questions: Question[];
  worksheets: Worksheet[];
  levelWorksheets: LevelWorksheet[];
  answerSubmissions: AnswerSubmission[];
  evaluationReports: EvaluationReport[];
  tickets: Ticket[];
  logbook: LogEntry[];
  announcements: Announcement[];
  interventions: Intervention[];
  bestPractices: BestPractice[];
  conceptMasteryProfiles: ConceptMasteryProfile[];
}

const COLLECTION_NAMES: Record<keyof DatabaseSchema, string> = {
  users: 'users',
  schools: 'schools',
  classes: 'classes',
  students: 'students',
  questions: 'questions',
  worksheets: 'worksheets',
  levelWorksheets: 'level_worksheets',
  answerSubmissions: 'answer_submissions',
  evaluationReports: 'evaluation_reports',
  tickets: 'tickets',
  logbook: 'logbook',
  announcements: 'announcements',
  interventions: 'interventions',
  bestPractices: 'best_practices',
  conceptMasteryProfiles: 'concept_mastery_profiles',
};

export class DBStore {
  private data: DatabaseSchema | null = null;
  public useMongo: boolean = false;
  private mongoDb: Db | null = null;

  getDb() {
    if (!mongoClient) return null;
    return mongoClient.db();
  }

  async init() {
    if (mongoClient) {
      console.log('Loading data from MongoDB...');
      this.mongoDb = mongoClient.db();
      const db = this.mongoDb;
      this.data = {} as DatabaseSchema;
      try {
        for (const [key, collName] of Object.entries(COLLECTION_NAMES)) {
          const docs = await db.collection(collName).find().toArray();
          (this.data as any)[key] = docs.map(({ _id, ...rest }) => rest);
        }
        console.log(`MongoDB loaded: ${this.data.users?.length || 0} users, ${this.data.schools?.length || 0} schools, ${this.data.students?.length || 0} students`);
      } catch (err: any) {
        console.error("❌ MongoDB initialization failed, falling back to file DB:", err.message);
        this.mongoDb = null;
        // Import or update the exported reference to signal that MongoDB is unavailable
        const dbModule = await import('./db');
        dbModule.mongoClient = null;
        await this.init(); // recurse to load file DB
      }
    } else {
      console.log('No MongoDB — falling back to file-based DB');
      try {
        await fs.mkdir(DB_DIR, { recursive: true });
      } catch (_) {}
      try {
        const content = await fs.readFile(DB_FILE, 'utf-8');
        this.data = JSON.parse(content);
      } catch (_) {
        this.data = this.getSeedData();
        await this.save();
      }
    }
  }

  private async save() {
    if (!this.data) return;
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private async persistCollection(key: keyof DatabaseSchema) {
    if (!this.data || !mongoClient) return;
    const db = this.getDb();
    const collName = COLLECTION_NAMES[key];
    const items = (this.data as any)[key] || [];
    const coll = db.collection(collName);
    await coll.deleteMany({});
    if (items.length > 0) {
      await coll.insertMany(items);
    }
  }

  async reset() {
    this.data = this.getSeedData();
    if (mongoClient) {
      const db = this.getDb();
      for (const [key, collName] of Object.entries(COLLECTION_NAMES)) {
        const items = (this.data as any)[key] || [];
        const coll = db.collection(collName);
        await coll.deleteMany({});
        if (items.length > 0) {
          await coll.insertMany(items);
        }
      }
    } else {
      await this.save();
    }
  }

  // --- Collection Accessors ---

  getUserSync(email: string): User | null {
    if (!this.data || !this.data.users) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getUsers() {
    return this.data?.users || [];
  }
  async getSchools() {
    return this.data?.schools || [];
  }
  async getClasses() {
    return this.data?.classes || [];
  }
  async getStudents() {
    return this.data?.students || [];
  }
  async getQuestions() {
    return this.data?.questions || [];
  }
  async getWorksheets() {
    return this.data?.worksheets || [];
  }
  async getLevelWorksheets() {
    return this.data?.levelWorksheets || [];
  }
  async getAnswerSubmissions() {
    return this.data?.answerSubmissions || [];
  }
  async getEvaluationReports() {
    return this.data?.evaluationReports || [];
  }
  async getTickets() {
    return this.data?.tickets || [];
  }
  async getLogbook() {
    return this.data?.logbook || [];
  }
  async getAnnouncements() {
    return this.data?.announcements || [];
  }

  async addUser(user: User) {
    if (this.mongoDb) await this.mongoDb.collection('users').insertOne(user);
    if (this.data) this.data.users.push(user);
    if (!this.mongoDb) await this.save();
    return user;
  }

  async addStudent(student: Student) {
    if (this.mongoDb) await this.mongoDb.collection('students').insertOne(student);
    if (this.data) this.data.students.push(student);
    if (!this.mongoDb) await this.save();
    return student;
  }

  async updateStudent(studentId: string, updates: Partial<Student>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('students').updateOne({ id: studentId }, { $set: updates });
      const s = await this.mongoDb.collection<Student>('students').findOne({ id: studentId });
      if (s && this.data) {
        const idx = this.data.students.findIndex(x => x.id === studentId);
        if (idx !== -1) this.data.students[idx] = s;
      }
      return s || undefined;
    }
    if (this.data) {
      const idx = this.data.students.findIndex(x => x.id === studentId);
      if (idx !== -1) { Object.assign(this.data.students[idx], updates); await this.save(); return this.data.students[idx]; }
    }
    return undefined;
  }

  async addWorksheet(ws: Worksheet) {
    if (this.mongoDb) await this.mongoDb.collection('worksheets').insertOne(ws);
    if (this.data) this.data.worksheets.push(ws);
    if (!this.mongoDb) await this.save();
    return ws;
  }

  async updateWorksheet(worksheetId: string, updates: Partial<Worksheet>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('worksheets').updateOne({ id: worksheetId }, { $set: updates });
      const ws = await this.mongoDb.collection<Worksheet>('worksheets').findOne({ id: worksheetId });
      if (ws && this.data) {
        const idx = this.data.worksheets.findIndex(x => x.id === worksheetId);
        if (idx !== -1) this.data.worksheets[idx] = ws;
      }
      return ws || undefined;
    }
    if (this.data) {
      const idx = this.data.worksheets.findIndex(x => x.id === worksheetId);
      if (idx !== -1) { Object.assign(this.data.worksheets[idx], updates); await this.save(); return this.data.worksheets[idx]; }
    }
    return undefined;
  }

  async addLevelWorksheet(ws: LevelWorksheet) {
    if (this.mongoDb) await this.mongoDb.collection('levelWorksheets').insertOne(ws);
    if (this.data) this.data.levelWorksheets.push(ws);
    if (!this.mongoDb) await this.save();
    return ws;
  }

  async addAnswerSubmission(sub: AnswerSubmission) {
    if (this.mongoDb) await this.mongoDb.collection('answerSubmissions').insertOne(sub);
    if (this.data) this.data.answerSubmissions.push(sub);
    if (!this.mongoDb) await this.save();
    return sub;
  }

  async addEvaluationReport(rep: EvaluationReport) {
    if (this.mongoDb) await this.mongoDb.collection('evaluationReports').insertOne(rep);
    if (this.data) this.data.evaluationReports.push(rep);
    if (!this.mongoDb) await this.save();
    return rep;
  }

  async addTicket(t: Ticket) {
    if (this.mongoDb) await this.mongoDb.collection('tickets').insertOne(t);
    if (this.data) this.data.tickets.push(t);
    if (!this.mongoDb) await this.save();
    return t;
  }

  async updateTicket(id: string, updates: Partial<Ticket>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('tickets').updateOne({ id }, { $set: updates });
      const t = await this.mongoDb.collection<Ticket>('tickets').findOne({ id });
      if (t && this.data) {
        const idx = this.data.tickets.findIndex(x => x.id === id);
        if (idx !== -1) this.data.tickets[idx] = t;
      }
      return t || undefined;
    }
    if (this.data) {
      const idx = this.data.tickets.findIndex(x => x.id === id);
      if (idx !== -1) { Object.assign(this.data.tickets[idx], updates); await this.save(); return this.data.tickets[idx]; }
    }
    return undefined;
  }

  async updateUser(userId: string, updates: Partial<User>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('users').updateOne({ id: userId }, { $set: updates });
      const u = await this.mongoDb.collection<User>('users').findOne({ id: userId });
      if (u && this.data) {
        const idx = this.data.users.findIndex(x => x.id === userId);
        if (idx !== -1) this.data.users[idx] = u;
      }
      return u || undefined;
    }
    if (this.data) {
      const idx = this.data.users.findIndex(x => x.id === userId);
      if (idx !== -1) { Object.assign(this.data.users[idx], updates); await this.save(); return this.data.users[idx]; }
    }
    return undefined;
  }

  async updateSchool(schoolId: string, updates: Partial<School>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('schools').updateOne({ id: schoolId }, { $set: updates });
      const s = await this.mongoDb.collection<School>('schools').findOne({ id: schoolId });
      if (s && this.data) {
        const idx = this.data.schools.findIndex(x => x.id === schoolId);
        if (idx !== -1) this.data.schools[idx] = s;
      }
      return s || undefined;
    }
    if (this.data) {
      const idx = this.data.schools.findIndex(x => x.id === schoolId);
      if (idx !== -1) { Object.assign(this.data.schools[idx], updates); await this.save(); return this.data.schools[idx]; }
    }
    return undefined;
  }

  async addSchool(school: School) {
    if (this.mongoDb) await this.mongoDb.collection('schools').insertOne(school);
    if (this.data) this.data.schools.push(school);
    if (!this.mongoDb) await this.save();
    return school;
  }

  async addLog(log: LogEntry) {
    if (this.mongoDb) await this.mongoDb.collection('logbook').insertOne(log);
    if (this.data) this.data.logbook.unshift(log);
    if (!this.mongoDb) await this.save();
    return log;
  }

  async addAnnouncement(ann: Announcement) {
    if (this.mongoDb) await this.mongoDb.collection('announcements').insertOne(ann);
    if (this.data) this.data.announcements.unshift(ann);
    if (!this.mongoDb) await this.save();
    return ann;
  }

  // --- Intervention & Best Practice Methods ---

  async getInterventions() {
    return this.data?.interventions || [];
  }

  async addIntervention(intervention: Intervention) {
    if (this.mongoDb) await this.mongoDb.collection('interventions').insertOne(intervention);
    if (this.data) this.data.interventions.push(intervention);
    if (!this.mongoDb) await this.save();
    return intervention;
  }

  async updateIntervention(id: string, updates: Partial<Intervention>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('interventions').updateOne({ id }, { $set: updates });
      const i = await this.mongoDb.collection<Intervention>('interventions').findOne({ id });
      if (i && this.data) {
        const idx = this.data.interventions.findIndex(x => x.id === id);
        if (idx !== -1) this.data.interventions[idx] = i;
      }
      return i || undefined;
    }
    if (this.data) {
      const idx = this.data.interventions.findIndex(x => x.id === id);
      if (idx !== -1) { Object.assign(this.data.interventions[idx], updates); await this.save(); return this.data.interventions[idx]; }
    }
    return undefined;
  }

  async getBestPractices() {
    return this.data?.bestPractices || [];
  }

  async addBestPractice(bp: BestPractice) {
    if (this.mongoDb) await this.mongoDb.collection('bestPractices').insertOne(bp);
    if (this.data) this.data.bestPractices.push(bp);
    if (!this.mongoDb) await this.save();
    return bp;
  }

  async updateBestPractice(id: string, updates: Partial<BestPractice>) {
    if (this.mongoDb) {
      await this.mongoDb.collection('bestPractices').updateOne({ id }, { $set: updates });
      const bp = await this.mongoDb.collection<BestPractice>('bestPractices').findOne({ id });
      if (bp && this.data) {
        const idx = this.data.bestPractices.findIndex(x => x.id === id);
        if (idx !== -1) this.data.bestPractices[idx] = bp;
      }
      return bp || undefined;
    }
    if (this.data) {
      const idx = this.data.bestPractices.findIndex(x => x.id === id);
      if (idx !== -1) { Object.assign(this.data.bestPractices[idx], updates); await this.save(); return this.data.bestPractices[idx]; }
    }
    return undefined;
  }

  // --- Concept Mastery Profile Methods ---

  async getConceptMasteryProfile(studentId: string): Promise<ConceptMasteryProfile | null> {
    if (this.mongoDb) {
      const doc = await this.mongoDb.collection<ConceptMasteryProfile>('concept_mastery_profiles').findOne({ studentId });
      return doc || null;
    }
    return this.data?.conceptMasteryProfiles?.find(x => x.studentId === studentId) || null;
  }

  async upsertConceptMasteryProfile(profile: ConceptMasteryProfile): Promise<void> {
    if (this.mongoDb) {
      await this.mongoDb.collection('concept_mastery_profiles').updateOne(
        { studentId: profile.studentId },
        { $set: profile },
        { upsert: true }
      );
    }
    if (this.data) {
      const idx = this.data.conceptMasteryProfiles.findIndex(x => x.studentId === profile.studentId);
      if (idx !== -1) {
        this.data.conceptMasteryProfiles[idx] = profile;
      } else {
        this.data.conceptMasteryProfiles.push(profile);
      }
      if (!this.mongoDb) await this.save();
    }
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
      { id: 'u7', email: 'vol.rahul@fln.org', name: 'Punjab Volunteer (Rahul)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-vl-002'] },
      { id: 'u7_amit', email: 'vol.amit@fln.org', name: 'Amit Saini (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-vl-002', 'gps-jai-004'] },
      { id: 'u7_sneha', email: 'vol.up_sneha@fln.org', name: 'Sneha Verma (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-lko-005'] },
      { id: 'u7_vipin', email: 'vol.hr_vipin@fln.org', name: 'Haryana Volunteer (Vipin)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-amb-003'] },
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
      // Volunteers for new low-strength schools
      { id: 'u7_asr', email: 'vol.asr@fln.org', name: 'Mandeep Kaur (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-asr-007'] },
      { id: 'u7_jai2_vol', email: 'vol.jai2@fln.org', name: 'Deepak Sharma (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-jai2-009'] },
      { id: 'u7_knp_vol', email: 'vol.knp@fln.org', name: 'Anita Singh (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-knp-012'] },
      { id: 'u7_ldh2_vol', email: 'vol.ldh2@fln.org', name: 'Gurpreet Kaur (Volunteer)', role: UserRole.VOLUNTEER, assignedSchools: ['gps-pb-ldh2-013'] }
    ];

    // Give every seeded account the shared demo password as a bcrypt hash.
    users.forEach(u => { u.passwordHash = SEED_DEMO_PASSWORD_HASH; });

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
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-1122',
        levelHistory: [{ level: 3, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }],
        streak: 7
      },
      {
        id: 's4',
        name: 'Manpreet Lal',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-5566',
        levelHistory: [{ level: 1, date: '2026-05-15', reason: 'Volunteer Diagnostic Placement' }],
        streak: 1
      },
      {
        id: 's5',
        name: 'Harjeet Sandhu',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-8811',
        levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Volunteer Diagnostic Placement' }],
        streak: 2
      },
      {
        id: 's6',
        name: 'Sandeep Kumar',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-7231',
        levelHistory: [{ level: 2, date: '2026-06-01', reason: 'Onboarding Diagnostic Placement' }],
        streak: 4
      },
      {
        id: 's7',
        name: 'Sneha Sharma',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 5,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-1002',
        levelHistory: [{ level: 3, date: '2026-06-01', reason: 'Onboarding Diagnostic Placement' }],
        streak: 9
      },
      {
        id: 's8',
        name: 'Rajesh Saini',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-3490',
        levelHistory: [{ level: 2, date: '2026-06-01', reason: 'Onboarding Diagnostic Placement' }],
        streak: 3
      },
      {
        id: 's9',
        name: 'Priya Patel',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-1992',
        levelHistory: [{ level: 3, date: '2026-06-15', reason: 'Onboarding Diagnostic Placement' }],
        streak: 6
      },
      {
        id: 's10',
        name: 'Amit Kumar',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 5,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-8822',
        levelHistory: [{ level: 4, date: '2026-06-15', reason: 'Onboarding Diagnostic Placement' }],
        streak: 11
      },
      {
        id: 's11',
        name: 'Divya Gupta',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-3344',
        levelHistory: [{ level: 2, date: '2026-06-15', reason: 'Onboarding Diagnostic Placement' }],
        streak: 5
      },
      {
        id: 's12',
        name: 'Kabir Mehra',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-4545',
        levelHistory: [{ level: 1, date: '2026-06-05', reason: 'Volunteer Diagnostic Placement' }],
        streak: 2
      },
      {
        id: 's13',
        name: 'Jyoti Yadav',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-2121',
        levelHistory: [{ level: 1, date: '2026-06-05', reason: 'Volunteer Diagnostic Placement' }],
        streak: 3
      },
      {
        id: 's14',
        name: 'Rajiv Malhotra',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 3,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1155',
        levelHistory: [{ level: 2, date: '2026-06-20', reason: 'Onboarding Diagnostic Placement' }],
        streak: 6
      },
      {
        id: 's15',
        name: 'Neha Agrawal',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 4,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-2266',
        levelHistory: [{ level: 3, date: '2026-06-20', reason: 'Onboarding Diagnostic Placement' }],
        streak: 8
      },
      {
        id: 's16',
        name: 'Karan Johar',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 5,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-3377',
        levelHistory: [{ level: 4, date: '2026-06-20', reason: 'Onboarding Diagnostic Placement' }],
        streak: 12
      },
      // ── Unplaced students (empty levelHistory) for Pending Diagnostics ──
      {
        id: 's_new_1',
        name: 'Gurleen Kaur',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-6677',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_2',
        name: 'Vikram Yadav',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-7788',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_3',
        name: 'Ananya Mishra',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-8899',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_4',
        name: 'Rohit Sharma',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-9900',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_5',
        name: 'Meera Joshi',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1100',
        levelHistory: [],
        streak: 0
      },
      // ── Additional placed students at Level 8 ──
      {
        id: 's17',
        name: 'Arjun Mehta',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 8,
        currentSubLevel: 0,
        targetLevel: 9,
        aadharMasked: 'XXXX-XXXX-1201',
        levelHistory: [{ level: 4, date: '2026-04-15', reason: 'Onboarding Diagnostic Placement' }, { level: 6, date: '2026-05-20', reason: 'Mid-year worksheet performance' }, { level: 8, date: '2026-07-01', reason: 'End-of-year worksheet performance' }],
        streak: 15
      },
      {
        id: 's18',
        name: 'Kavya Reddy',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 8,
        currentSubLevel: 1,
        targetLevel: 9,
        aadharMasked: 'XXXX-XXXX-1202',
        levelHistory: [{ level: 3, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-10', reason: 'Baseline worksheet' }, { level: 8, date: '2026-07-03', reason: 'Mid-year worksheet' }],
        streak: 10
      },
      {
        id: 's19',
        name: 'Rohan Das',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 8,
        currentSubLevel: 2,
        targetLevel: 9,
        aadharMasked: 'XXXX-XXXX-1203',
        levelHistory: [{ level: 2, date: '2026-04-20', reason: 'Onboarding Diagnostic Placement' }, { level: 8, date: '2026-06-25', reason: 'Remedial intervention' }],
        streak: 6
      },
      // ── Students at Level 10 ──
      {
        id: 's20',
        name: 'Pooja Verma',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 10,
        currentSubLevel: 0,
        targetLevel: 11,
        aadharMasked: 'XXXX-XXXX-1204',
        levelHistory: [{ level: 5, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 7, date: '2026-05-15', reason: 'Baseline worksheet' }, { level: 10, date: '2026-06-30', reason: 'Mid-year worksheet' }],
        streak: 18
      },
      {
        id: 's21',
        name: 'Vivek Saxena',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 10,
        currentSubLevel: 0,
        targetLevel: 11,
        aadharMasked: 'XXXX-XXXX-1205',
        levelHistory: [{ level: 6, date: '2026-05-05', reason: 'Onboarding Diagnostic Placement' }, { level: 8, date: '2026-06-01', reason: 'Baseline worksheet' }, { level: 10, date: '2026-07-02', reason: 'Mid-year worksheet' }],
        streak: 14
      },
      // ── Students at Level 12 ──
      {
        id: 's22',
        name: 'Anika Gupta',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_a',
        currentLevel: 12,
        currentSubLevel: 0,
        targetLevel: 13,
        aadharMasked: 'XXXX-XXXX-1206',
        levelHistory: [{ level: 7, date: '2026-04-25', reason: 'Onboarding Diagnostic Placement' }, { level: 10, date: '2026-06-05', reason: 'Baseline worksheet' }, { level: 12, date: '2026-07-04', reason: 'Mid-year worksheet' }],
        streak: 20
      },
      {
        id: 's23',
        name: 'Ishaan Kapoor',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-uda-010',
        teacherId: 'u6_uda_b',
        currentLevel: 12,
        currentSubLevel: 0,
        targetLevel: 13,
        aadharMasked: 'XXXX-XXXX-1207',
        levelHistory: [{ level: 8, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 12, date: '2026-06-28', reason: 'Baseline worksheet' }],
        streak: 11
      },
      // ── Students at Level 15 ──
      {
        id: 's24',
        name: 'Tanvi Bhatia',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 15,
        currentSubLevel: 0,
        targetLevel: 16,
        aadharMasked: 'XXXX-XXXX-1208',
        levelHistory: [{ level: 8, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 11, date: '2026-05-20', reason: 'Baseline worksheet' }, { level: 15, date: '2026-07-01', reason: 'Mid-year worksheet' }],
        streak: 25
      },
      {
        id: 's25',
        name: 'Kabir Malhotra',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 15,
        currentSubLevel: 1,
        targetLevel: 16,
        aadharMasked: 'XXXX-XXXX-1209',
        levelHistory: [{ level: 10, date: '2026-05-15', reason: 'Onboarding Diagnostic Placement' }, { level: 15, date: '2026-07-02', reason: 'Baseline worksheet' }],
        streak: 8
      },
      // ── Students at various other levels ──
      {
        id: 's26',
        name: 'Naina Agarwal',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 5,
        currentSubLevel: 0,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-1210',
        levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-20', reason: 'Baseline worksheet' }],
        streak: 7
      },
      {
        id: 's27',
        name: 'Reyansh Singh',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-vl-002',
        currentLevel: 3,
        currentSubLevel: 0,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1211',
        levelHistory: [{ level: 1, date: '2026-05-15', reason: 'Volunteer Diagnostic Placement' }, { level: 3, date: '2026-06-25', reason: 'Baseline worksheet' }],
        streak: 4
      },
      {
        id: 's28',
        name: 'Myra Choudhary',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 6,
        currentSubLevel: 0,
        targetLevel: 7,
        aadharMasked: 'XXXX-XXXX-1212',
        levelHistory: [{ level: 2, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 4, date: '2026-06-05', reason: 'Baseline worksheet' }, { level: 6, date: '2026-07-01', reason: 'Mid-year worksheet' }],
        streak: 9
      },
      {
        id: 's29',
        name: 'Advik Nair',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-asr-007',
        teacherId: 'u6_asr',
        currentLevel: 4,
        currentSubLevel: 1,
        targetLevel: 5,
        aadharMasked: 'XXXX-XXXX-1213',
        levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Volunteer Diagnostic Placement' }, { level: 4, date: '2026-07-02', reason: 'Baseline worksheet' }],
        streak: 3
      },
      {
        id: 's30',
        name: 'Aadhya Iyer',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_a',
        currentLevel: 7,
        currentSubLevel: 0,
        targetLevel: 8,
        aadharMasked: 'XXXX-XXXX-1214',
        levelHistory: [{ level: 3, date: '2026-04-25', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-01', reason: 'Baseline worksheet' }, { level: 7, date: '2026-07-03', reason: 'Mid-year worksheet' }],
        streak: 12
      },
      {
        id: 's31',
        name: 'Vihaan Joshi',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 6,
        currentSubLevel: 2,
        targetLevel: 7,
        aadharMasked: 'XXXX-XXXX-1215',
        levelHistory: [{ level: 2, date: '2026-04-20', reason: 'Onboarding Diagnostic Placement' }, { level: 6, date: '2026-06-18', reason: 'Baseline worksheet' }],
        streak: 5
      },
      {
        id: 's32',
        name: 'Anvi Kaur',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 9,
        currentSubLevel: 0,
        targetLevel: 10,
        aadharMasked: 'XXXX-XXXX-1216',
        levelHistory: [{ level: 5, date: '2026-05-05', reason: 'Onboarding Diagnostic Placement' }, { level: 7, date: '2026-06-10', reason: 'Baseline worksheet' }, { level: 9, date: '2026-07-02', reason: 'Mid-year worksheet' }],
        streak: 13
      },
      {
        id: 's33',
        name: 'Shaurya Patel',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko2-011',
        teacherId: 'u6_lko2',
        currentLevel: 11,
        currentSubLevel: 0,
        targetLevel: 12,
        aadharMasked: 'XXXX-XXXX-1217',
        levelHistory: [{ level: 6, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 8, date: '2026-06-15', reason: 'Baseline worksheet' }, { level: 11, date: '2026-07-04', reason: 'Mid-year worksheet' }],
        streak: 16
      },
      {
        id: 's34',
        name: 'Krisha Sharma',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-hr-amb2-014',
        teacherId: 'u6_amb2',
        currentLevel: 7,
        currentSubLevel: 0,
        targetLevel: 8,
        aadharMasked: 'XXXX-XXXX-1218',
        levelHistory: [{ level: 3, date: '2026-05-20', reason: 'Onboarding Diagnostic Placement' }, { level: 7, date: '2026-07-01', reason: 'Baseline worksheet' }],
        streak: 8
      },
      {
        id: 's35',
        name: 'Dhruv Thakur',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 11,
        currentSubLevel: 1,
        targetLevel: 12,
        aadharMasked: 'XXXX-XXXX-1219',
        levelHistory: [{ level: 6, date: '2026-05-15', reason: 'Onboarding Diagnostic Placement' }, { level: 9, date: '2026-06-20', reason: 'Baseline worksheet' }, { level: 11, date: '2026-07-03', reason: 'Mid-year worksheet' }],
        streak: 9
      },
      {
        id: 's36',
        name: 'Aanya Gupta',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_b',
        currentLevel: 13,
        currentSubLevel: 0,
        targetLevel: 14,
        aadharMasked: 'XXXX-XXXX-1220',
        levelHistory: [{ level: 8, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 11, date: '2026-06-10', reason: 'Baseline worksheet' }, { level: 13, date: '2026-07-02', reason: 'Mid-year worksheet' }],
        streak: 17
      },
      {
        id: 's37',
        name: 'Arush Bhat',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-uda-010',
        teacherId: 'u6_uda_a',
        currentLevel: 14,
        currentSubLevel: 0,
        targetLevel: 15,
        aadharMasked: 'XXXX-XXXX-1221',
        levelHistory: [{ level: 9, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 12, date: '2026-06-20', reason: 'Baseline worksheet' }, { level: 14, date: '2026-07-04', reason: 'Mid-year worksheet' }],
        streak: 19
      },
      {
        id: 's38',
        name: 'Sara Khan',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_b',
        currentLevel: 9,
        currentSubLevel: 2,
        targetLevel: 10,
        aadharMasked: 'XXXX-XXXX-1222',
        levelHistory: [{ level: 4, date: '2026-04-25', reason: 'Onboarding Diagnostic Placement' }, { level: 9, date: '2026-06-28', reason: 'Baseline worksheet' }],
        streak: 7
      },
      {
        id: 's39',
        name: 'Yuvan Reddy',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 6,
        currentSubLevel: 0,
        targetLevel: 7,
        aadharMasked: 'XXXX-XXXX-1223',
        levelHistory: [{ level: 2, date: '2026-04-10', reason: 'Onboarding Diagnostic Placement' }, { level: 4, date: '2026-05-25', reason: 'Baseline worksheet' }, { level: 6, date: '2026-07-01', reason: 'Mid-year worksheet' }],
        streak: 11
      },
      // ── Students in Bathinda (lagging district) ──
      {
        id: 's40',
        name: 'Simranjit Kaur',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 2,
        currentSubLevel: 2,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-1224',
        levelHistory: [{ level: 1, date: '2026-05-01', reason: 'Onboarding Diagnostic Placement' }, { level: 2, date: '2026-06-20', reason: 'Baseline worksheet' }],
        streak: 2
      },
      {
        id: 's41',
        name: 'Gurleen Kaur Bajwa',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_a',
        currentLevel: 1,
        currentSubLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1225',
        levelHistory: [{ level: 1, date: '2026-06-01', reason: 'Volunteer Diagnostic Placement' }],
        streak: 1
      },
      {
        id: 's42',
        name: 'Mandeep Singh',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-bth-006',
        teacherId: 'u6_bth_b',
        currentLevel: 3,
        currentSubLevel: 0,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1226',
        levelHistory: [{ level: 1, date: '2026-05-10', reason: 'Onboarding Diagnostic Placement' }, { level: 3, date: '2026-06-25', reason: 'Baseline worksheet' }],
        streak: 4
      },
      // ── Students in Amritsar (low-strength school) ──
      {
        id: 's43',
        name: 'Navjot Singh',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-asr-007',
        teacherId: 'u6_asr',
        currentLevel: 1,
        currentSubLevel: 0,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1227',
        levelHistory: [{ level: 1, date: '2026-06-10', reason: 'Volunteer Diagnostic Placement' }],
        streak: 1
      },
      {
        id: 's44',
        name: 'Harleen Kaur',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-asr-007',
        teacherId: 'u6_asr',
        currentLevel: 2,
        currentSubLevel: 0,
        targetLevel: 3,
        aadharMasked: 'XXXX-XXXX-1228',
        levelHistory: [{ level: 1, date: '2026-06-10', reason: 'Volunteer Diagnostic Placement' }, { level: 2, date: '2026-07-01', reason: 'Baseline worksheet' }],
        streak: 2
      },
      // ── Students in Jaipur Rural North ──
      {
        id: 's45',
        name: 'Lakshya Sharma',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-jai2-009',
        teacherId: 'u6_jai2',
        currentLevel: 5,
        currentSubLevel: 0,
        targetLevel: 6,
        aadharMasked: 'XXXX-XXXX-1229',
        levelHistory: [{ level: 2, date: '2026-05-15', reason: 'Onboarding Diagnostic Placement' }, { level: 5, date: '2026-06-28', reason: 'Baseline worksheet' }],
        streak: 6
      },
      {
        id: 's46',
        name: 'Ritu Yadav',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-jai2-009',
        teacherId: 'u6_jai2',
        currentLevel: 3,
        currentSubLevel: 1,
        targetLevel: 4,
        aadharMasked: 'XXXX-XXXX-1230',
        levelHistory: [{ level: 1, date: '2026-05-20', reason: 'Volunteer Diagnostic Placement' }, { level: 3, date: '2026-07-01', reason: 'Baseline worksheet' }],
        streak: 3
      },
      // ── Unplaced students needing diagnostics ──
      {
        id: 's_new_6',
        name: 'Krishna Murari',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-mt-001',
        teacherId: 'u6',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1231',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_7',
        name: 'Shivani Gupta',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-pkl-008',
        teacherId: 'u6_pkl_a',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1232',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_8',
        name: 'Ravi Prakash',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko2-011',
        teacherId: 'u6_lko2',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1233',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_9',
        name: 'Pooja Kumari',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-uda-010',
        teacherId: 'u6_uda_a',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1234',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_10',
        name: 'Amit Verma',
        age: 7,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-knp-012',
        teacherId: 'u6_knp',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1235',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_11',
        name: 'Priyanka Das',
        age: 8,
        classGroup: 'Class 2',
        section: 'A',
        schoolId: 'gps-pb-ldh2-013',
        teacherId: 'u6_ldh2',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1236',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_12',
        name: 'Arjun Yadav',
        age: 8,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-hr-amb2-014',
        teacherId: 'u6_amb2',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1237',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_13',
        name: 'Sana Sheikh',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        teacherId: 'u6_lko',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1238',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_14',
        name: 'Rohini Patil',
        age: 9,
        classGroup: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        teacherId: 'u6_amb',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1239',
        levelHistory: [],
        streak: 0
      },
      {
        id: 's_new_15',
        name: 'Farhan Ali',
        age: 10,
        classGroup: 'Class 4',
        section: 'A',
        schoolId: 'gps-jai-004',
        teacherId: 'u6_jai',
        currentLevel: 1,
        targetLevel: 2,
        aadharMasked: 'XXXX-XXXX-1240',
        levelHistory: [],
        streak: 0
      }
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
        classId: 'c4',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-amb-003',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-amb-003.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-06-18',
        questions: [
          { ...seedQuestions[4], question_id: 's6_L3_Q1', question: '[For Sandeep Kumar - Level 3] If a pencil is 8cm...' },
          { ...seedQuestions[3], question_id: 's8_L2_Q2', question: '[For Rajesh Saini - Level 2] Complete pattern: Red...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-amb-003.t01@fln.org',
          timestamp: '2026-06-18T09:00:00Z'
        },
        timing: {
          examDate: '2026-06-18',
          printWindowStart: '2026-06-18T09:00:00Z',
          printWindowEnd: '2026-06-18T10:00:00Z',
          examWindowStart: '2026-06-18T10:00:00Z',
          examWindowEnd: '2026-06-18T10:45:00Z',
          submissionWindowEnd: '2026-06-18T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1003',
        classId: 'c2',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-mt-001.t01@fln.org',
        cycle: 'Mid-year',
        date: '2026-07-02',
        questions: [
          { ...seedQuestions[4], question_id: 's3_L3_Q1', question: '[For Gurpreet Singh - Level 4] Pencil centimeter subtraction...' }
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
        id: 'WS_1004',
        classId: 'c6',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-lko-005',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-lko-005.t01@fln.org',
        cycle: 'Baseline',
        date: '2026-06-22',
        questions: [
          { ...seedQuestions[4], question_id: 's14_L3_Q1', question: '[For Rajiv Malhotra - Level 3] Count matching pattern steps...' },
          { ...seedQuestions[3], question_id: 's15_L2_Q2', question: '[For Neha Agrawal - Level 2] Deduce the missing pattern...' }
        ],
        locks: {
          locked: true,
          lockedByRole: UserRole.TEACHER,
          lockedByEmail: 'gps-lko-005.t01@fln.org',
          timestamp: '2026-06-22T09:00:00Z'
        },
        timing: {
          examDate: '2026-06-22',
          printWindowStart: '2026-06-22T09:00:00Z',
          printWindowEnd: '2026-06-22T10:00:00Z',
          examWindowStart: '2026-06-22T10:00:00Z',
          examWindowEnd: '2026-06-22T10:45:00Z',
          submissionWindowEnd: '2026-06-22T11:45:00Z'
        },
        delayLogs: {
          delayedAttemptsCount: 0,
          submittingTeachers: []
        }
      },
      {
        id: 'WS_1005',
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
        id: 'WS_1006',
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
        id: 'WS_1007',
        classId: 'c2',
        className: 'Class 3',
        section: 'A',
        schoolId: 'gps-mt-001',
        generatedByRole: UserRole.TEACHER,
        generatedByEmail: 'gps-mt-001.t01@fln.org',
        cycle: 'Mid-year',
        date: '2026-07-02',
        questions: [
          { ...seedQuestions[5], question_id: 's20_L4_Q1', question: '[For Pooja Verma - Level 10] Fraction pizza...' },
          { ...seedQuestions[6], question_id: 's24_L4_Q2', question: '[For Tanvi Bhatia - Level 15] Money change...' }
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
        id: 'sub_s6_1002',
        worksheetId: 'WS_1002',
        studentId: 's6',
        studentName: 'Sandeep Kumar',
        schoolId: 'gps-amb-003',
        classId: 'c4',
        submittedAt: '2026-06-18T11:30:00Z',
        isDelayed: false,
        answers: { 's6_L3_Q1': '5' }
      },
      {
        id: 'sub_s14_1004',
        worksheetId: 'WS_1004',
        studentId: 's14',
        studentName: 'Rajiv Malhotra',
        schoolId: 'gps-lko-005',
        classId: 'c6',
        submittedAt: '2026-06-22T11:20:00Z',
        isDelayed: false,
        answers: { 's14_L3_Q1': '8' }
      },
      {
        id: 'sub_s18_1005',
        worksheetId: 'WS_1005',
        studentId: 's18',
        studentName: 'Kavya Reddy',
        schoolId: 'gps-bth-006',
        classId: 'c7',
        submittedAt: '2026-07-01T11:05:00Z',
        isDelayed: false,
        answers: { 's18_L1_Q1': '5', 's40_L3_Q1': '5', 's28_L4_Q1': '35' }
      },
      {
        id: 'sub_s22_1006',
        worksheetId: 'WS_1006',
        studentId: 's22',
        studentName: 'Anika Gupta',
        schoolId: 'gps-pkl-008',
        classId: 'c10',
        submittedAt: '2026-07-03T11:20:00Z',
        isDelayed: false,
        answers: { 's22_L2_Q2': 'Blue Circle', 's30_L5_Q1': '60' }
      },
      {
        id: 'sub_s20_1007',
        worksheetId: 'WS_1007',
        studentId: 's20',
        studentName: 'Pooja Verma',
        schoolId: 'gps-mt-001',
        classId: 'c2',
        submittedAt: '2026-07-02T11:15:00Z',
        isDelayed: false,
        answers: { 's20_L4_Q1': '3/4', 's24_L4_Q2': '35' }
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
        id: 'rep_s6_1002',
        studentId: 's6',
        worksheetId: 'WS_1002',
        score: 100,
        totalQuestions: 1,
        conceptMastery: { 'Measurement': 'Strong' },
        narrative: 'Sandeep exhibits strong capacity to compute lengths and carry out simple subtraction comparisons.',
        recommendedLevel: 3,
        timestamp: '2026-06-18T11:35:00Z'
      },
      {
        id: 'rep_s14_1004',
        studentId: 's14',
        worksheetId: 'WS_1004',
        score: 100,
        totalQuestions: 1,
        conceptMastery: { 'Patterns': 'Strong' },
        narrative: 'Rajiv displays flawless sequencing and pattern recognition matching Level 3 descriptors.',
        recommendedLevel: 3,
        timestamp: '2026-06-22T11:30:00Z'
      },
      {
        id: 'rep_s18_1005',
        studentId: 's18',
        worksheetId: 'WS_1005',
        score: 67,
        totalQuestions: 3,
        conceptMastery: { 'Number Sense': 'Strong', 'Measurement': 'Strong', 'Money': 'Needs Practice' },
        narrative: 'Kavya shows strength in counting and measurement but needs more practice with money transactions.',
        recommendedLevel: 8,
        timestamp: '2026-07-01T11:15:00Z'
      },
      {
        id: 'rep_s22_1006',
        studentId: 's22',
        worksheetId: 'WS_1006',
        score: 100,
        totalQuestions: 2,
        conceptMastery: { 'Patterns': 'Strong', 'Number Operations': 'Strong' },
        narrative: 'Anika demonstrated flawless pattern recognition and multiplication skills.',
        recommendedLevel: 12,
        timestamp: '2026-07-03T11:25:00Z'
      },
      {
        id: 'rep_s20_1007',
        studentId: 's20',
        worksheetId: 'WS_1007',
        score: 100,
        totalQuestions: 2,
        conceptMastery: { 'Fractions': 'Strong', 'Money': 'Strong' },
        narrative: 'Pooja displays strong conceptual understanding of fractions and monetary calculations.',
        recommendedLevel: 10,
        timestamp: '2026-07-02T11:20:00Z'
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
        timestamp: '2026-07-02T09:45:00Z',
        schoolId: 'gps-jai-004',
        schoolName: 'GPS Govind Dev Jaipur',
        userId: 'u6_jai',
        userEmail: 'gps-jai-004.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'conduct',
        status: 'Success',
        details: 'Completed diagnostic mathematical evaluation of Priya Patel'
      },
      {
        id: 'log5',
        timestamp: '2026-07-01T15:20:00Z',
        schoolId: 'gps-vl-002',
        schoolName: 'GPS Rural Village Moga',
        userId: 'u7_amit',
        userEmail: 'vol.amit@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'scan',
        status: 'Success',
        details: 'Scanned baseline arithmetic worksheet for student Kabir Mehra'
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
        details: 'Evaluated personalized worksheet patterns for student Rajiv Malhotra'
      },
      {
        id: 'log7',
        timestamp: '2026-07-03T10:15:00Z',
        schoolId: 'gps-lko-005',
        schoolName: 'GPS Hazratganj Lucknow',
        userId: 'u7_sneha',
        userEmail: 'vol.up_sneha@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'verify',
        status: 'Success',
        details: 'Onboarded and validated Aadhar details for student Neha Agrawal'
      },
      {
        id: 'log8',
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
        id: 'log9',
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
        id: 'log10',
        timestamp: '2026-07-06T08:15:00Z',
        schoolId: 'gps-asr-007',
        schoolName: 'GPS Amritsar Golden',
        userId: 'u7_asr',
        userEmail: 'vol.asr@fln.org',
        userRole: UserRole.VOLUNTEER,
        activityType: 'verify',
        status: 'Success',
        details: 'Onboarded new students Navjot Singh and Harleen Kaur at Amritsar low-strength school'
      },
      {
        id: 'log11',
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
      },
      {
        id: 'log13',
        timestamp: '2026-07-06T14:00:00Z',
        schoolId: 'gps-uda-010',
        schoolName: 'GPS Udaipur City',
        userId: 'u6_uda_a',
        userEmail: 'gps-uda-010.t01@fln.org',
        userRole: UserRole.TEACHER,
        activityType: 'print',
        status: 'Success',
        details: 'Printed personalized worksheets for Class 4 students Arush Bhat and others'
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
        userId: 'u6_amb',
        userEmail: 'gps-amb-003.t01@fln.org',
        userName: 'Meena Kumari',
        userRole: UserRole.TEACHER,
        type: 'curriculum',
        subject: 'Measurement Level 3 cuts question difficulty',
        description: 'The pencil cutting subtraction is highly appropriate but students need concrete centimeter rulers to visualize better. Can we suggest visual graphics?',
        status: 'Reviewed',
        createdAt: '2026-07-03T14:00:00Z'
      },
      {
        id: 'tkt3',
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
        id: 'tkt4',
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
        id: 'tkt5',
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

    const interventions: Intervention[] = [
      {
        id: 'int1',
        studentId: 's2',
        studentName: 'Jasmine Kaur',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        classId: 'c1',
        className: 'Class 2',
        section: 'A',
        weakCompetencies: ['Shapes', 'Patterns'],
        currentLevel: 8,
        strategyType: 'visual_aids',
        strategyDescription: 'Used flashcards with shape outlines and colour-coded pattern strips. Practised daily for 15 minutes during morning assembly. Jasmine responded well to colour-based matching exercises.',
        duration: '2 weeks',
        startDate: '2026-06-15',
        endDate: '2026-06-29',
        status: 'completed',
        outcome: {
          improved: true,
          previousLevel: 8,
          newLevel: 10,
          improvementDetails: 'Jasmine improved from Level 8 to Level 10. Shapes recognition went from Needs Practice to Satisfactory. Pattern completion improved significantly.',
          assessmentId: 'ws_mid_001',
          detectedAt: '2026-07-02T10:00:00Z'
        },
        isPromoted: true,
        promotedAt: '2026-07-03T08:00:00Z',
        createdAt: '2026-06-15T09:00:00Z'
      },
      {
        id: 'int2',
        studentId: 's5',
        studentName: 'Arjun Verma',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        classId: 'c1',
        className: 'Class 2',
        section: 'A',
        weakCompetencies: ['Subtraction', 'Number Sense'],
        currentLevel: 6,
        strategyType: 'manipulatives',
        strategyDescription: 'Used physical counting beads and number blocks for hands-on subtraction practice. Grouped Arjun with two peers for peer learning during math station time.',
        duration: '3 weeks',
        startDate: '2026-06-10',
        status: 'active',
        isPromoted: false,
        createdAt: '2026-06-10T09:00:00Z'
      },
      {
        id: 'int3',
        studentId: 's19',
        studentName: 'Rohan Das',
        teacherId: 'u6_amb',
        teacherName: 'Meena Kumari',
        schoolId: 'gps-amb-003',
        classId: 'c5',
        className: 'Class 3',
        section: 'A',
        weakCompetencies: ['Number Operations', 'Multiplication'],
        currentLevel: 8,
        strategyType: 'game_based',
        strategyDescription: 'Introduced multiplication table songs and number-line hop games. Used a dice-based addition game during break time to reinforce basic operations. Rohan showed high engagement with game-based activities.',
        duration: '2 weeks',
        startDate: '2026-06-20',
        endDate: '2026-07-04',
        status: 'completed',
        outcome: {
          improved: true,
          previousLevel: 8,
          newLevel: 12,
          improvementDetails: 'Rohan jumped from Level 8 to Level 12 (two full levels). Multiplication tables 2-5 mastered. Addition speed improved by 40%.',
          assessmentId: 'ws_mid_003',
          detectedAt: '2026-07-05T10:00:00Z'
        },
        isPromoted: false,
        createdAt: '2026-06-20T09:00:00Z'
      },
      {
        id: 'int4',
        studentId: 's7',
        studentName: 'Simran Kaur',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        classId: 'c3',
        className: 'Class 1',
        section: 'A',
        weakCompetencies: ['Number Sense', 'Counting'],
        currentLevel: 4,
        strategyType: 'one_on_one',
        strategyDescription: 'Conducted daily one-on-one counting sessions using real objects (pencils, erasers). Practised number tracing on sandpaper numbers. Focused on building confidence before introducing new concepts.',
        duration: '1 month',
        startDate: '2026-06-01',
        status: 'active',
        isPromoted: false,
        createdAt: '2026-06-01T09:00:00Z'
      }
    ];

    const bestPractices: BestPractice[] = [
      {
        id: 'bp1',
        interventionId: 'int1',
        teacherId: 'u5',
        teacherName: 'Ritu Sharma',
        schoolId: 'gps-mt-001',
        weakCompetencies: ['Shapes', 'Patterns'],
        strategyType: 'visual_aids',
        strategyDescription: 'Used flashcards with shape outlines and colour-coded pattern strips. Practised daily for 15 minutes during morning assembly. Responded well to colour-based matching exercises.',
        levelBefore: 8,
        levelAfter: 10,
        levelJump: 2,
        duration: '2 weeks',
        tags: ['Shapes', 'Patterns', 'Visual Learning', 'Preschool 3', 'Class 1', 'Quick Win'],
        viewCount: 12,
        createdAt: '2026-07-03T08:00:00Z'
      }
    ];

    return {
      users,
      schools,
      classes,
      students,
      questions: seedQuestions,
      worksheets,
      levelWorksheets: [],
      answerSubmissions,
      evaluationReports,
      tickets,
      logbook,
      announcements,
      interventions,
      bestPractices,
      conceptMasteryProfiles: []
    };
  }
}

export const dbStore = new DBStore();
