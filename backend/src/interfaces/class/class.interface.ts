import { Document, Types } from 'mongoose';

export interface IClass {
  classCode: string;
  className: string;
  section: string;
  academicYear: string;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  maximumStudents: number;
  currentStudents: number;
  isActive: boolean;
}

export interface IClassDocument extends IClass, Document {
  createdAt: Date;
  updatedAt: Date;
}
