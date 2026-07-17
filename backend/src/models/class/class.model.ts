import { Schema, model } from 'mongoose';
import { IClassDocument } from '../../interfaces/class/class.interface';

const classSchema = new Schema<IClassDocument>(
  {
    classCode: {
      type: String,
      unique: true,
      required: [true, 'Class code is required'],
      trim: true,
    },
    className: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      maxlength: [50, 'Class name cannot exceed 50 characters'],
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      maxlength: [10, 'Section cannot exceed 10 characters'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    maximumStudents: {
      type: Number,
      required: [true, 'Maximum students is required'],
      min: [1, 'Maximum students must be at least 1'],
    },
    currentStudents: {
      type: Number,
      default: 0,
      min: [0, 'Current students cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

classSchema.index({ teacherId: 1, isActive: 1 });
classSchema.index({ schoolId: 1, isActive: 1 });

export const Class = model<IClassDocument>('Class', classSchema);
