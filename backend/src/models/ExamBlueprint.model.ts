import { Schema, model } from 'mongoose';
import { IExamBlueprintDocument } from '../interfaces/examBlueprint.interface';

const questionBlueprintSchema = new Schema(
  {
    questionNum: { type: Number, required: true },
    concept: { type: String, required: true },
    explanation: { type: String },
    type: { type: String, required: true, enum: ['NUMERIC', 'MATRIX', 'GENERATIVE'] },
    templateText: { type: String, required: true },
    variableConstraints: { type: Schema.Types.Mixed },
    matrixArrays: { type: Schema.Types.Mixed },
    promptTemplate: { type: String }
  },
  { _id: false }
);

const examBlueprintSchema = new Schema<IExamBlueprintDocument>(
  {
    id: { type: String, required: true, unique: true },
    examId: { type: String, required: true, index: true, unique: true },
    examName: { type: String, required: true },
    questions: [questionBlueprintSchema]
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = (ret.id || ret._id).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const ExamBlueprint = model<IExamBlueprintDocument>('ExamBlueprint', examBlueprintSchema);
