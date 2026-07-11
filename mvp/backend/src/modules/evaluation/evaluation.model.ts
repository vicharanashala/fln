import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { basePlugin } from '../../shared/basePlugin.js';

const breakdownSchema = new Schema(
  {
    questionId: { type: String, required: true },
    topic: { type: String, required: true },
    sourceLevel: { type: Number, required: true },
    expected: { type: String, required: true },
    submitted: { type: String, default: '' },
    correct: { type: Boolean, required: true },
  },
  { _id: false }
);

/** Result of evaluating a student's baseline answers + assigned FLN level. */
const evaluationSchema = new Schema(
  {
    worksheetId: { type: Schema.Types.ObjectId, ref: 'Worksheet', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    totalQuestions: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    scorePercent: { type: Number, required: true },
    breakdown: { type: [breakdownSchema], default: [] },
    assignedLevel: { type: Number, required: true },
    assignedLevelName: { type: String, required: true },
    narrative: { type: String, required: true },
  },
  { timestamps: true }
);

evaluationSchema.plugin(basePlugin);

export type EvaluationDoc = HydratedDocument<InferSchemaType<typeof evaluationSchema>>;
export const EvaluationReport = model('EvaluationReport', evaluationSchema);
