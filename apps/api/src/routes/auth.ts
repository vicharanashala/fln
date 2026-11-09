import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signToken, toPublic, verifyLogin, type AuthConfig } from '../auth';
import { handler, requireString } from '../http';
import type { Repos } from '../repos';

export function authRoutes(repos: Repos, cfg: AuthConfig, authenticate: ReturnType<typeof import('../auth').authenticate>, loginPer15Min = 20): Router {
  const router = Router();
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: loginPer15Min, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait and try again.' } });

  router.post('/login', loginLimiter, handler(async (req, res) => {
    const email = requireString(req.body?.email, 'email', 200);
    const password = requireString(req.body?.password, 'password', 200);
    const user = await verifyLogin(repos, email, password);
    if (!user) { res.status(401).json({ error: 'Wrong email or password.' }); return; }
    res.json({ token: await signToken(user, cfg), user: toPublic(user) });
  }));

  router.get('/me', authenticate, handler((req, res) => { res.json({ user: toPublic(req.user!) }); }));
  return router;
}
