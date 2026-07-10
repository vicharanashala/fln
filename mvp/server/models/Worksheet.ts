import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion {
  question_id: string;
  question: string;
  answer: string;
  answer_type: 'text' | 'number' | 'choice';
  choices?: string[];
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_level: number;
  svgAsset?: string;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    question_id: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    answer_type: { type: String, enum: ['text', 'number', 'choice'], required: true },
    choices: [String],
    topic: { type: String, required: true },
    subtopic: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    source_level: { type: Number, required: true },
    svgAsset: String,
  },
  { _id: false }
);

export interface ILock {
  locked: boolean;
  lockedByRole: 'superadmin' | 'teacher' | null;
  lockedByEmail: string | null;
  timestamp: string | null;
}

export interface ITiming {
  examDate: string;
  printWindowStart: string;
  printWindowEnd: string;
  examWindowStart: string;
  examWindowEnd: string;
  submissionWindowEnd: string;
}

export interface IDelayLog {
  delayedAttemptsCount: number;
  submittingTeachers: string[];
}

export interface IWorksheet extends Document {
  classId: mongoose.Types.ObjectId;
  className: string;
  section: string;
  schoolId: mongoose.Types.ObjectId;
  generatedByRole: 'superadmin' | 'teacher';
  generatedByEmail: string;
  cycle: 'Baseline' | 'Mid-year' | 'End-of-year';
  date: string;
  questions: IQuestion[];
  printed: boolean;
  locks: ILock;
  timing: ITiming;
  delayLogs: IDelayLog;
}

const LockSchema = new Schema<ILock>(
  {
    locked: { type: Boolean, required: true, default: false },
    lockedByRole: { type: String, enum: ['superadmin', 'teacher', null], default: null },
    lockedByEmail: { type: String, default: null },
    timestamp: { type: String, default: null },
  },
  { _id: false }
);

const TimingSchema = new Schema<ITiming>(
  {
    examDate: { type: String, required: true },
    printWindowStart: { type: String, required: true },
    printWindowEnd: { type: String, required: true },
    examWindowStart: { type: String, required: true },
    examWindowEnd: { type: String, required: true },
    submissionWindowEnd: { type: String, required: true },
  },
  { _id: false }
);

const DelayLogSchema = new Schema<IDelayLog>(
  {
    delayedAttemptsCount: { type: Number, default: 0 },
    submittingTeachers: [String],
  },
  { _id: false }
);

const WorksheetSchema = new Schema<IWorksheet>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    section: { type: String, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    generatedByRole: { type: String, enum: ['superadmin', 'teacher'], required: true },
    generatedByEmail: { type: String, required: true },
    cycle: { type: String, enum: ['Baseline', 'Mid-year', 'End-of-year'], required: true },
    date: { type: String, required: true },
    questions: [QuestionSchema],
    printed: { type: Boolean, default: false },
    locks: { type: LockSchema, required: true },
    timing: { type: TimingSchema, required: true },
    delayLogs: { type: DelayLogSchema, required: true },
  },
  { timestamps: true }
);

WorksheetSchema.index({ schoolId: 1, cycle: 1 });
WorksheetSchema.index({ classId: 1 });
WorksheetSchema.index({ generatedByEmail: 1 });
WorksheetSchema.index({ printed: 1 });

export const Worksheet = mongoose.model<IWorksheet>('Worksheet', WorksheetSchema);
