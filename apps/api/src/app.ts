import express from 'express';
import { authenticate, type AuthConfig } from './auth';
import { errorMiddleware } from './http';
import type { Repos } from './repos';
import { authRoutes } from './routes/auth';
import { rosterRoutes } from './routes/roster';

export interface AppDeps { repos: Repos; auth: AuthConfig }

/** Builds the app without starting it, so tests can run it on any port. */
export function createApp({ repos, auth }: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const requireLogin = authenticate(repos, auth);
  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  app.use('/api/auth', authRoutes(repos, auth, requireLogin));
  app.use('/api', requireLogin, rosterRoutes(repos));

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });
  app.use(errorMiddleware);
  return app;
}
