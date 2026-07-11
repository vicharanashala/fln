import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes.js';
import { errorHandler, notFoundHandler } from './core/middleware/errorHandler.js';

/** Build the Express app (no listening here — keeps it testable). */
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
