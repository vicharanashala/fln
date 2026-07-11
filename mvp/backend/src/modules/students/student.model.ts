import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { BaselineStatus } from '../../shared/enums.js';
import { basePlugin } from '../../shared/basePlugin.js';

const levelHistorySchema = new Schema(
  {
    level: { type: Number, required: true },
    levelName: { type: String, required: true },
    date: { type: Date, default: Date.now },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const studentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 3, max: 15 },
    classGrade: { type: Number, required: true },
    section: { type: String, required: true, default: 'A' },
    schoolId: { type: String, required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** Masked Aadhar / Birth Certificate id (SRS §13.2 R-6). Never store raw. */
    aadharMasked: { type: String, required: true },

    currentLevel: { type: Number, default: null },
    currentLevelName: { type: String, default: null },
    baselineStatus: { type: String, enum: Object.values(BaselineStatus), default: BaselineStatus.PENDING },
    baselineTestId: { type: Schema.Types.ObjectId, ref: 'Worksheet', default: null },
    levelHistory: { type: [levelHistorySchema], default: [] },
  },
  { timestamps: true }
);

// A roll number is unique within a teacher's class.
studentSchema.index({ teacherId: 1, rollNo: 1 }, { unique: true });
studentSchema.plugin(basePlugin);

export type StudentDoc = HydratedDocument<InferSchemaType<typeof studentSchema>>;
export const Student = model('Student', studentSchema);
