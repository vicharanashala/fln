import mongoose, { Schema, Document } from 'mongoose';

export interface IClass extends Document {
  schoolId: mongoose.Types.ObjectId;
  className: string;
  section: string;
  teacherId: mongoose.Types.ObjectId;
}

const ClassSchema = new Schema<IClass>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    className: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

ClassSchema.index({ schoolId: 1, className: 1, section: 1 }, { unique: true });
ClassSchema.index({ teacherId: 1 });

export const Class = mongoose.model<IClass>('Class', ClassSchema);
