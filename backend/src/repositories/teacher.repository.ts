import { FilterQuery, UpdateQuery } from 'mongoose';
import { Teacher } from '../models/teacher.model';
import { ITeacher, ITeacherDocument } from '../interfaces/teacher.interface';

export class TeacherRepository {
  async create(data: ITeacher): Promise<ITeacherDocument> {
    const teacher = new Teacher(data);
    return teacher.save();
  }

  async findById(id: string): Promise<ITeacherDocument | null> {
    return Teacher.findById(id).populate('school', 'name code strength').exec();
  }

  async findByTeacherId(teacherId: string): Promise<ITeacherDocument | null> {
    return Teacher.findOne({ teacherId }).populate('school', 'name code strength').exec();
  }

  async findByEmail(email: string): Promise<ITeacherDocument | null> {
    return Teacher.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('school', 'name code strength')
      .exec();
  }

  async findAll(filter?: FilterQuery<ITeacherDocument>): Promise<ITeacherDocument[]> {
    return Teacher.find(filter || {})
      .populate('school', 'name code strength')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findBySchool(schoolId: string): Promise<ITeacherDocument[]> {
    return Teacher.find({ school: schoolId, isActive: true })
      .populate('school', 'name code strength')
      .sort({ firstName: 1 })
      .exec();
  }

  async findActive(): Promise<ITeacherDocument[]> {
    return Teacher.find({ isActive: true })
      .populate('school', 'name code strength')
      .sort({ firstName: 1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<ITeacherDocument>): Promise<ITeacherDocument | null> {
    return Teacher.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('school', 'name code strength')
      .exec();
  }

  async updateByTeacherId(teacherId: string, data: UpdateQuery<ITeacherDocument>): Promise<ITeacherDocument | null> {
    return Teacher.findOneAndUpdate({ teacherId }, data, { new: true, runValidators: true })
      .populate('school', 'name code strength')
      .exec();
  }

  async deleteById(id: string): Promise<ITeacherDocument | null> {
    return Teacher.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<ITeacherDocument | null> {
    return Teacher.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<ITeacherDocument>): Promise<number> {
    return Teacher.countDocuments(filter || {}).exec();
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<ITeacherDocument> = { email: email.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await Teacher.countDocuments(filter).exec();
    return count > 0;
  }

  async existsByPhone(phoneNumber: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<ITeacherDocument> = { phoneNumber };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await Teacher.countDocuments(filter).exec();
    return count > 0;
  }

  async incrementDelayedAttempts(teacherId: string): Promise<ITeacherDocument | null> {
    return Teacher.findOneAndUpdate(
      { teacherId },
      { $inc: { delayedAttemptsCount: 1 } },
      { new: true }
    ).exec();
  }

  async banTeacher(teacherId: string): Promise<ITeacherDocument | null> {
    return Teacher.findOneAndUpdate(
      { teacherId },
      { isBanned: true },
      { new: true }
    ).exec();
  }

  async reviveTeacher(teacherId: string): Promise<ITeacherDocument | null> {
    return Teacher.findOneAndUpdate(
      { teacherId },
      { isBanned: false, delayedAttemptsCount: 0 },
      { new: true }
    ).exec();
  }

  async getLastTeacherId(): Promise<string | null> {
    const last = await Teacher.findOne({})
      .sort({ teacherId: -1 })
      .select('teacherId')
      .lean()
      .exec();
    return last?.teacherId || null;
  }
}
