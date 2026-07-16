import { Document, Types } from 'mongoose';

export interface ITeacher {
  teacherId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  school: Types.ObjectId;
  employeeCode: string;
  qualification: string;
  experienceYears: number;
  isActive: boolean;
  isBanned: boolean;
  delayedAttemptsCount: number;
}

export interface ITeacherDocument extends ITeacher, Document {
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ITeacherResponse {
  teacherId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  school: Types.ObjectId;
  employeeCode: string;
  qualification: string;
  experienceYears: number;
  isActive: boolean;
  isBanned: boolean;
  delayedAttemptsCount: number;
}

export interface ITeacherDashboard {
  teacherId: string;
  firstName: string;
  lastName: string;
  email: string;
  school: {
    name: string;
    code: string;
  };
}
