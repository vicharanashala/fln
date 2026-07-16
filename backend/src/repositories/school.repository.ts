import { FilterQuery, UpdateQuery, Types } from 'mongoose';
import { School } from '../models/school.model';
import { ISchool, ISchoolDocument } from '../interfaces/school.interface';

export class SchoolRepository {
  async create(data: ISchool): Promise<ISchoolDocument> {
    const school = new School(data);
    return school.save();
  }

  async findById(id: string): Promise<ISchoolDocument | null> {
    return School.findById(id)
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .exec();
  }

  async findByCode(code: string): Promise<ISchoolDocument | null> {
    return School.findOne({ code: code.toLowerCase() })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .exec();
  }

  async findAll(filter?: FilterQuery<ISchoolDocument>): Promise<ISchoolDocument[]> {
    return School.find(filter || {})
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findByBlock(blockId: string): Promise<ISchoolDocument[]> {
    return School.find({ block: new Types.ObjectId(blockId), isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findByDistrict(districtId: string): Promise<ISchoolDocument[]> {
    return School.find({ district: new Types.ObjectId(districtId), isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findByState(stateId: string): Promise<ISchoolDocument[]> {
    return School.find({ state: new Types.ObjectId(stateId), isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async findActive(): Promise<ISchoolDocument[]> {
    return School.find({ isActive: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .sort({ name: 1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<ISchoolDocument>): Promise<ISchoolDocument | null> {
    return School.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('block', 'name code')
      .exec();
  }

  async deleteById(id: string): Promise<ISchoolDocument | null> {
    return School.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<ISchoolDocument | null> {
    return School.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async lockAccess(id: string): Promise<ISchoolDocument | null> {
    return School.findByIdAndUpdate(id, { isAccessLocked: true }, { new: true }).exec();
  }

  async unlockAccess(id: string): Promise<ISchoolDocument | null> {
    return School.findByIdAndUpdate(id, { isAccessLocked: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<ISchoolDocument>): Promise<number> {
    return School.countDocuments(filter || {}).exec();
  }

  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<ISchoolDocument> = { code: code.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await School.countDocuments(filter).exec();
    return count > 0;
  }
}
