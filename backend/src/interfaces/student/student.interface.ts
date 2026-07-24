import { Document, Types } from 'mongoose';

export type Gender = 'Male' | 'Female' | 'Other';

export interface IStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  age: number;
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  rollNumber: number;
  isActive: boolean;
}

export interface IStudentDocument extends IStudent, Document {
  createdAt: Date;
  updatedAt: Date;
}
