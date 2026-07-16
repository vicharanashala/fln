import { FilterQuery, UpdateQuery, Types } from 'mongoose';
import { Block } from '../models/block.model';
import { IBlock, IBlockDocument } from '../interfaces/block.interface';

export class BlockRepository {
  async create(data: IBlock): Promise<IBlockDocument> {
    const block = new Block(data);
    return block.save();
  }

  async findById(id: string): Promise<IBlockDocument | null> {
    return Block.findById(id)
      .populate('state', 'name code')
      .populate('district', 'name code')
      .exec();
  }

  async findByCode(code: string): Promise<IBlockDocument | null> {
    return Block.findOne({ code: code.toUpperCase() })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .exec();
  }

  async findAll(filter?: FilterQuery<IBlockDocument>): Promise<IBlockDocument[]> {
    return Block.find(filter || {})
      .populate('state', 'name code')
      .populate('district', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findByDistrict(districtId: string): Promise<IBlockDocument[]> {
    return Block.find({ district: new Types.ObjectId(districtId), isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findByState(stateId: string): Promise<IBlockDocument[]> {
    return Block.find({ state: new Types.ObjectId(stateId), isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findActive(): Promise<IBlockDocument[]> {
    return Block.find({ isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<IBlockDocument>): Promise<IBlockDocument | null> {
    return Block.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .exec();
  }

  async deleteById(id: string): Promise<IBlockDocument | null> {
    return Block.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<IBlockDocument | null> {
    return Block.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<IBlockDocument>): Promise<number> {
    return Block.countDocuments(filter || {}).exec();
  }

  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<IBlockDocument> = { code: code.toUpperCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await Block.countDocuments(filter).exec();
    return count > 0;
  }
}
