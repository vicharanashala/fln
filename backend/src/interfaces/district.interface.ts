import { Document, Types } from 'mongoose';

export interface IDistrict {
  name: string;
  code: string;
  state: Types.ObjectId;
  isActive: boolean;
}

export interface IDistrictDocument extends IDistrict, Document {
  createdAt: Date;
  updatedAt: Date;
}
