import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswerSubmission extends Document {
  worksheetId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  schoolId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  submittedAt: string;
  isDelayed: boolean;
  answers: Map<string, string>;
}

const AnswerSubmissionSchema = new Schema<IAnswerSubmission>(
  {
    worksheetId: { type: Schema.Types.ObjectId, ref: 'Worksheet', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    studentName: { type: String, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    submittedAt: { type: String, required: true },
    isDelayed: { type: Boolean, default: false },
    answers: { type: Map, of: String, required: true },
  },
  { timestamps: true }
);

AnswerSubmissionSchema.index({ worksheetId: 1, studentId: 1 }, { unique: true });

export const AnswerSubmission = mongoose.model<IAnswerSubmission>('AnswerSubmission', AnswerSubmissionSchema);
