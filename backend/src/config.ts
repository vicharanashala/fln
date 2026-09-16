// Shared server-wide config, extracted from index.ts so route modules can
// import these without depending on index.ts itself (which would create a
// circular import once routes/*.ts are registered from index.ts).
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');

// Python evaluation pipeline: interpreter + location (the pipeline lives in ai-services/,
// a sibling of backend/). Both overridable by env for non-standard deployments.
const VENV_PYTHON = path.resolve(ROOT_DIR, '..', 'ai-services', '.venv', 'Scripts', 'python.exe');
export const PYTHON_BIN = process.env.PYTHON_BIN || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : (process.platform === 'win32' ? 'python' : 'python3'));
export const AI_SERVICES_DIR = process.env.AI_SERVICES_DIR || path.resolve(ROOT_DIR, '..', 'ai-services');

// Throttle auth endpoints to slow down brute-force / credential-stuffing attempts.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});
