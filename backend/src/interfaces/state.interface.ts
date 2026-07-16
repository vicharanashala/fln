import { Document } from 'mongoose';

export interface IState {
  name: string;
  code: string;
  isActive: boolean;
}

export interface IStateDocument extends IState, Document {
  createdAt: Date;
  updatedAt: Date;
}
