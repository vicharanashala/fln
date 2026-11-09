import express from 'express';
import { authenticate, type AuthConfig } from './auth';
import { errorMiddleware } from './http';
import type { Repos } from './repos';
import { authRoutes } from './routes/auth';
import type { ReadAnswers } from './ollama';
import { loadQuestionBank, type QuestionBank } from './questionBank';
import { rosterRoutes } from './routes/roster';
import { teacherRoutes } from './routes/teacher';

export interface AppDeps { repos: Repos; auth: AuthConfig; bank?: QuestionBank; reader?: ReadAnswers }

/** Builds the app without starting it, so tests can run it on any port. */
export function createApp({ repos, auth, bank = loadQuestionBank(), reader }: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // A phone photo is several MB once encoded, so the scan route reads a larger body than the rest of the API.
  app.use('/api/classes/:id/scan', express.json({ limit: '9mb' }));
  app.use(express.json({ limit: '1mb' }));

  const requireLogin = authenticate(repos, auth);
  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  app.use('/api/auth', authRoutes(repos, auth, requireLogin));
  app.use('/api', requireLogin, rosterRoutes(repos), teacherRoutes(repos, bank, reader));

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });
  app.use(errorMiddleware);
  return app;
}
