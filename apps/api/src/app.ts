import express from 'express';
import { authenticate, type AuthConfig } from './auth';
import { errorMiddleware } from './http';
import type { ReadAnswers } from './ollama';
import { loadQuestionBank, type QuestionBank } from './questionBank';
import type { Repos } from './repos';
import { authRoutes } from './routes/auth';
import { classRoutes } from './routes/classes';
import { contentRoutes } from './routes/content';
import { peopleRoutes } from './routes/people';
import { rosterRoutes } from './routes/roster';
import { worksheetRoutes } from './routes/worksheets';
import { createSheetService } from './services/sheets';

export interface AppLimits { jsonBodyMb: number; scanBodyMb: number; loginPer15Min: number; scanPerHour: number }
export const DEFAULT_LIMITS: AppLimits = { jsonBodyMb: 1, scanBodyMb: 9, loginPer15Min: 20, scanPerHour: 120 };

export interface AppDeps {
  repos: Repos;
  auth: AuthConfig;
  bank?: QuestionBank;
  reader?: ReadAnswers;
  limits?: Partial<AppLimits>;
  /** Reports whether the data store answers; used by /api/health so a deploy can tell the app is really working. */
  checkStore?: () => Promise<void>;
  version?: string;
}

/** Builds the app without starting it, so tests can run it on any port. */
export function createApp({ repos, auth, bank = loadQuestionBank(), reader, limits: given, checkStore, version = 'dev' }: AppDeps): express.Express {
  const limits = { ...DEFAULT_LIMITS, ...given };
  const app = express();
  app.disable('x-powered-by');
  // A phone photo is several MB once encoded, so the scan route reads a larger body than the rest of the API.
  app.use('/api/classes/:id/scan', express.json({ limit: `${limits.scanBodyMb}mb` }));
  app.use(express.json({ limit: `${limits.jsonBodyMb}mb` }));

  const requireLogin = authenticate(repos, auth);
  app.get('/api/health', async (_req, res) => {
    try {
      await checkStore?.();
      res.json({ ok: true, version, store: checkStore ? 'up' : 'memory' });
    } catch {
      res.status(503).json({ ok: false, version, store: 'down' });
    }
  });
  app.use('/api/auth', authRoutes(repos, auth, requireLogin, limits.loginPer15Min));
  app.use('/api', requireLogin,
    rosterRoutes(repos),
    classRoutes(repos, bank),
    worksheetRoutes(repos, createSheetService(repos, bank), { scanPerHour: limits.scanPerHour }, reader),
    contentRoutes(repos),
    peopleRoutes(repos, auth));

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });
  app.use(errorMiddleware);
  return app;
}
