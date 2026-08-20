// @ts-nocheck — Mongoose schema stub; not yet wired into the running backend.
// Kept for forward-compat with the new-backend migration (MIGRATION_PLAN.md).
import { Schema, model } from 'mongoose';
import {
  ICertificationDocument,
  CertificationStatus,
} from '../interfaces/certification.interface';

const STATUSES: CertificationStatus[] = ['active', 'review_needed', 'revoked'];

const certificationSchema = new Schema<ICertificationDocument>(
  {
    studentId: {
      type: String,
      required: [true, 'studentId is required'],
      trim: true,
    },
    classNumber: {
      type: Number,
      required: [true, 'classNumber is required'],
      min: [2, 'classNumber must be 2, 3, or 4'],
      max: [4, 'classNumber must be 2, 3, or 4'],
    },
    level: {
      type: Number,
      required: [true, 'level is required'],
      min: [1, 'level must be at least 1'],
      max: [59, 'level cannot exceed 59'],
    },
    decisionSnapshot: {
      type: Schema.Types.Mixed,
      required: [true, 'decisionSnapshot is required'],
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: STATUSES,
        message: `status must be one of: ${STATUSES.join(', ')}`,
      },
      default: 'active',
    },
    version: {
      type: Number,
      required: [true, 'version is required'],
      min: [1, 'version must be at least 1'],
      default: 1,
    },
    issuedAt: {
      type: String,
    },
    certificateId: {
      type: String,
      trim: true,
    },
    reviewReason: {
      type: String,
    },
    reviewedBy: {
      type: String,
    },
    reviewDate: {
      type: String,
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

certificationSchema.index({ studentId: 1, classNumber: 1, level: 1 }, { unique: true });
certificationSchema.index({ studentId: 1, status: 1 });

export const Certification = model<ICertificationDocument>(
  'Certification',
  certificationSchema
);