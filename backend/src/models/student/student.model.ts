import { Schema, model } from 'mongoose';
import { IStudentDocument } from '../../interfaces/student/student.interface';

const studentSchema = new Schema<IStudentDocument>(
  {
    studentId: {
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
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: {
        values: ['Male', 'Female', 'Other'],
        message: 'Gender must be Male, Female, or Other',
      },
    },
    dateOfBirth: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [3, 'Age must be at least 3'],
      max: [18, 'Age cannot exceed 18'],
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    rollNumber: {
      type: Number,
      required: [true, 'Roll number is required'],
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

studentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true });
studentSchema.index({ teacherId: 1, isActive: 1 });
studentSchema.index({ schoolId: 1, isActive: 1 });

export const Student = model<IStudentDocument>('Student', studentSchema);
