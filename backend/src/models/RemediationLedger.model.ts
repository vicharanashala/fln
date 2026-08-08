import { Schema, model } from 'mongoose';
import { IRemediationLedgerDocument } from '../interfaces/remediationLedger.interface';

const subQuestionSchema = new Schema(
  {
    prompt: { type: String, required: true },
    answer: { type: String, default: '' }
  },
  { _id: false }
);

const generatedPracticeQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, default: '' },
    options: [{ type: String }],
    subQuestions: [subQuestionSchema],
    generatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const remediationResponseSchema = new Schema(
  {
    questionNumber: { type: Number, required: true },
    conceptName: { type: String, required: true },
    type: { type: String, required: true, enum: ['numeric', 'matrix', 'generative'] },
    originalQuestion: { type: String, required: true },
    originalAnswer: { type: String, required: true },
    studentAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    practiceQuestions: [generatedPracticeQuestionSchema],
  },
  { _id: false }
);

const remediationLedgerSchema = new Schema<IRemediationLedgerDocument>(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    examId: { type: String, required: true, index: true },
    worksheetId: { type: String, required: true, index: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    remediationStatus: {
      type: String,
      required: true,
      enum: ['pending', 'generating', 'completed', 'failed', 'not_needed'],
      default: 'pending',
    },
    responses: [remediationResponseSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = (ret.id || ret._id).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

remediationLedgerSchema.index({ studentId: 1, examId: 1 }, { unique: true });

export const RemediationLedger = model<IRemediationLedgerDocument>('RemediationLedger', remediationLedgerSchema);
