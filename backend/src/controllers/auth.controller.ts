import { Request, Response, NextFunction } from 'express';
import { TeacherService } from '../services/teacher.service';
import { sendSuccess } from '../utils/response';

const teacherService = new TeacherService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await teacherService.login(email, password);
      sendSuccess(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }
}
