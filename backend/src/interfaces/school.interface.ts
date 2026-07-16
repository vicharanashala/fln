import { Document, Types } from 'mongoose';

export type SchoolStrength = 'high' | 'low';

export interface ISchool {
  name: string;
  code: string;
  state: Types.ObjectId;
  district: Types.ObjectId;
  block: Types.ObjectId;
  strength: SchoolStrength;
  isAccessLocked: boolean;
  isActive: boolean;
}

export interface ISchoolDocument extends ISchool, Document {
  createdAt: Date;
  updatedAt: Date;
}
