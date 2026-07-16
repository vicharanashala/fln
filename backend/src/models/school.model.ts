import { Schema, model } from 'mongoose';
import { ISchoolDocument } from '../interfaces/school.interface';

const schoolSchema = new Schema<ISchoolDocument>(
  {
    name: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
      maxlength: [200, 'School name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'School code is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'School code must be at least 3 characters'],
      maxlength: [50, 'School code cannot exceed 50 characters'],
    },
    state: {
      type: Schema.Types.ObjectId,
      ref: 'State',
      required: [true, 'State reference is required'],
    },
    district: {
      type: Schema.Types.ObjectId,
      ref: 'District',
      required: [true, 'District reference is required'],
    },
    block: {
      type: Schema.Types.ObjectId,
      ref: 'Block',
      required: [true, 'Block reference is required'],
    },
    strength: {
      type: String,
      enum: {
        values: ['high', 'low'],
        message: 'Strength must be either "high" or "low"',
      },
      required: [true, 'School strength is required'],
    },
    isAccessLocked: {
      type: Boolean,
      default: false,
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

schoolSchema.index({ block: 1 });
schoolSchema.index({ district: 1 });
schoolSchema.index({ state: 1, isActive: 1 });

export const School = model<ISchoolDocument>('School', schoolSchema);
