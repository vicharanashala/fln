import mongoose, { Schema, Document } from 'mongoose';

export interface ILevelHistoryEntry {
  level: number;
  subLevel?: number;
  date: string;
  reason: string;
}

export interface IStudent extends Document {
  name: string;
  age: number;
  classGroup: string;
  section: string;
  schoolId: mongoose.Types.ObjectId;
  teacherId?: mongoose.Types.ObjectId;
  currentLevel: number;
  currentSubLevel?: number;
  targetLevel: number;
  aadharMasked: string;
  levelHistory: ILevelHistoryEntry[];
  streak: number;
}

const LevelHistoryEntrySchema = new Schema<ILevelHistoryEntry>(
  {
    level: { type: Number, required: true },
    subLevel: Number,
    date: { type: String, required: true },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const StudentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 3, max: 16 },
    classGroup: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    currentLevel: { type: Number, required: true, default: 1, min: 1 },
    currentSubLevel: { type: Number, default: 0, min: 0 },
    targetLevel: { type: Number, required: true, default: 2 },
    aadharMasked: { type: String, required: true },
    levelHistory: [LevelHistoryEntrySchema],
    streak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

StudentSchema.index({ schoolId: 1, classGroup: 1, section: 1 });
StudentSchema.index({ teacherId: 1 });
StudentSchema.index({ aadharMasked: 1 }, { unique: true });

export const Student = mongoose.model<IStudent>('Student', StudentSchema);
