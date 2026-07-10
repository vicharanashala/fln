import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  password: string;
  role: 'superadmin' | 'teacher';
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: mongoose.Types.ObjectId;
  assignedSchools?: mongoose.Types.ObjectId[];
  delayedAttemptsCount?: number;
  isBanned?: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'teacher'], required: true },
    stateCode: { type: String, uppercase: true, trim: true },
    districtCode: { type: String, uppercase: true, trim: true },
    blockCode: { type: String, uppercase: true, trim: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', index: true },
    assignedSchools: [{ type: Schema.Types.ObjectId, ref: 'School' }],
    delayedAttemptsCount: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });
UserSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);
