import { Schema, model } from 'mongoose';
import { IDistrictDocument } from '../interfaces/district.interface';

const districtSchema = new Schema<IDistrictDocument>(
  {
    name: {
      type: String,
      required: [true, 'District name is required'],
      trim: true,
      maxlength: [100, 'District name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'District code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'District code must be at least 2 characters'],
      maxlength: [10, 'District code cannot exceed 10 characters'],
    },
    state: {
      type: Schema.Types.ObjectId,
      ref: 'State',
      required: [true, 'State reference is required'],
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

districtSchema.index({ state: 1 });
districtSchema.index({ state: 1, isActive: 1 });

export const District = model<IDistrictDocument>('District', districtSchema);
