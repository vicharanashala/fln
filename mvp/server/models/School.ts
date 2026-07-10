import mongoose, { Schema, Document } from 'mongoose';

export interface ISchool extends Document {
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: 'high' | 'low';
  teachersCount: number;
  isAccessLocked?: boolean;
}

const SchoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, uppercase: true, trim: true },
    districtCode: { type: String, required: true, uppercase: true, trim: true },
    blockCode: { type: String, required: true, uppercase: true, trim: true },
    strength: { type: String, enum: ['high', 'low'], required: true },
    teachersCount: { type: Number, default: 0 },
    isAccessLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SchoolSchema.index({ stateCode: 1, districtCode: 1, blockCode: 1 });
SchoolSchema.index({ name: 1 });

export const School = mongoose.model<ISchool>('School', SchoolSchema);
