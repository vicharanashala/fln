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
import { registerAadhaarDetokenizeRoutes } from './routes/aadhaarDetokenize';
import { registerMfaEnrollmentRoutes } from './routes/mfaEnrollment';
import { registerWorksheetRoutes } from './routes/worksheets';
import { registerEvaluationRoutes } from './routes/evaluation';
import { registerAnalyticsRoutes } from './routes/analytics';
import { registerQuestionLogicRoutes } from './routes/questionLogics';
import { registerQuestionTemplateRoutes } from './routes/questionTemplates';
import { registerQuestionOptionRoutes } from './routes/questionOptions';
import { registerDiagnosticBulkRoutes } from './routes/diagnosticBulk';
import { registerMisconceptionRoutes } from './routes/misconceptions';
import { registerCurriculumRoutes } from './routes/curriculum';
import { registerQuestionBankRoutes } from './routes/questionBank';
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

// ---------------------------------------------------------------------------
// Phase 6 — Graceful shutdown
// ---------------------------------------------------------------------------
// Sequence on SIGTERM / SIGINT (e.g. `kill <pid>`, container stop,
// dev Ctrl+C in a foreground shell):
//
//   1. Log the signal; ignore subsequent signals of the same kind so
//      a double-tap does not race the in-flight drain.
//   2. `server.close()` — stop accepting new connections, but allow
//      in-flight HTTP requests (including any vault tokenize /
//      step-up transactions) to finish naturally. Express's
//      `app.listen` returns an `http.Server`; its `close` callback
//      fires when every active socket has closed.
//   3. `waitForVaultTransactionsDrain(DRAIN_TIMEOUT_MS)` — defensive
//      barrier in case a future refactor moves a vault write out of
//      the HTTP-request scope. With the current architecture this
//      resolves instantly after step 2, but the explicit barrier
//      makes the invariant ("Mongo is not closed mid-transaction")
//      visible in the source.
//   4. Close the Mongo client (if any). This is the *only* call that
//      would orphan an in-flight transaction; doing it last means a
//      SIGTERM never tears down a write that is mid-commit.
//   5. `process.exit(0)` — explicit so the exit code is 0 even when
//      the drain timed out (so a stuck transaction reports as a
//      shutdown timeout in the logs, not as a non-zero exit that
//      orchestrators like Kubernetes treat as a crash).
//
// Hard timeout: if the drain + Mongo close takes longer than
// `SHUTDOWN_HARD_TIMEOUT_MS`, the process exits with code 1 so a
// wedged Mongo socket cannot hold the process open forever. The
// exit code is logged so post-mortems can attribute the cause.
const DRAIN_TIMEOUT_MS = 30_000;
const SHUTDOWN_HARD_TIMEOUT_MS = 45_000;
let shuttingDown = false;
async function gracefulShutdown(signal: NodeJS.Signals, httpServer: import('http').Server | null) {
  if (shuttingDown) {
    console.warn(`[shutdown] received ${signal} again while already shutting down — ignoring`);
    return;
  }
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, beginning graceful shutdown`);

  // Hard timeout safety net.
  const hardTimeout = setTimeout(() => {
    console.error(
      `[shutdown] hard timeout (${SHUTDOWN_HARD_TIMEOUT_MS}ms) reached; forcing exit(1).`,
    );
    process.exit(1);
  }, SHUTDOWN_HARD_TIMEOUT_MS);
  hardTimeout.unref();

  try {
    // 2. Stop accepting new connections; wait for in-flight HTTP.
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close(err => (err ? reject(err) : resolve()));
      });
    }

    // 3. Drain in-flight vault transactions (defensive; should be
    //    a no-op because every vault write is awaited inside an
    //    HTTP handler that server.close() already waited for).
    try {
      const {
        getActiveVaultTransactionCount,
        waitForVaultTransactionsDrain,
      } = await import('./modules/vault');
      const pending = getActiveVaultTransactionCount();
      if (pending > 0) {
        console.log(`[shutdown] waiting for ${pending} in-flight vault transaction(s) to complete`);
      }
      const drained = await waitForVaultTransactionsDrain(DRAIN_TIMEOUT_MS);
      if (!drained) {
        console.warn(
          `[shutdown] vault transaction drain timed out after ${DRAIN_TIMEOUT_MS}ms; ` +
            `${getActiveVaultTransactionCount()} still pending. Mongo will be closed anyway.`,
        );
      }
    } catch (err) {
      // Module import failed (build corruption?). The legacy HTTP
      // path had nothing to drain either; the comment is kept so a
      // post-mortem reading the code sees the same invariant.
      console.warn('[shutdown] vault drain module not loadable:', err);
    }

    // 4. Close the Mongo client. Re-imports here so the static
    //    closure above does not pin a stale client reference.
    const { mongoClient } = await import('./db');
    if (mongoClient) {
      try {
        await mongoClient.close();
        console.log('[shutdown] Mongo client closed');
      } catch (err) {
        console.warn('[shutdown] Mongo client close failed:', err);
      }
    }

    console.log('[shutdown] complete');
  } catch (err) {
    console.error('[shutdown] error during shutdown sequence:', err);
  } finally {
    clearTimeout(hardTimeout);
    process.exit(0);
  }
}

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
  // Admin Step-Up detokenization (Aadhaar Vault — see aadhaarDetokenize.ts).
  registerAadhaarDetokenizeRoutes(app);
  // Account-level MFA enrollment (Wave 2A — see mfaEnrollment.ts).
  registerMfaEnrollmentRoutes(app);

  // In-process vault module — the only path (Phase 7 deletion of the
  // standalone Fastify+Postgres microservice is complete). Always wired;
  // the module is built and its routes are mounted unconditionally.
  const { registerVaultRoutes } = await import('./modules/vault');
  await registerVaultRoutes(app);

  registerEvaluationRoutes(app);
  registerWorksheetRoutes(app);
  registerAnalyticsRoutes(app);
  registerQuestionLogicRoutes(app);
  registerQuestionTemplateRoutes(app);
  registerQuestionOptionRoutes(app);
  registerDiagnosticBulkRoutes(app);

  // Read-only analysis over already-graded submissions: clusters a cohort on
  // HOW its children fail rather than how much they score.
  registerMisconceptionRoutes(app);
  registerCurriculumRoutes(app);
  registerQuestionBankRoutes(app);

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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Phase 6 — register the graceful-shutdown handlers. The same
  // `server` handle is passed in so `server.close()` can drain
  // every in-flight HTTP request. SIGTERM is the orchestrator
  // signal (Kubernetes, Docker stop, systemd); SIGINT is the dev
  // signal (Ctrl+C in a foreground shell). Both are wired to the
  // same handler.
  process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM', server); });
  process.on('SIGINT', () => { void gracefulShutdown('SIGINT', server); });
}

startServer();
