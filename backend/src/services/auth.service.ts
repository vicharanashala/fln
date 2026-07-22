import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import { TeacherRepository } from '../repositories/teacher.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../middlewares/errorHandler';

export class AuthService {
  private teacherRepository: TeacherRepository;
  private userRepository: UserRepository;

  constructor() {
    this.teacherRepository = new TeacherRepository();
    this.userRepository = new UserRepository();
  }

  async login(email: string, password: string) {
    // 1. Try to find the user in the teachers collection
    const teacher = await this.teacherRepository.findByEmail(email);
    
    if (teacher) {
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

      const token = this.generateToken({
        id: teacher.teacherId,
        email: teacher.email,
        role: 'teacher',
        schoolId: teacher.school?._id?.toString(),
      });

      return { token, user: { ...teacher.toJSON(), role: 'teacher' } };
    }

    // 2. Try to find the user in the generic users collection
    const genericUser = await this.userRepository.findByEmail(email);

    if (genericUser) {
      if (genericUser.isActive === false) {
        throw new AppError('Account is deactivated. Contact admin.', httpStatus.FORBIDDEN);
      }
      if (genericUser.isBanned) {
        throw new AppError('Account is suspended. Contact admin.', httpStatus.FORBIDDEN);
      }

      const isMatch = await genericUser.comparePassword(password);
      if (!isMatch) {
        throw new AppError('Invalid email or password', httpStatus.UNAUTHORIZED);
      }

      const token = this.generateToken({
        id: genericUser.userId,
        email: genericUser.email,
        role: genericUser.role,
        schoolId: genericUser.schoolId,
      });

      return { token, user: genericUser.toJSON() };
    }

    // 3. Not found anywhere
    throw new AppError('Invalid email or password', httpStatus.UNAUTHORIZED);
  }

  async getMe(email: string, role: string) {
    if (role === 'teacher') {
      const teacher = await this.teacherRepository.findByEmail(email);
      if (teacher) {
        return { ...teacher.toJSON(), role: 'teacher' };
      }
    } else {
      const genericUser = await this.userRepository.findByEmail(email);
      if (genericUser) {
        return genericUser.toJSON();
      }
    }
    throw new AppError('User not found', httpStatus.NOT_FOUND);
  }

  private generateToken(payload: any) {
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_in_prod';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string;
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }
}
