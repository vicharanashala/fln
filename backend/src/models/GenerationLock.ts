import mongoose, { Schema, Document } from 'mongoose';

export interface IGenerationLock extends Document {
  assessmentId: string;
  schoolId: string;
  locked: boolean;
  lockedBy: {
    userId: string;
    role: string;
  };
  generatedPaperId: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GenerationLockSchema = new Schema<IGenerationLock>(
  {
    assessmentId: { type: String, required: true },
    schoolId: { type: String, required: true },
    locked: { type: Boolean, default: true },
    lockedBy: {
      userId: { type: String, required: true },
      role: { type: String, required: true },
    },
    generatedPaperId: { type: String },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

GenerationLockSchema.index({ assessmentId: 1, schoolId: 1 }, { unique: true });

if (!mongoose.models.GenerationLock) {
  mongoose.model<IGenerationLock>('GenerationLock', GenerationLockSchema);
}
export const GenerationLock = mongoose.model<IGenerationLock>('GenerationLock');
