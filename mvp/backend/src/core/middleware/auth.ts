import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { User, type UserDoc } from '../../modules/users/user.model.js';
import type { UserRole } from '../../shared/enums.js';
import { forbidden, unauthorized } from '../../core/errors/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

/** Verify the Bearer JWT and attach the user document to the request. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
    const payload = jwt.verify(header.slice(7).trim(), env.jwtSecret) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user) throw unauthorized('User no longer exists');
    req.user = user;
    next();
  } catch (err) {
    if ((err as Error).name === 'JsonWebTokenError' || (err as Error).name === 'TokenExpiredError') {
      return next(unauthorized('Invalid or expired token'));
    }
    next(err);
  }
}

/** Restrict a route to specific roles. Use after `authenticate`. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role as UserRole)) return next(forbidden('Insufficient role'));
    next();
  };
}
