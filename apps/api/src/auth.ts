import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from './http';
import type { Repos } from './repos';
import type { PublicUser, Role, User } from './types';

export interface AuthConfig { jwtSecret: string; tokenHours: number; /** bcrypt cost for new passwords; defaults to 10 (tests use a low value). */ bcryptCost?: number }

/** The same password rule as the live FLN: 8 or more characters with a capital letter, a digit and a special character. */
export function passwordProblem(password: string): string | undefined {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>_\-+=~`;/\\[\]']/.test(password)) {
    return 'Password must be at least 8 characters with a capital letter, a digit and a special character.';
  }
  if (password.length > 200) return 'Password must be at most 200 characters.';
  return undefined;
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

export async function signToken(user: User, cfg: AuthConfig): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${cfg.tokenHours}h`)
    .sign(new TextEncoder().encode(cfg.jwtSecret));
}

export async function verifyLogin(repos: Repos, email: string, password: string): Promise<User | undefined> {
  const user = await repos.users.byEmail(email);
  // Compare against a dummy hash when the user does not exist, so timing does not reveal accounts.
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
  const ok = await bcrypt.compare(password, hash);
  return user && ok && !user.isBanned ? user : undefined;
}

declare module 'express-serve-static-core' {
  interface Request { user?: User }
}

/** Reads the Bearer token, loads the user fresh (so a ban takes effect at once) and sets req.user. */
export function authenticate(repos: Repos, cfg: AuthConfig) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Unauthorized');
      let sub: string | undefined;
      try {
        sub = (await jwtVerify(header.slice(7).trim(), new TextEncoder().encode(cfg.jwtSecret))).payload.sub;
      } catch { throw new HttpError(401, 'Unauthorized'); }
      const user = sub ? await repos.users.byId(sub) : undefined;
      if (!user || user.isBanned) throw new HttpError(401, 'Unauthorized');
      req.user = user;
      next();
    } catch (err) { next(err); }
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) { next(new HttpError(403, 'Forbidden')); return; }
    next();
  };
}
