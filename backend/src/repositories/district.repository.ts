import { FilterQuery, UpdateQuery, Types } from 'mongoose';
import { District } from '../models/district.model';
import { IDistrict, IDistrictDocument } from '../interfaces/district.interface';

export class DistrictRepository {
  async create(data: IDistrict): Promise<IDistrictDocument> {
    const district = new District(data);
    return district.save();
  }

  async findById(id: string): Promise<IDistrictDocument | null> {
    return District.findById(id).populate('state', 'name code').exec();
  }

  async findByCode(code: string): Promise<IDistrictDocument | null> {
    return District.findOne({ code: code.toUpperCase() }).populate('state', 'name code').exec();
  }

  async findAll(filter?: FilterQuery<IDistrictDocument>): Promise<IDistrictDocument[]> {
    return District.find(filter || {}).populate('state', 'name code').sort({ name: 1 }).exec();
  }

  async findByState(stateId: string): Promise<IDistrictDocument[]> {
    return District.find({ state: new Types.ObjectId(stateId), isActive: true })
      .populate('state', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findActive(): Promise<IDistrictDocument[]> {
    return District.find({ isActive: true }).populate('state', 'name code').sort({ name: 1 }).exec();
  }

  async updateById(id: string, data: UpdateQuery<IDistrictDocument>): Promise<IDistrictDocument | null> {
    return District.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('state', 'name code').exec();
  }

  async deleteById(id: string): Promise<IDistrictDocument | null> {
    return District.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<IDistrictDocument | null> {
    return District.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<IDistrictDocument>): Promise<number> {
    return District.countDocuments(filter || {}).exec();
  }

  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<IDistrictDocument> = { code: code.toUpperCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await District.countDocuments(filter).exec();
    return count > 0;
  }
}
