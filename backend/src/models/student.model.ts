import { Schema, model } from 'mongoose';
import { IStudentDocument } from '../interfaces/student.interface';

const studentSchema = new Schema<IStudentDocument>(
  {
    id: {
      type: String,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
    },
    classGroup: {
      type: String,
      trim: true,
    },
    section: {
      type: String,
      trim: true,
    },
    schoolId: {
      type: String,
      trim: true,
    },
    teacherId: {
      type: String,
      trim: true,
    },
    currentLevel: {
      type: Number,
      default: 1,
    },
    currentSubLevel: {
      type: Number,
      default: 0,
    },
    targetLevel: {
      type: Number,
      default: 2,
    },
    aadharMasked: {
      type: String,
      trim: true,
    },
    levelHistory: {
      type: [
        new Schema(
          {
            level: { type: Number, required: true },
            subLevel: { type: Number, required: false },
            date: { type: String, required: true },
            reason: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    streak: {
      type: Number,
      default: 0,
    },
    // Editable personal / contact details (Phase 3). All optional so the
    // existing seeded docs keep loading without a migration. Values are
    // trimmed strings (or booleans for midDayMeal) so the controller can
    // read them straight from the wire without post-processing.
    dateOfBirth: {
      type: String,
      trim: true,
      default: null,
    },
    gender: {
      type: String,
      trim: true,
      default: null,
    },
    bloodGroup: {
      type: String,
      trim: true,
      default: null,
    },
    disabilityStatus: {
      type: String,
      trim: true,
      default: null,
    },
    guardianName: {
      type: String,
      trim: true,
      default: null,
    },
    guardianRelation: {
      type: String,
      trim: true,
      default: null,
    },
    contactNumber: {
      type: String,
      trim: true,
      default: null,
    },
    residentialAddress: {
      type: String,
      trim: true,
      default: null,
    },
    midDayMeal: {
      type: Boolean,
      default: null,
    },
    busRoute: {
      type: String,
      trim: true,
      default: null,
    },
    enrollmentDate: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    // Seeded collection has no createdAt/updatedAt. Do not introduce them.
    // Do not declare Mongoose indexes either — the existing `id` field has
    // a unique constraint at the schema level (above) but no compound
    // indexes, matching the legacy seeded collection's behaviour.
    // Disable Mongoose's `__v` versionKey so newly-inserted docs match the
    // shape of the seeded docs (no `__v` field).
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        // Seeded `id` is the business ID. Do NOT overwrite it with `_id`.
        // Strip only Mongoose's internal `__v` if present.
        if ('__v' in ret) delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

// Bind explicitly to the existing seeded collection so Mongoose doesn't try
// to pluralize "Student" → "students" (it would collide anyway, but be
// explicit, mirroring the Class pattern).
studentSchema.set('collection', 'students');

export const Student = model<IStudentDocument>('Student', studentSchema);