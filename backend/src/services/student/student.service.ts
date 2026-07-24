import httpStatus from 'http-status';
import { StudentRepository } from '../../repositories/student/student.repository';
import { TeacherRepository } from '../../repositories/teacher.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { ClassRepository } from '../../repositories/class/class.repository';
import { StateRepository } from '../../repositories/state.repository';
import { DistrictRepository } from '../../repositories/district.repository';
import { IStudent } from '../../interfaces/student/student.interface';
import { AppError } from '../../middlewares/errorHandler';

export class StudentService {
  private repository: StudentRepository;
  private teacherRepository: TeacherRepository;
  private schoolRepository: SchoolRepository;
  private classRepository: ClassRepository;
  private stateRepository: StateRepository;
  private districtRepository: DistrictRepository;

  constructor() {
    this.repository = new StudentRepository();
    this.teacherRepository = new TeacherRepository();
    this.schoolRepository = new SchoolRepository();
    this.classRepository = new ClassRepository();
    this.stateRepository = new StateRepository();
    this.districtRepository = new DistrictRepository();
  }

  async create(data: IStudent) {
    const schoolId = data.schoolId.toString();
    const teacherId = data.teacherId.toString();
    const classId = data.classId.toString();

    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new AppError('Referenced school not found', httpStatus.BAD_REQUEST);
    }

    const teacher = await this.teacherRepository.findById(teacherId);
    if (!teacher) {
      throw new AppError('Referenced teacher not found', httpStatus.BAD_REQUEST);
    }

    const cls = await this.classRepository.findById(classId);
    if (!cls) {
      throw new AppError('Referenced class not found', httpStatus.BAD_REQUEST);
    }

    if (cls.currentStudents >= cls.maximumStudents) {
      throw new AppError(
        `Class has reached maximum capacity of ${cls.maximumStudents} students`,
        httpStatus.BAD_REQUEST
      );
    }

    const studentId = await this.generateStudentId(schoolId);
    const maxRoll = await this.repository.getMaxRollNumber(classId);
    const rollNumber = maxRoll + 1;

    const student = await this.repository.create({
      ...data,
      studentId,
      rollNumber,
      classId: cls._id,
      teacherId: teacher._id,
      schoolId: school._id,
    });

    await this.classRepository.updateById(classId, {
      currentStudents: cls.currentStudents + 1,
    });

    return student;
  }

  private async generateStudentId(schoolId: string): Promise<string> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new AppError('School not found for ID generation', httpStatus.BAD_REQUEST);
    }

    const district = await this.districtRepository.findById(school.district.toString());
    if (!district) {
      throw new AppError('District not found for ID generation', httpStatus.BAD_REQUEST);
    }

    const state = await this.stateRepository.findById(school.state.toString());
    if (!state) {
      throw new AppError('State not found for ID generation', httpStatus.BAD_REQUEST);
    }

    const stateCode = state.code;
    const districtCode = district.code;
    const schoolCode = school.code;

    const lastStudentId = await this.repository.getLastStudentId(schoolId);
    let sequence = 1;

    if (lastStudentId) {
      const parts = lastStudentId.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      sequence = lastSeq + 1;
    }

    return `${stateCode}-${districtCode}-${schoolCode}-${String(sequence).padStart(4, '0')}`;
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async getById(id: string) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new AppError('Student not found', httpStatus.NOT_FOUND);
    }
    return student;
  }

  async getByClass(classId: string) {
    const cls = await this.classRepository.findById(classId);
    if (!cls) {
      throw new AppError('Class not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findByClass(classId);
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

  async update(id: string, data: Partial<IStudent>) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new AppError('Student not found', httpStatus.NOT_FOUND);
    }

    if (data.schoolId) {
      const school = await this.schoolRepository.findById(data.schoolId.toString());
      if (!school) {
        throw new AppError('Referenced school not found', httpStatus.BAD_REQUEST);
      }
    }

    if (data.teacherId) {
      const teacher = await this.teacherRepository.findById(data.teacherId.toString());
      if (!teacher) {
        throw new AppError('Referenced teacher not found', httpStatus.BAD_REQUEST);
      }
    }

    if (data.classId) {
      const cls = await this.classRepository.findById(data.classId.toString());
      if (!cls) {
        throw new AppError('Referenced class not found', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('Student not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async toggleStatus(id: string) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new AppError('Student not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: !student.isActive });
  }

  async delete(id: string) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new AppError('Student not found', httpStatus.NOT_FOUND);
    }
    const classId = student.classId.toString();
    const cls = await this.classRepository.findById(classId);

    await this.repository.deleteById(id);

    if (cls) {
      await this.classRepository.updateById(classId, {
        currentStudents: Math.max(0, cls.currentStudents - 1),
      });
    }
  }

  async softDelete(id: string) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new AppError('Student not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }
}
