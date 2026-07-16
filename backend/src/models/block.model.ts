import { Schema, model } from 'mongoose';
import { IBlockDocument } from '../interfaces/block.interface';

const blockSchema = new Schema<IBlockDocument>(
  {
    name: {
      type: String,
      required: [true, 'Block name is required'],
      trim: true,
      maxlength: [100, 'Block name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Block code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'Block code must be at least 2 characters'],
      maxlength: [20, 'Block code cannot exceed 20 characters'],
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

blockSchema.index({ district: 1 });
blockSchema.index({ state: 1, district: 1, isActive: 1 });

export const Block = model<IBlockDocument>('Block', blockSchema);
