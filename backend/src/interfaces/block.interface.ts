import { Document, Types } from 'mongoose';

export interface IBlock {
  name: string;
  code: string;
  state: Types.ObjectId;
  district: Types.ObjectId;
  isActive: boolean;
}

export interface IBlockDocument extends IBlock, Document {
  createdAt: Date;
  updatedAt: Date;
}
