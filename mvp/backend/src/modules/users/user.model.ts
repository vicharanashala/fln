import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { UserRole } from '../../shared/enums.js';
import { basePlugin } from '../../shared/basePlugin.js';

/**
 * User accounts for all roles. In this MVP pass only `superadmin` and `teacher`
 * are actively used, but the role enum is complete for forward compatibility.
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), required: true },

    // Teacher scoping
    schoolId: { type: String },
    schoolName: { type: String },
    classGrade: { type: Number, min: 1, max: 8 },
    section: { type: String },

    // Governance state (future roles)
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.plugin(basePlugin);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
