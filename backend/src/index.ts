// Explicitly load .env from the backend directory. The dev wrapper
// script runs `npm run dev --workspace @fln/backend` from the repo root,
// so dotenv's default cwd lookup misses backend/.env and the backend
// silently falls back to the local file DB. This ensures the Atlas
// connection string is loaded regardless of how the script is started.
import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dotenv_dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dotenv_dir, '..', '.env') });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { dbStore, connectDB, UserRole, User, Student, School, Question, Worksheet, LevelWorksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Intervention, BestPractice, CYCLE_NAMES } from './db';
import { generateAIDiagnostic, evaluateAIDiagnostic, generateAIPersonalizedWorksheet, evaluateAIWorksheet } from './gemini';
import { generateDiagnosticPaper } from './paperGenerator';
import { generateQuestionsForLevel } from './levelGenerator';
import * as levelsBackendClient from './levelsBackendClient';
import { STATES_UTS } from './geoData';
import { validateConceptPrerequisites } from './competencyPrerequisites';
import { getAuthUser, canAccessStudent, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN, SEED_DEMO_PASSWORD_HASH } from './auth';
import { registerAnnouncementRoutes } from './routes/announcements';
import { registerStatsRoutes } from './routes/stats';
import { registerAuthRoutes } from './routes/auth';
import { registerTicketRoutes } from './routes/tickets';
import { registerLogbookRoutes } from './routes/logbook';
import { registerGeoRoutes } from './routes/geo';
import { registerClassRoutes } from './routes/classes';
import { registerAdminRoutes } from './routes/admin';
import { registerTeacherRoutes } from './routes/teachers';
import { registerSchoolRoutes } from './routes/schools';
import { registerInterventionRoutes } from './routes/interventions';
import { registerBestPracticeRoutes } from './routes/bestPractices';
import { registerStudentRoutes } from './routes/students';
import { registerWorksheetRoutes } from './routes/worksheets';
import { registerEvaluationRoutes } from './routes/evaluation';
import { registerAnalyticsRoutes } from './routes/analytics';
import { registerDiagnosticBulkRoutes } from './routes/diagnosticBulk';
import { registerMisconceptionRoutes } from './routes/misconceptions';
import { randomUUID } from 'crypto';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ROOT_DIR, PYTHON_BIN, AI_SERVICES_DIR } from './config';

// Safety net: the MongoDB driver occasionally rejects a connection AFTER
// connectDB() has returned (the client class keeps background pools
// alive). In ESM, an unhandled promise rejection exits the process by
// default. Swallow these so a transient Atlas outage doesn't kill the
// ICR/Ollama server, which can keep serving from the local file DB
// until the driver recovers.
process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled promise rejection (likely MongoDB driver):', reason);
});
process.on('uncaughtException', (err) => {
  console.warn('Uncaught exception (likely MongoDB driver):', err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  // Connect to MongoDB — connectDB() has its own internal 3-attempt
  // retry and falls back to a local file DB if all attempts fail. Wrap
  // the call in try/catch too so that any unhandledRejection from the
  // background driver doesn't exit the process.
  try {
    await connectDB();
  } catch (err: any) {
    console.warn('connectDB threw despite its fallback path: ' + (err?.message || err));
  }

  // Initialize file-based DB
  await dbStore.init();

  // Validate the prerequisite graph once at startup. The graph is a static,
  // compiled-in table, so any unknown conceptId or cycle in it is a build
  // error — fail loudly rather than silently emit malformed reasoning later.
  // Runs synchronously here so a bad graph prevents the server from
  // accepting requests, not just from rendering them correctly.
  const prereqReport = validateConceptPrerequisites();
  if (!prereqReport.isValid) {
    console.error('[competencyPrerequisites] prerequisite graph is INVALID at startup; refusing to start');
    console.error(`[competencyPrerequisites]   totalConceptsWithPrerequisites: ${prereqReport.totalConceptsWithPrerequisites}`);
    console.error(`[competencyPrerequisites]   totalEdges: ${prereqReport.totalEdges}`);
    if (prereqReport.unknownConceptIds.length > 0) {
      console.error(`[competencyPrerequisites]   unknownConceptIds (${prereqReport.unknownConceptIds.length}): ${prereqReport.unknownConceptIds.join(', ')}`);
    }
    for (const cycle of prereqReport.cycles) {
      console.error(`[competencyPrerequisites]   cycle: ${cycle.join(' -> ')}`);
    }
    process.exit(1);
  }
  console.log(`[competencyPrerequisites] prerequisite graph OK — ${prereqReport.totalConceptsWithPrerequisites} concepts, ${prereqReport.totalEdges} edges, 0 unknown ids, 0 cycles`);

  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Serve Puppeteer output PDF sheets statically
  app.use('/output', express.static(path.join(ROOT_DIR, 'output')));
  app.use('/worksheets', express.static(path.join(ROOT_DIR, 'public', 'worksheets')));

  // --- API Endpoints ---

registerStatsRoutes(app);

  registerAuthRoutes(app);
  registerAnnouncementRoutes(app);
  registerTicketRoutes(app);
  registerLogbookRoutes(app);

  registerAdminRoutes(app);

  registerGeoRoutes(app);

  registerTeacherRoutes(app);
  registerSchoolRoutes(app);

  // Classes
  registerClassRoutes(app);

  registerStudentRoutes(app);

  registerEvaluationRoutes(app);
  registerWorksheetRoutes(app);
  registerAnalyticsRoutes(app);
  registerDiagnosticBulkRoutes(app);

  // Read-only analysis over already-graded submissions: clusters a cohort on
  // HOW its children fail rather than how much they score.
  registerMisconceptionRoutes(app);

  // --- Intervention Tracking & Best Practices Repository ---

  // Create a new intervention
  registerInterventionRoutes(app);
  registerBestPracticeRoutes(app);

  // In development, serve the frontend using Vite development middleware.
  // In production, serve the built frontend bundle (frontend/dist).
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        root: path.resolve(ROOT_DIR, '..', 'frontend'),
        server: { middlewareMode: true, hmr: false },
        appType: "spa"
      });
      app.use(vite.middlewares);
      console.log("[AI Studio] Vite development middleware mounted successfully");
    } catch (err) {
      console.warn("[AI Studio] Failed to load Vite dev middleware, falling back to static:", err);
    }
  } else {
    const distPath =
      process.env.FRONTEND_DIST_DIR ||
      path.resolve(ROOT_DIR, '..', 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
