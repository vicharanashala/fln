import mongoose, { Schema, Document } from 'mongoose';

export interface IEvaluationReport extends Document {
  studentId: mongoose.Types.ObjectId;
  worksheetId: mongoose.Types.ObjectId;
  score: number;
  totalQuestions: number;
  conceptMastery: Map<string, 'Strong' | 'Needs Practice' | 'Satisfactory'>;
  narrative: string;
  recommendedLevel: number;
  recommendedSubLevel?: number;
  timestamp: string;
}

const EvaluationReportSchema = new Schema<IEvaluationReport>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    worksheetId: { type: Schema.Types.ObjectId, ref: 'Worksheet', required: true, index: true },
    score: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 0 },
    conceptMastery: {
      type: Map,
      of: { type: String, enum: ['Strong', 'Needs Practice', 'Satisfactory'] },
      required: true,
    },
    narrative: { type: String, required: true },
    recommendedLevel: { type: Number, required: true },
    recommendedSubLevel: { type: Number, default: 0 },
    timestamp: { type: String, required: true },
  },
  { timestamps: true }
);

EvaluationReportSchema.index({ studentId: 1, worksheetId: 1 }, { unique: true });

export const EvaluationReport = mongoose.model<IEvaluationReport>('EvaluationReport', EvaluationReportSchema);
