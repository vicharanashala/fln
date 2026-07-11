import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { User, type UserDoc } from '../../modules/users/user.model.js';
import { UserRole } from '../../shared/enums.js';
import { conflict, unauthorized } from '../../core/errors/index.js';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  schoolId?: string;
  schoolName?: string;
  classGrade?: number;
  section?: string;
}

export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    schoolId: u.schoolId ?? undefined,
    schoolName: u.schoolName ?? undefined,
    classGrade: u.classGrade ?? undefined,
    section: u.section ?? undefined,
  };
}

function signToken(user: UserDoc): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  classGrade?: number;
  section?: string;
}

export const authService = {
  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const email = input.email.toLowerCase().trim();
    if (await User.exists({ email })) throw conflict('A user with this email already exists');
    const user = await User.create({
      ...input,
      email,
      passwordHash: await bcrypt.hash(input.password, 10),
    });
    return toPublicUser(user);
  },

  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await User.findOne({ email: (email ?? '').toLowerCase().trim() }).select('+passwordHash');
    if (!user) throw unauthorized('Invalid email or password');
    const ok = await bcrypt.compare(password ?? '', user.passwordHash);
    if (!ok) throw unauthorized('Invalid email or password');
    return { token: signToken(user), user: toPublicUser(user) };
  },

  async listTeachers(): Promise<PublicUser[]> {
    const teachers = await User.find({ role: UserRole.TEACHER }).sort({ createdAt: -1 });
    return teachers.map(toPublicUser);
  },
};
