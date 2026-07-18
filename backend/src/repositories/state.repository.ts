import { FilterQuery, UpdateQuery } from 'mongoose';
import { State } from '../models/state.model';
import { IState, IStateDocument } from '../interfaces/state.interface';

export class StateRepository {
  async create(data: IState): Promise<IStateDocument> {
    const state = new State(data);
    return state.save();
  }

  async findById(id: string): Promise<IStateDocument | null> {
    return State.findById(id).exec();
  }

  async findByCode(code: string): Promise<IStateDocument | null> {
    return State.findOne({ code: code.toUpperCase() }).exec();
  }

  async findAll(filter?: FilterQuery<IStateDocument>): Promise<IStateDocument[]> {
    return State.find(filter || {}).sort({ name: 1 }).exec();
  }

  async findActive(): Promise<IStateDocument[]> {
    return State.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IStateDocument>): Promise<IStateDocument | null> {
    return State.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async deleteById(id: string): Promise<IStateDocument | null> {
    return State.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<IStateDocument | null> {
    return State.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<IStateDocument>): Promise<number> {
    return State.countDocuments(filter || {}).exec();
  }

  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<IStateDocument> = { code: code.toUpperCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await State.countDocuments(filter).exec();
    return count > 0;
  }
}
