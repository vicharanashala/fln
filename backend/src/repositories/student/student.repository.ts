import { FilterQuery, UpdateQuery } from 'mongoose';
import { Student } from '../../models/student/student.model';
import { IStudent, IStudentDocument } from '../../interfaces/student/student.interface';

export class StudentRepository {
  async create(data: IStudent): Promise<IStudentDocument> {
    const student = new Student(data);
    return student.save();
  }

  async findById(id: string): Promise<IStudentDocument | null> {
    return Student.findById(id)
      .populate('classId', 'className section academicYear')
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .exec();
  }

  async findAll(filter?: FilterQuery<IStudentDocument>): Promise<IStudentDocument[]> {
    return Student.find(filter || {})
      .populate('classId', 'className section academicYear')
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByClass(classId: string): Promise<IStudentDocument[]> {
    return Student.find({ classId, isActive: true })
      .populate('teacherId', 'firstName lastName email')
      .sort({ rollNumber: 1 })
      .exec();
  }

  async findByTeacher(teacherId: string): Promise<IStudentDocument[]> {
    return Student.find({ teacherId, isActive: true })
      .populate('classId', 'className section academicYear')
      .populate('schoolId', 'name code')
      .sort({ rollNumber: 1 })
      .exec();
  }

  async findBySchool(schoolId: string): Promise<IStudentDocument[]> {
    return Student.find({ schoolId, isActive: true })
      .populate('classId', 'className section academicYear')
      .populate('teacherId', 'firstName lastName email')
      .sort({ rollNumber: 1 })
      .exec();
  }

  async findActive(): Promise<IStudentDocument[]> {
    return Student.find({ isActive: true })
      .populate('classId', 'className section academicYear')
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateById(id: string, data: UpdateQuery<IStudentDocument>): Promise<IStudentDocument | null> {
    return Student.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('classId', 'className section academicYear')
      .populate('teacherId', 'firstName lastName email')
      .populate('schoolId', 'name code')
      .exec();
  }

  async deleteById(id: string): Promise<IStudentDocument | null> {
    return Student.findByIdAndDelete(id).exec();
  }

  async softDeleteById(id: string): Promise<IStudentDocument | null> {
    return Student.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async count(filter?: FilterQuery<IStudentDocument>): Promise<number> {
    return Student.countDocuments(filter || {}).exec();
  }

  async getMaxRollNumber(classId: string): Promise<number> {
    const last = await Student.findOne({ classId })
      .sort({ rollNumber: -1 })
      .select('rollNumber')
      .lean()
      .exec();
    return (last as { rollNumber: number } | null)?.rollNumber || 0;
  }

  async getLastStudentId(schoolId: string): Promise<string | null> {
    const last = await Student.findOne({ schoolId })
      .sort({ studentId: -1 })
      .select('studentId')
      .lean()
      .exec();
    return (last as { studentId: string } | null)?.studentId || null;
  }
}
