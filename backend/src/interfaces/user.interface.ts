import { Document } from 'mongoose';

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  DISTRICT_ADMIN = 'district_admin',
  BLOCK_ADMIN = 'block_admin',
  SCHOOL = 'school',
  VOLUNTEER = 'volunteer'
}

export interface IUser {
  userId: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[];
  delayedAttemptsCount?: number;
  isActive?: boolean;
  isBanned?: boolean;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}
