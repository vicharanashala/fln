import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';

export interface AuthPayload {
  userId?: string;
  email: string;
  role?: string;
  teacherId?: string;
  schoolId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(httpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required',
      data: null,
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_in_prod';
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(httpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired token',
      data: null,
    });
  }
}
