import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      sendSuccess(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = (req as any).user;
      if (!payload || !payload.email) {
        throw new Error('Invalid token payload');
      }
      const fullUser = await authService.getMe(payload.email, payload.role);
      sendSuccess(res, 'Session restored', { user: fullUser });
    } catch (error) {
      next(error);
    }
  }
}
