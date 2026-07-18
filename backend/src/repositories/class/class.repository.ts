import { FilterQuery, UpdateQuery } from 'mongoose';
import { Class } from '../../models/class/class.model';
import { IClass, IClassDocument } from '../../interfaces/class/class.interface';

export class ClassRepository {
  async create(data: IClass): Promise<IClassDocument> {
    const cls = new Class(data);
    return cls.save();
  }

  async findById(id: string): Promise<IClassDocument | null> {
    return Class.findById(id)
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .exec();
  }

  async findAll(filter?: FilterQuery<IClassDocument>): Promise<IClassDocument[]> {
    return Class.find(filter || {})
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByTeacher(teacherId: string): Promise<IClassDocument[]> {
    return Class.find({ teacherId, isActive: true })
      .populate('schoolId', 'name code')
      .sort({ className: 1, section: 1 })
      .exec();
  }

  async findBySchool(schoolId: string): Promise<IClassDocument[]> {
    return Class.find({ schoolId, isActive: true })
      .populate('teacherId', 'firstName lastName email')
      .sort({ className: 1, section: 1 })
      .exec();
  }

  async findActive(): Promise<IClassDocument[]> {
    return Class.find({ isActive: true })
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<IClassDocument>): Promise<IClassDocument | null> {
    return Class.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .exec();
  }

  async deleteById(id: string): Promise<IClassDocument | null> {
    return Class.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<IClassDocument | null> {
    return Class.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<IClassDocument>): Promise<number> {
    return Class.countDocuments(filter || {}).exec();
  }

  async findOne(filter: FilterQuery<IClassDocument>): Promise<IClassDocument | null> {
    return Class.findOne(filter).exec();
  }

  async getLastClassCode(): Promise<string | null> {
    const last = await Class.findOne({})
      .sort({ classCode: -1 })
      .select('classCode')
      .lean()
      .exec();
    return (last as { classCode: string } | null)?.classCode || null;
  }
}
