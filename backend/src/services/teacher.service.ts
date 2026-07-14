import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import { TeacherRepository } from '../repositories/teacher.repository';
import { SchoolRepository } from '../repositories/school.repository';
import { ITeacher, ITeacherDashboard } from '../interfaces/teacher.interface';
import { AppError } from '../middlewares/errorHandler';
import { generateTeacherId } from '../utils/idGenerator';

export class TeacherService {
  private repository: TeacherRepository;
  private schoolRepository: SchoolRepository;

  constructor() {
    this.repository = new TeacherRepository();
    this.schoolRepository = new SchoolRepository();
  }

  async create(data: ITeacher) {
    const school = await this.schoolRepository.findById(data.school.toString());
    if (!school) {
      throw new AppError('Referenced school not found', httpStatus.BAD_REQUEST);
    }

    const emailExists = await this.repository.existsByEmail(data.email);
    if (emailExists) {
      throw new AppError('A teacher with this email already exists', httpStatus.CONFLICT);
    }

    const phoneExists = await this.repository.existsByPhone(data.phoneNumber);
    if (phoneExists) {
      throw new AppError('A teacher with this phone number already exists', httpStatus.CONFLICT);
    }

    const teacherId = await generateTeacherId(this.repository);

    return this.repository.create({ ...data, teacherId });
  }

  async login(email: string, password: string) {
    const teacher = await this.repository.findByEmail(email);
    if (!teacher) {
      throw new AppError('Invalid email or password', httpStatus.UNAUTHORIZED);
    }

    if (!teacher.isActive) {
      throw new AppError('Account is deactivated. Contact admin.', httpStatus.FORBIDDEN);
    }

    if (teacher.isBanned) {
      throw new AppError('Account is suspended due to delayed submissions. Contact admin.', httpStatus.FORBIDDEN);
    }

    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', httpStatus.UNAUTHORIZED);
    }

    const secret = process.env.JWT_SECRET || 'fallback_secret_change_in_prod';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string;

    const token = jwt.sign(
      {
        teacherId: teacher.teacherId,
        email: teacher.email,
        schoolId: teacher.school?._id?.toString(),
      },
      secret,
      { expiresIn: expiresIn as any }
    );

    const teacherObj = teacher.toJSON();

    return { token, teacher: teacherObj };
  }

  async getDashboard(teacherId: string): Promise<ITeacherDashboard> {
    const teacher = await this.repository.findByTeacherId(teacherId);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }

    const school = await this.schoolRepository.findById(teacher.school.toString());
    if (!school) {
      throw new AppError('Assigned school not found', httpStatus.NOT_FOUND);
    }

    return {
      teacherId: teacher.teacherId,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      school: {
        name: school.name,
        code: school.code,
      },
    };
  }

  async getById(id: string) {
    const teacher = await this.repository.findById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return teacher;
  }

  async getByTeacherId(teacherId: string) {
    const teacher = await this.repository.findByTeacherId(teacherId);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return teacher;
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async getBySchool(schoolId: string) {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findBySchool(schoolId);
  }

  async update(id: string, data: Partial<ITeacher>) {
    const teacher = await this.repository.findById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }

    if (data.email) {
      const duplicate = await this.repository.existsByEmail(data.email, id);
      if (duplicate) {
        throw new AppError('A teacher with this email already exists', httpStatus.CONFLICT);
      }
    }

    if (data.phoneNumber) {
      const duplicate = await this.repository.existsByPhone(data.phoneNumber, id);
      if (duplicate) {
        throw new AppError('A teacher with this phone number already exists', httpStatus.CONFLICT);
      }
    }

    if (data.school) {
      const school = await this.schoolRepository.findById(data.school.toString());
      if (!school) {
        throw new AppError('Referenced school not found', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async toggleStatus(id: string) {
    const teacher = await this.repository.findById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: !teacher.isActive });
  }

  async delete(id: string) {
    const teacher = await this.repository.findById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    await this.repository.deleteById(id);
  }

  async softDelete(id: string) {
    const teacher = await this.repository.findById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }

  async banTeacher(teacherId: string) {
    const teacher = await this.repository.findByTeacherId(teacherId);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return this.repository.banTeacher(teacherId);
  }

  async reviveTeacher(teacherId: string) {
    const teacher = await this.repository.findByTeacherId(teacherId);
    if (!teacher) {
      throw new AppError('Teacher not found', httpStatus.NOT_FOUND);
    }
    return this.repository.reviveTeacher(teacherId);
  }
}
