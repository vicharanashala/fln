import httpStatus from 'http-status';
import { ClassRepository } from '../../repositories/class/class.repository';
import { TeacherRepository } from '../../repositories/teacher.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { IClass } from '../../interfaces/class/class.interface';
import { AppError } from '../../middlewares/errorHandler';
import { generateClassCode } from '../../utils/idGenerator';

export class ClassService {
  private repository: ClassRepository;
  private teacherRepository: TeacherRepository;
  private schoolRepository: SchoolRepository;

  constructor() {
    this.repository = new ClassRepository();
    this.teacherRepository = new TeacherRepository();
    this.schoolRepository = new SchoolRepository();
  }

  async create(data: IClass) {
    const teacher = await this.teacherRepository.findById(data.teacherId.toString());
    if (!teacher) {
      throw new AppError('Referenced teacher not found', httpStatus.BAD_REQUEST);
    }

    const school = await this.schoolRepository.findById(data.schoolId.toString());
    if (!school) {
      throw new AppError('Referenced school not found', httpStatus.BAD_REQUEST);
    }

    const classCode = await generateClassCode(this.repository);

    return this.repository.create({ ...data, classCode, currentStudents: 0 });
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async getById(id: string) {
    const cls = await this.repository.findById(id);
    if (!cls) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }
    return cls;
  }

  async getByTeacher(teacherId: string) {
    const teacher = await this.teacherRepository.findById(teacherId);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findByTeacher(teacherId);
  }

  async getBySchool(schoolId: string) {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findBySchool(schoolId);
  }

  async update(id: string, data: Partial<IClass>) {
    const cls = await this.repository.findById(id);
    if (!cls) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }

    if (data.teacherId) {
      const teacher = await this.teacherRepository.findById(data.teacherId.toString());
      if (!teacher) {
        throw new AppError('Referenced teacher not found', httpStatus.BAD_REQUEST);
      }
    }

    if (data.schoolId) {
      const school = await this.schoolRepository.findById(data.schoolId.toString());
      if (!school) {
        throw new AppError('Referenced school not found', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async toggleStatus(id: string) {
    const cls = await this.repository.findById(id);
    if (!cls) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: !cls.isActive });
  }

  async delete(id: string) {
    const cls = await this.repository.findById(id);
    if (!cls) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }
    await this.repository.deleteById(id);
  }

  async softDelete(id: string) {
    const cls = await this.repository.findById(id);
    if (!cls) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }
}
