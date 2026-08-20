// @ts-nocheck — Mongoose schema stub; not yet wired into the running backend.
import { Schema, model } from 'mongoose';
import {
  ICompetencyRequirementDocument,
  MasteryLevel,
} from '../../interfaces/competency/competency.interface';

const MASTERY_LEVELS: MasteryLevel[] = ['Strong', 'Satisfactory', 'Needs Practice'];

const competencyRequirementSchema = new Schema<ICompetencyRequirementDocument>(
  {
    classNumber: {
      type: Number,
      required: [true, 'Class number is required'],
      min: [2, 'Class number must be 2, 3, or 4'],
      max: [4, 'Class number must be 2, 3, or 4'],
    },
    level: {
      type: Number,
      required: [true, 'Level is required'],
      min: [1, 'Level must be at least 1'],
      max: [59, 'Level cannot exceed 59'],
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
      // Free string on purpose: must match evaluation engine's conceptMastery keys verbatim.
      // Do not enum-constrain here — the engine vocabulary is curriculum-driven.
    },
    isMandatory: {
      type: Boolean,
      required: [true, 'isMandatory is required'],
      default: true,
    },
    meetsThreshold: {
      type: String,
      required: [true, 'meetsThreshold is required'],
      enum: {
        values: MASTERY_LEVELS,
        message: `meetsThreshold must be one of: ${MASTERY_LEVELS.join(', ')}`,
      },
      default: 'Strong',
    },
    academicYear: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
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

competencyRequirementSchema.index({ classNumber: 1, level: 1 });
competencyRequirementSchema.index({ classNumber: 1, level: 1, topic: 1 }, { unique: true });
competencyRequirementSchema.index({ topic: 1 });

export const CompetencyRequirement = model<ICompetencyRequirementDocument>(
  'CompetencyRequirement',
  competencyRequirementSchema
);