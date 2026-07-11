import type { Request, Response } from 'express';
import { authService, toPublicUser } from '../../modules/auth/auth.service.js';
import { UserRole } from '../../shared/enums.js';

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    res.json(await authService.login(email, password));
  },

  /** Superadmin creates teacher accounts (no public sign-up — SRS R-1). */
  async createTeacher(req: Request, res: Response) {
    const user = await authService.createUser({ ...req.body, role: UserRole.TEACHER });
    res.status(201).json(user);
  },

  async listTeachers(_req: Request, res: Response) {
    res.json(await authService.listTeachers());
  },

  me(req: Request, res: Response) {
    res.json(toPublicUser(req.user!));
  },
};
