import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { AssessmentCycle, AnswerType, Difficulty } from '../../shared/enums.js';
import { basePlugin } from '../../shared/basePlugin.js';

/** A single question embedded in a worksheet/test (mirrors SRS §12 Exam JSON). */
const questionSchema = new Schema(
  {
    questionId: { type: String, required: true }, // Q1, Q2, ...
    prompt: { type: String, required: true },
    answer: { type: String, required: true }, // answer key (never exposed to students)
    answerType: { type: String, enum: AnswerType, default: 'number' },
    choices: { type: [String], default: undefined },
    topic: { type: String, required: true },
    subtopic: { type: String },
    difficulty: { type: String, enum: Difficulty, default: 'medium' },
    sourceLevel: { type: Number, required: true }, // curriculum level probed
  },
  { _id: false }
);

/**
 * A generated test/worksheet for one student. For the MVP this is the Baseline
 * assessment; the `cycle` field leaves room for Mid/End-year reuse.
 */
const worksheetSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    schoolId: { type: String, required: true },
    classGrade: { type: Number, required: true },
    cycle: { type: String, enum: Object.values(AssessmentCycle), default: AssessmentCycle.BASELINE },
    coversClass: { type: Number, required: true },
    questions: { type: [questionSchema], required: true },
    status: { type: String, enum: ['generated', 'evaluated'], default: 'generated' },
  },
  { timestamps: true }
);

worksheetSchema.plugin(basePlugin);

export type QuestionType = InferSchemaType<typeof questionSchema>;
export type WorksheetDoc = HydratedDocument<InferSchemaType<typeof worksheetSchema>>;
export const Worksheet = model('Worksheet', worksheetSchema);
