import { Schema, model } from 'mongoose';
import { IStateDocument } from '../interfaces/state.interface';

const stateSchema = new Schema<IStateDocument>(
  {
    name: {
      type: String,
      required: [true, 'State name is required'],
      trim: true,
      maxlength: [100, 'State name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'State code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'State code must be at least 2 characters'],
      maxlength: [5, 'State code cannot exceed 5 characters'],
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

stateSchema.index({ isActive: 1 });

export const State = model<IStateDocument>('State', stateSchema);
