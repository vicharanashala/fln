import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import { ITeacherDocument } from '../interfaces/teacher.interface';

const teacherSchema = new Schema<ITeacherDocument>(
  {
    teacherId: {
      type: String,
      unique: true,
      required: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    school: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    employeeCode: {
      type: String,
      trim: true,
      default: '',
    },
    qualification: {
      type: String,
      trim: true,
      default: '',
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: [0, 'Experience cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    delayedAttemptsCount: {
      type: Number,
      default: 0,
      min: [0, 'Delayed attempts cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

teacherSchema.index({ school: 1, isActive: 1 });

teacherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

teacherSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Teacher = model<ITeacherDocument>('Teacher', teacherSchema);
