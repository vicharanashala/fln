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
import { dbStore, connectDB, UserRole, User, Student, School, Question, Worksheet, LevelWorksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Intervention, BestPractice, PracticeSchedule, MicroAssignment, UploadedPaper, CYCLE_NAMES } from './db';
import { generateAIDiagnostic, evaluateAIDiagnostic, generateAIPersonalizedWorksheet, evaluateAIWorksheet } from './gemini';
import { generateDiagnosticPaper } from './paperGenerator';
import { generateQuestionsForLevel } from './levelGenerator';
import { getStrandForLevel, mapCompetencyToLevel, KNOWN_COMPETENCIES, getSubsCountForLevel, getNextLevelInStrand } from './flnLevels';
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
import { getOrInitPracticeSchedule, normalizeCompetencyName } from './services/practiceScheduleService';
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

// execFileSync throws on non-zero exit before we can read stdout normally.
// Our Python scripts print a JSON error line to stdout before exiting
// non-zero on failure, so pull the real message out of e.stdout instead of
// using execFileSync's generic "Command failed: ..." wrapper text. Used by
// /api/icr/rasterize-pdf below, which has no routes/*.ts equivalent.
function extractPythonScriptError(e: any, fallbackPrefix: string): string {
  const stdout: string = typeof e?.stdout === 'string' ? e.stdout : (e?.stdout ? String(e.stdout) : '');
  const lastLine = stdout.trim().split('\n').filter(Boolean).pop();
  if (lastLine) {
    try {
      const parsed = JSON.parse(lastLine);
      if (parsed && parsed.error) return parsed.error;
    } catch {
      // not JSON — fall through to the generic message
    }
  }
  return `${fallbackPrefix}: ${e?.message || e}`;
}


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

  // Rasterizes an uploaded PDF to plain PNG data URL(s) — nothing else. Used
  // by the micro-practice paper-upload flow so it can run jsQR (which only
  // reads pixel data, not PDFs) against a PDF-scanned completed paper.
  // Deliberately does NOT chain the blue-ink filter that /api/icr/filter
  // runs afterward — that step isolates handwritten blue pen and explicitly
  // discards printed text (per bluepen_filter.py's own docstring), which
  // would destroy a printed QR code.
  //
  // Default (allPages absent/false): rasterizes page 1 only, returns a
  // single `imageDataUrl` — unchanged, backward-compatible behavior.
  // allPages: true: rasterizes every page, returns `imageDataUrls` (array,
  // one per page) instead — used for multi-page PDFs that may contain
  // multiple different students' papers, one per page.
  app.post('/api/icr/rasterize-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { fileBase64, allPages } = req.body || {};
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'fileBase64 is required.' });
    }
    const pdfMatch = /^data:application\/pdf;base64,(.+)$/.exec(fileBase64);
    if (!pdfMatch) {
      return res.status(400).json({ error: 'fileBase64 must be a base64-encoded PDF data URL.' });
    }
    const buf = Buffer.from(pdfMatch[1], 'base64');
    if (buf.length === 0) {
      return res.status(400).json({ error: 'fileBase64 decoded to zero bytes.' });
    }
    if (buf.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 8 MB).' });
    }

    const tempDir = path.join(AI_SERVICES_DIR, 'scratch');
    fs.mkdirSync(tempDir, { recursive: true });
    const stamp = Date.now() + '_' + randomUUID().slice(0, 8);
    const inputPath = path.join(tempDir, `rasterize_${stamp}_in.pdf`);
    const outputPath = path.join(tempDir, `rasterize_${stamp}_out.png`);
    // pdf_rasterize.py's --all-pages mode treats its output argument as a
    // DIRECTORY (writes page_1.png, page_2.png, ... inside it) — a distinct
    // path from outputPath's single-file usage in the non-allPages case.
    const pagesDir = path.join(tempDir, `rasterize_${stamp}_pages`);
    const pageOutputPaths: string[] = [];

    try {
      fs.writeFileSync(inputPath, buf);

      const rasterScript = path.join(AI_SERVICES_DIR, 'scripts', 'pdf_rasterize.py');
      const { execFileSync } = await import('child_process');
      const scriptArgs = [rasterScript, inputPath, allPages ? pagesDir : outputPath];
      if (allPages) scriptArgs.push('--all-pages');
      let stdout: string;
      try {
        stdout = execFileSync(
          PYTHON_BIN,
          scriptArgs,
          { cwd: AI_SERVICES_DIR, timeout: 30000, encoding: 'utf8' }
        );
      } catch (e: any) {
        return res.status(500).json({ success: false, error: extractPythonScriptError(e, 'PDF rasterization failed') });
      }
      const jsonLine = stdout.trim().split('\n').filter(Boolean).pop() || '{}';
      let parsed: any = {};
      try {
        parsed = JSON.parse(jsonLine);
      } catch {
        return res.status(500).json({ success: false, error: `PDF rasterizer returned non-JSON: ${stdout.slice(0, 300)}` });
      }
      if (!parsed.success) {
        return res.status(500).json({ success: false, error: parsed.error || 'PDF rasterization failed.' });
      }

      if (allPages) {
        const pages: Array<{ output_path: string; page_number: number }> = parsed.pages || [];
        const imageDataUrls = pages.map(p => {
          pageOutputPaths.push(p.output_path);
          const pngBuf = fs.readFileSync(p.output_path);
          return `data:image/png;base64,${pngBuf.toString('base64')}`;
        });
        return res.json({
          success: true,
          imageDataUrls,
          pageCount: pages.length
        });
      }

      const pngBuf = fs.readFileSync(outputPath);
      res.json({
        success: true,
        imageDataUrl: `data:image/png;base64,${pngBuf.toString('base64')}`,
        pageSize: parsed.page_size
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[icr-rasterize-pdf] failed:', msg);
      res.status(500).json({ success: false, error: msg });
    } finally {
      try { fs.unlinkSync(inputPath); } catch { /* noop */ }
      try { fs.unlinkSync(outputPath); } catch { /* noop */ }
      for (const p of pageOutputPaths) { try { fs.unlinkSync(p); } catch { /* noop */ } }
      try { fs.rmSync(pagesDir, { recursive: true, force: true }); } catch { /* noop */ }
    }
  });

  // --- Intervention Tracking & Best Practices Repository ---

  // Create a new intervention
  registerInterventionRoutes(app);
  registerBestPracticeRoutes(app);

  // --- Adaptive Micro-Practice & Spaced-Repetition ---

  // Shared logic for weak-competency lookup — used by both
  // GET /api/students/:id/weak-competencies (single-student UI lookup) and
  // POST /api/practice/bulk-generate (class-wide generation, below).
  async function getWeakCompetenciesForStudent(studentId: string) {
    const reports = await dbStore.getEvaluationReports();
    const studentReports = reports
      .filter(r => r.studentId === studentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (studentReports.length === 0) {
      return { hasEvaluationData: false, weakCompetencies: [] as string[], fullMastery: undefined as any, latestReportDate: null as string | null };
    }

    const latest = studentReports[0];
    const weak = Array.from(new Set(
      Object.entries(latest.conceptMastery || {})
        .filter(([_, status]) => status === 'Needs Practice')
        .map(([topic]) => normalizeCompetencyName(topic))
    ));

    return {
      hasEvaluationData: true,
      weakCompetencies: weak,
      fullMastery: latest.conceptMastery,
      latestReportDate: latest.timestamp
    };
  }

  // Weak competencies for one student, derived from their most recent
  // evaluation report's conceptMastery breakdown. Used by the generate-paper
  // form to scope the competency dropdown to the student's actual weak areas.
  app.get('/api/students/:id/weak-competencies', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    res.json(await getWeakCompetenciesForStudent(req.params.id));
  });

  // Generate a lightweight, single-section printable PDF for one micro-practice
  // question set (see generateMicroPracticePaper in paperGenerator.ts). Distinct
  // from /api/worksheets/generate-level-pdf, which renders the full multi-section
  // level worksheet.
  app.post('/api/students/:id/micro-practice/generate-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const { competency, sectionIndex, questionCount, levelId: overrideLevelId, subIdx: overrideSubIdx } = req.body;
    if (sectionIndex == null || questionCount == null) {
      return res.status(400).json({ error: 'sectionIndex and questionCount are required.' });
    }
    if (!Number.isInteger(Number(questionCount)) || Number(questionCount) < 1) {
      return res.status(400).json({ error: 'questionCount must be a positive integer.' });
    }

    // Two ways to pick the level/subIdx to generate:
    //  - competency (the normal, adaptive path): resolved from the student's
    //    PracticeSchedule for that competency — their real current position,
    //    not always the strand's easiest level. Blocked once resolved: true,
    //    since there's no harder real content left to generate.
    //  - explicit levelId+subIdx (manual override): a teacher deliberately
    //    targeting a specific level, bypassing the schedule entirely — the
    //    schedule is neither read nor advanced by this path.
    let levelId: number, subIdx: number;
    if (overrideLevelId != null && overrideSubIdx != null) {
      levelId = Number(overrideLevelId);
      subIdx = Number(overrideSubIdx);
    } else {
      if (!competency) {
        return res.status(400).json({ error: 'competency is required (or supply levelId and subIdx directly to override the schedule).' });
      }
      let schedule: PracticeSchedule;
      try {
        schedule = await getOrInitPracticeSchedule(student.id, student.name, user.id, competency);
      } catch (err: any) {
        return res.status(400).json({ error: err.message });
      }
      if (schedule.resolved) {
        return res.status(409).json({ error: `${competency} is fully mastered for this student — no further levels available.` });
      }
      levelId = schedule.currentLevelId!;
      subIdx = schedule.currentSubIdx || 0;
    }

    try {
      const { generateMicroPracticePaper } = await import('./paperGenerator');
      const result = await generateMicroPracticePaper({
        studentId: student.id,
        studentName: student.name,
        studentClass: `${student.classGroup} - ${student.section}`,
        levelId,
        subIdx,
        sectionIndex: Number(sectionIndex),
        questionCount: Number(questionCount)
      });

      // Persist the real, generation-time answer key so it can be looked up
      // later by paperId (see GET /api/practice/paper/:paperId below) instead
      // of re-running generateMicroSet, which would produce different random
      // question values on a second call.
      await dbStore.addMicroPracticePaper({
        id: result.paperId,
        studentId: student.id,
        studentName: student.name,
        competency: getStrandForLevel(levelId),
        levelId,
        subIdx,
        sectionIndex: Number(sectionIndex),
        questionCount: Number(questionCount),
        questions: result.questions,
        pdfUrl: result.pdfUrl,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, pdfUrl: result.pdfUrl, paperId: result.paperId, levelId, subIdx });
    } catch (err: any) {
      console.error('Micro-practice PDF generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate ONE combined printable PDF covering multiple weak competencies
  // for a single student (see generateMultiCompetencyMicroPaper in
  // paperGenerator.ts). Distinct from /api/students/:id/micro-practice/generate-pdf,
  // which covers exactly one competency per paper.
  app.post('/api/students/:id/micro-practice/generate-multi-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const { competencies, questionsPerCompetency } = req.body;
    if (!Array.isArray(competencies) || competencies.length === 0) {
      return res.status(400).json({ error: 'competencies must be a non-empty array.' });
    }
    if (!Number.isInteger(Number(questionsPerCompetency)) || Number(questionsPerCompetency) < 1) {
      return res.status(400).json({ error: 'questionsPerCompetency must be a positive integer.' });
    }

    try {
      const { resolved, masteredCompetencies } = await resolveCompetencyLevels(
        student.id, student.name, user.id, competencies
      );
      if (resolved.length === 0) {
        return res.status(409).json({
          error: `All requested competencies (${masteredCompetencies.join(', ')}) are fully mastered for this student — no further levels available.`
        });
      }

      const { generateMultiCompetencyMicroPaper } = await import('./paperGenerator');
      const result = await generateMultiCompetencyMicroPaper({
        studentId: student.id,
        studentName: student.name,
        studentClass: `${student.classGroup} - ${student.section}`,
        competencyLevels: resolved,
        questionsPerCompetency: Number(questionsPerCompetency)
      });

      await dbStore.addMicroPracticePaper({
        id: result.paperId,
        studentId: student.id,
        studentName: student.name,
        pdfUrl: result.pdfUrl,
        createdAt: new Date().toISOString(),
        parts: result.parts
      });

      res.json({
        success: true,
        pdfUrl: result.pdfUrl,
        paperId: result.paperId,
        ...(masteredCompetencies.length ? { skippedMasteredCompetencies: masteredCompetencies } : {})
      });
    } catch (err: any) {
      console.error('Multi-competency micro-practice PDF generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  interface MicroBulkJob {
    jobId: string;
    total: number;
    completed: number;
    status: 'running' | 'completed' | 'failed';
    results: any[];
    combinedPdfUrl: string | null;
    zipUrl: string | null;
    error: string;
  }

  const microBulkJobs = new Map<string, MicroBulkJob>();

  // Generates a personalized multi-competency micro-practice paper for every
  // student in studentIds, in one action. Students with no weak competencies
  // on record (not yet diagnosed) are skipped, not failed. One student's
  // failure — missing student, forbidden access, or a generation error —
  // does not stop the rest of the batch from processing.
  //
  // Runs as a background job (same pattern as /api/diagnostic/bulk) rather
  // than blocking the request until every student is done, so the frontend
  // can poll GET /api/practice/bulk-generate/:jobId/progress for a live
  // completed/total counter instead of waiting on one long request.
  app.post('/api/practice/bulk-generate', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentIds, questionsPerCompetency, studentCompetencyOverrides } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds must be a non-empty array.' });
    }
    if (!Number.isInteger(Number(questionsPerCompetency)) || Number(questionsPerCompetency) < 1) {
      return res.status(400).json({ error: 'questionsPerCompetency must be a positive integer.' });
    }

    const jobId = 'microbulk_' + randomUUID();
    const job: MicroBulkJob = {
      jobId,
      total: studentIds.length,
      completed: 0,
      status: 'running',
      results: [],
      combinedPdfUrl: null,
      zipUrl: null,
      error: ''
    };
    microBulkJobs.set(jobId, job);

    // Run in background — the response below is sent immediately, before
    // any student's paper has been generated.
    (async () => {
      try {
        const students = await dbStore.getStudents();
        const generatedFiles: { studentId: string; studentName: string; filePath: string }[] = [];

        for (const studentId of studentIds) {
          const student = students.find(s => s.id === studentId);
          if (!student) {
            job.results.push({ studentId, studentName: null, skipped: true, reason: 'Student not found.' });
            job.completed++;
            continue;
          }
          if (!canAccessStudent(user, student)) {
            job.results.push({ studentId, studentName: student.name, skipped: true, reason: 'Forbidden.' });
            job.completed++;
            continue;
          }

          try {
            // A caller-supplied override (e.g. "papers due today") takes the
            // exact competency list as given — it already implies real
            // schedule/evaluation history, so the "not yet diagnosed" skip
            // below only applies when falling back to the full weak-competency
            // list from the student's latest evaluation report.
            const overrideCompetencies = studentCompetencyOverrides?.[studentId];
            let competencies: string[];
            if (Array.isArray(overrideCompetencies) && overrideCompetencies.length > 0) {
              competencies = overrideCompetencies;
            } else {
              const weakData = await getWeakCompetenciesForStudent(studentId);
              if (!weakData.weakCompetencies || weakData.weakCompetencies.length === 0) {
                job.results.push({ studentId, studentName: student.name, skipped: true, reason: 'Not yet diagnosed' });
                job.completed++;
                continue;
              }
              competencies = weakData.weakCompetencies;
            }

            const { resolved, masteredCompetencies } = await resolveCompetencyLevels(
              student.id, student.name, user.id, competencies
            );
            if (resolved.length === 0) {
              job.results.push({
                studentId, studentName: student.name, skipped: true,
                reason: `All weak competencies (${masteredCompetencies.join(', ')}) are fully mastered.`
              });
              job.completed++;
              continue;
            }

            const { generateMultiCompetencyMicroPaper } = await import('./paperGenerator');
            const result = await generateMultiCompetencyMicroPaper({
              studentId: student.id,
              studentName: student.name,
              studentClass: `${student.classGroup} - ${student.section}`,
              competencyLevels: resolved,
              questionsPerCompetency: Number(questionsPerCompetency)
            });

            await dbStore.addMicroPracticePaper({
              id: result.paperId,
              studentId: student.id,
              studentName: student.name,
              pdfUrl: result.pdfUrl,
              createdAt: new Date().toISOString(),
              parts: result.parts
            });

            job.results.push({ studentId, studentName: student.name, skipped: false, pdfUrl: result.pdfUrl, paperId: result.paperId });
            generatedFiles.push({ studentId: student.id, studentName: student.name, filePath: result.filePath });
          } catch (err: any) {
            console.error(`Bulk micro-practice generation failed for student ${studentId}:`, err);
            job.results.push({ studentId, studentName: student.name, skipped: true, reason: err.message || 'Generation failed.' });
          }
          job.completed++;
        }

        if (generatedFiles.length > 0) {
          try {
            const { mergeMicroPracticePdfs, zipMicroPracticePdfs } = await import('./paperGenerator');
            const merged = await mergeMicroPracticePdfs(generatedFiles.map(f => f.filePath));
            job.combinedPdfUrl = merged.pdfUrl;

            const zipped = await zipMicroPracticePdfs(generatedFiles.map(f => ({
              fileName: `${f.studentName.replace(/\s+/g, '_')}_${f.studentId}.pdf`,
              filePath: f.filePath
            })));
            job.zipUrl = zipped.zipUrl;
          } catch (err: any) {
            console.error('Bulk combined PDF/ZIP creation failed:', err);
          }
        }

        job.status = 'completed';
      } catch (err: any) {
        job.status = 'failed';
        job.error = err?.message || 'Unknown error during bulk generation.';
        console.error('Micro-practice bulk job failed:', err);
      }
    })();

    res.status(202).json({
      jobId,
      total: job.total,
      status: 'running',
      progressUrl: `/api/practice/bulk-generate/${jobId}/progress`
    });
  });

  // Poll a micro-practice bulk-generation job's progress. Returns results/
  // combinedPdfUrl/zipUrl directly once status is 'completed' — no separate
  // download route, since outputs are already static-served /output/... URLs
  // (unlike /api/diagnostic/bulk's res.download() pattern).
  app.get('/api/practice/bulk-generate/:jobId/progress', (req, res) => {
    const job = microBulkJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    res.json({
      jobId: job.jobId,
      total: job.total,
      completed: job.completed,
      status: job.status,
      results: job.results,
      combinedPdfUrl: job.combinedPdfUrl,
      zipUrl: job.zipUrl,
      error: job.error
    });
  });

  // Looks up the real, generation-time answer key for a printed micro-practice
  // paper by its paperId (embedded in the paper's QR code). Used by the manual
  // answer-entry flow after a photo is uploaded and decoded — deliberately
  // NOT re-running generateMicroSet, since its generators are unseeded random
  // and would produce different questions/answers than what was printed.
  app.get('/api/practice/paper/:paperId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const paper = await dbStore.getMicroPracticePaperById(req.params.paperId);
    if (!paper) return res.status(404).json({ error: 'Micro-practice paper not found.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === paper.studentId);
    if (student && !canAccessStudent(user, student)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    // Merge in any saved draft answers from the matching UploadedPaper record
    // (a different collection, keyed by the same paperId) so the answer-entry
    // screen can pre-fill a partially-completed session.
    const uploadedPaper = await dbStore.getUploadedPaperByPaperId(req.params.paperId);
    res.json({ ...paper, draftAnswers: uploadedPaper?.draftAnswers });
  });

  // Saves in-progress, ungraded answers against the matching UploadedPaper
  // record so a teacher can resume grading later. Deliberately does not
  // touch gradingStatus/gradedCompetencies — this is a raw draft, not a
  // submission.
  app.patch('/api/practice/paper/:paperId/save-draft', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers is required.' });
    }

    const uploadedPaper = await dbStore.getUploadedPaperByPaperId(req.params.paperId);
    if (!uploadedPaper) return res.status(404).json({ error: 'Uploaded paper not found.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === uploadedPaper.studentId);
    if (student && !canAccessStudent(user, student)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    await dbStore.updateUploadedPaper(uploadedPaper.id, { draftAnswers: answers });
    res.json({ success: true });
  });

  // Pre-flight check for the paper-upload batch UI: given the paperIds
  // decoded client-side from a set of QR codes (before any image is
  // actually uploaded), reports which ones already have an UploadedPaper
  // record — and whether that record is still 'pending' (offer to replace)
  // or already 'graded' (nothing to do but skip). Scoped with the same
  // canAccessStudent check as the upload route itself, so this can't be
  // used to probe grading status of students outside the caller's roster.
  app.post('/api/practice/upload-paper/check-duplicates', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { paperIds } = req.body;
    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ error: 'paperIds must be a non-empty array.' });
    }

    const [existing, students] = await Promise.all([
      dbStore.getUploadedPapersByPaperIds(paperIds),
      dbStore.getStudents()
    ]);

    const duplicates = existing
      .filter(p => {
        const student = students.find(s => s.id === p.studentId);
        return !!student && canAccessStudent(user, student);
      })
      .map(p => ({
        paperId: p.paperId,
        studentName: p.studentName,
        status: p.gradingStatus,
        uploadedPaperId: p.id
      }));

    res.json({ duplicates });
  });

  // Stores an uploaded photo of a completed micro-practice paper. No image
  // processing/QR-decoding happens here — the frontend already decoded the
  // paper's QR code before calling this; these fields are just echoed back
  // (with the resolved competency added) so the frontend can hand off a
  // fully-identified paper to the next step. Also persists an UploadedPaper
  // record (gradingStatus: 'pending') when paperId + studentId are present,
  // so an uploaded-but-ungraded paper can be found later via
  // GET /api/practice/pending-papers instead of only living in-memory for
  // the current browser session.
  //
  // An optional replaceUploadedPaperId (from the check-duplicates flow above)
  // means the teacher confirmed replacing a still-pending duplicate: the
  // existing record is updated in place (new image, same id/uploadedAt/
  // uploadBatchId) instead of inserting a second row for the same paperId.
  app.post('/api/practice/upload-paper', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { imageBase64, imageBase64s, filename, paperId, studentId, studentName, levelId, subIdx, sectionIndex, questionCount, uploadBatchId, replaceUploadedPaperId } = req.body;
    const images: string[] = Array.isArray(imageBase64s) && imageBase64s.length > 0
      ? imageBase64s
      : (imageBase64 ? [imageBase64] : []);
    if (images.length === 0) {
      return res.status(400).json({ error: 'imageBase64 or imageBase64s is required.' });
    }

    if (studentId) {
      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });
    }

    // Re-check the replace target's status right before writing — it may
    // have been graded in the gap between the check-duplicates call and this
    // upload (e.g. another tab graded it), in which case silently
    // overwriting its image would be wrong; the teacher needs to know it's
    // no longer a pending duplicate.
    let replaceTarget: UploadedPaper | undefined;
    if (replaceUploadedPaperId) {
      replaceTarget = await dbStore.getUploadedPaperById(replaceUploadedPaperId);
      if (!replaceTarget) {
        return res.status(404).json({ error: 'The paper to replace no longer exists.' });
      }
      if (replaceTarget.gradingStatus !== 'pending') {
        return res.status(409).json({ error: 'This paper has already been graded and can no longer be replaced.' });
      }
    }

    try {
      const uploadsDir = path.join(ROOT_DIR, 'output', 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true });

      const safeStudentPart = studentId ? `_${String(studentId).replace(/[^a-zA-Z0-9_-]+/g, '')}` : '';
      let savedFileName: string;
      let savedFilePath: string;

      if (images.length > 1) {
        // Multiple page images belonging to one paper (a multi-page scan,
        // all sharing the same paperId QR) — merge into a single PDF so
        // nothing beyond page 1 is lost.
        const { mergeImagesIntoPdf } = await import('./paperGenerator');
        const mergedBuffer = await mergeImagesIntoPdf(images);
        savedFileName = `paper${safeStudentPart}_${randomUUID()}.pdf`;
        savedFilePath = path.join(uploadsDir, savedFileName);
        fs.writeFileSync(savedFilePath, mergedBuffer);
      } else {
        const ext = path.extname(filename || 'paper.jpg') || '.jpg';
        savedFileName = `paper${safeStudentPart}_${randomUUID()}${ext}`;
        savedFilePath = path.join(uploadsDir, savedFileName);
        const cleanBase64 = images[0].includes(',') ? images[0].split(',')[1] : images[0];
        fs.writeFileSync(savedFilePath, Buffer.from(cleanBase64, 'base64'));
      }

      const imageUrl = `/output/uploads/${savedFileName}`;

      let uploadedPaperId: string | null = null;
      if (replaceTarget) {
        // Replace in place: keep the record's id/uploadedAt/uploadBatchId so
        // it stays the same row in the pending-papers list, just pointing at
        // the new image. The old photo was presumably wrong/unreadable —
        // delete it from disk (best-effort; a failure here shouldn't fail
        // the upload itself, it just leaves one orphaned file).
        await dbStore.updateUploadedPaper(replaceTarget.id, {
          imageUrl,
          studentName: studentName || replaceTarget.studentName
        });
        uploadedPaperId = replaceTarget.id;
        try {
          const oldFilePath = path.join(ROOT_DIR, replaceTarget.imageUrl.replace(/^\//, ''));
          fs.unlinkSync(oldFilePath);
        } catch (unlinkErr) {
          console.warn('Failed to delete replaced paper image (non-fatal):', unlinkErr);
        }
      } else if (paperId && studentId) {
        const sourcePaper = await dbStore.getMicroPracticePaperById(paperId);
        const totalParts = sourcePaper?.parts?.length || 1;
        const uploadedPaper: UploadedPaper = {
          id: 'upl_' + randomUUID().slice(0, 8),
          paperId,
          studentId,
          studentName: studentName || '',
          imageUrl,
          teacherId: user.id,
          uploadedAt: new Date().toISOString(),
          ...(uploadBatchId ? { uploadBatchId } : {}),
          gradingStatus: 'pending',
          totalParts,
          gradedCompetencies: []
        };
        await dbStore.addUploadedPaper(uploadedPaper);
        uploadedPaperId = uploadedPaper.id;
      }

      res.json({
        success: true,
        imageUrl,
        uploadedPaperId,
        paperId: paperId || null,
        studentId: studentId || null,
        studentName: studentName || null,
        levelId: levelId != null ? Number(levelId) : null,
        subIdx: subIdx != null ? Number(subIdx) : null,
        sectionIndex: sectionIndex != null ? Number(sectionIndex) : null,
        questionCount: questionCount != null ? Number(questionCount) : null,
        competency: levelId != null ? getStrandForLevel(Number(levelId)) : null
      });
    } catch (err: any) {
      console.error('Micro-practice paper upload failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Three-tier scoring/scheduling against REAL content position (levelId +
  // subIdx in the 59-level micro-practice system), not an abstract counter:
  // >=80% advances to the next subIdx within the current level; once that
  // level's variations are exhausted, moves to the next-harder level in the
  // same strand (getNextLevelInStrand) and resets to subIdx 0; if no next
  // level exists either (the strand's hardest level, exhausted), the
  // competency is resolved — no further real content to advance to. 50-79%
  // is a "hold" tier — no change to levelId/subIdx or interval; <50% halves
  // the interval (min 1 day) without moving position backward. In all
  // cases the interval only ever grows on a good score (max 30 days) and
  // only ever shrinks on a poor one — never on a hold.
  function calculateNextScheduleState(
    currentIntervalDays: number,
    currentLevelId: number,
    currentSubIdx: number,
    correctCount: number,
    totalCount: number
  ): { intervalDays: number; levelId: number; subIdx: number; resolved: boolean } {
    const scorePercent = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    if (scorePercent >= 80) {
      const intervalDays = Math.min(30, currentIntervalDays * 2);
      const subsInLevel = getSubsCountForLevel(currentLevelId) ?? 1;

      if (currentSubIdx + 1 < subsInLevel) {
        return { intervalDays, levelId: currentLevelId, subIdx: currentSubIdx + 1, resolved: false };
      }
      const nextLevelId = getNextLevelInStrand(currentLevelId);
      if (nextLevelId != null) {
        return { intervalDays, levelId: nextLevelId, subIdx: 0, resolved: false };
      }
      return { intervalDays, levelId: currentLevelId, subIdx: currentSubIdx, resolved: true };
    }

    if (scorePercent >= 50) {
      return { intervalDays: currentIntervalDays, levelId: currentLevelId, subIdx: currentSubIdx, resolved: false };
    }

    return { intervalDays: Math.max(1, Math.floor(currentIntervalDays / 2)), levelId: currentLevelId, subIdx: currentSubIdx, resolved: false };
  }


  // Resolves each competency in a list to the student's real current
  // levelId/subIdx (creating/backfilling each schedule as needed via
  // getOrInitPracticeSchedule), splitting out any that are already resolved
  // (fully mastered — no further real content to generate a paper for).
  // Shared by the multi-competency single-paper route and the bulk-generate
  // job below, since both build a "Part N: <competency>" paper the same way.
  async function resolveCompetencyLevels(
    studentId: string, studentName: string, teacherId: string, competencies: string[]
  ): Promise<{ resolved: { competency: string; levelId: number; subIdx: number }[]; masteredCompetencies: string[] }> {
    const resolved: { competency: string; levelId: number; subIdx: number }[] = [];
    const masteredCompetencies: string[] = [];
    for (const competency of competencies) {
      const schedule = await getOrInitPracticeSchedule(studentId, studentName, teacherId, competency);
      if (schedule.resolved) {
        masteredCompetencies.push(competency);
        continue;
      }
      resolved.push({ competency, levelId: schedule.currentLevelId!, subIdx: schedule.currentSubIdx || 0 });
    }
    return { resolved, masteredCompetencies };
  }

  // IST has no DST, so a fixed +5:30 offset is exact — no timezone library
  // needed. Returns the UTC instant corresponding to 00:00:00 IST on
  // (fromDate + intervalDays), so a schedule becomes "due" from the start of
  // its due day in IST, not at the exact time-of-day it was last graded.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  function nextDueDateIST(fromDate: Date, intervalDays: number): Date {
    const istNow = new Date(fromDate.getTime() + IST_OFFSET_MS);
    const istMidnightTarget = Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate() + intervalDays
    );
    return new Date(istMidnightTarget - IST_OFFSET_MS);
  }

  app.post('/api/practice/generate/:studentId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.TEACHER) {
      return res.status(403).json({ error: 'Only teachers can generate practice assignments.' });
    }

    const { competency } = req.body;
    if (!competency) return res.status(400).json({ error: 'competency is required.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const competencyLower = competency.toLowerCase();
    const isMatch = (q: Question) =>
      (q.topic || '').toLowerCase().includes(competencyLower) ||
      competencyLower.includes((q.topic || '').toLowerCase()) ||
      (q.subtopic || '').toLowerCase().includes(competencyLower);

    const pooled: Question[] = [];
    const seenTexts = new Set<string>();
    const startLevel = Math.max(1, student.currentLevel - 5);
    const endLevel = Math.min(59, student.currentLevel + 5);

    for (let lvl = startLevel; lvl <= endLevel && pooled.length < 15; lvl++) {
      for (let sub = 0; sub <= 2 && pooled.length < 15; sub++) {
        const levelQuestions = generateQuestionsForLevel(lvl, sub);
        for (const q of levelQuestions) {
          if (isMatch(q) && !seenTexts.has(q.question)) {
            pooled.push(q);
            seenTexts.add(q.question);
          }
        }
      }
    }

    const allQuestions = await dbStore.getQuestions();
    for (const q of allQuestions) {
      if (isMatch(q) && !seenTexts.has(q.question) && pooled.length < 15) {
        pooled.push(q);
        seenTexts.add(q.question);
      }
    }

    const matched = pooled.length > 0
      ? pooled
      : generateQuestionsForLevel(student.currentLevel, student.currentSubLevel || 0);

    const shuffled = [...matched].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, 5);
    if (selectedQuestions.length === 0) {
      return res.status(400).json({ error: 'No suitable questions found for this competency.' });
    }
    res.json({
      studentId: student.id,
      studentName: student.name,
      competency,
      questions: selectedQuestions
    });
  });

  // List practice items due today or overdue, scoped to the requesting
  // teacher's own students (schedule.teacherId).
  app.get('/api/practice/due', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const schedules = await dbStore.getPracticeSchedules();
    const now = new Date();

    let scoped = schedules;
    if (user.role === UserRole.TEACHER) {
      scoped = schedules.filter(s => s.teacherId === user.id);
    }
    // Admins/Superadmin see everything; other roles get nothing by default
    // (this feature is teacher-driven, matching the Intervention pattern).
    else if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN, UserRole.SCHOOL].includes(user.role)) {
      scoped = [];
    }

    let due = scoped.filter(s => !s.resolved && new Date(s.nextDueDate) <= now);
    if (due.length === 0) return res.json(due);

    // Exclude (studentId, competency) pairs that already have a pending,
    // ungraded uploaded paper covering that competency — generating a new
    // paper for it doesn't make sense while one is already awaiting grading.
    const relevantStudentIds = new Set(due.map(s => s.studentId));
    const uploadedPapers = await dbStore.getUploadedPapers();
    const pendingUploads = uploadedPapers.filter(p => p.gradingStatus === 'pending' && relevantStudentIds.has(p.studentId));

    if (pendingUploads.length > 0) {
      const papers = await dbStore.getMicroPracticePapersByIds(pendingUploads.map(p => p.paperId));
      const paperById = new Map(papers.map(p => [p.id, p]));

      const outstandingKeys = new Set<string>();
      for (const up of pendingUploads) {
        const paper = paperById.get(up.paperId);
        if (!paper) continue;
        const competencies = paper.parts?.length ? paper.parts.map(pt => pt.competency) : (paper.competency ? [paper.competency] : []);
        for (const comp of competencies) {
          if (!comp || up.gradedCompetencies.includes(comp)) continue;
          outstandingKeys.add(`${up.studentId}::${comp}`);
        }
      }

      due = due.filter(s => !outstandingKeys.has(`${s.studentId}::${s.competency}`));
    }

    res.json(due);
  });

  app.post('/api/practice/submit', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId, competency, questions, answers, paperId } = req.body;
    if (!studentId || !competency || !Array.isArray(questions) || !answers) {
      return res.status(400).json({ error: 'studentId, competency, questions, and answers are required.' });
    }

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Reject re-grading a competency that was already graded for this exact
    // paper — without this, resubmitting the same paperId+competency (e.g. a
    // duplicate upload graded twice, or a teacher hitting submit again) would
    // silently re-score and double-advance the student's PracticeSchedule
    // (subIdx/interval) a second time for work that was already counted.
    // Keyed on the specific competency, not overall gradingStatus, since a
    // multi-part paper is graded one competency at a time.
    if (paperId) {
      const existingUploadedPaper = await dbStore.getUploadedPaperByPaperId(paperId);
      if (existingUploadedPaper?.gradedCompetencies.includes(competency)) {
        return res.status(409).json({ error: `This competency (${competency}) has already been graded for this paper.` });
      }
    }

    // Find or create the schedule now, at actual submission time (a no-op
    // find in the normal flow, since generation already creates/backfills it
    // via the same helper — kept here too for paperless/legacy submissions
    // that never went through a generate call).
    let schedule: PracticeSchedule;
    try {
      schedule = await getOrInitPracticeSchedule(studentId, student.name, user.id, competency);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    // Grade the submitted answers against the questions passed back to us.
    let correctCount = 0;
    questions.forEach((q: Question) => {
      const submitted = (answers[q.question_id] || '').trim().toLowerCase();
      if (q.answer_type === 'visual-confirm') {
        if (submitted === 'yes') correctCount++;
        return;
      }
      const correct = q.answer.trim().toLowerCase();
      if (submitted === correct) correctCount++;
    });

    const now = new Date().toISOString();

    const assignment: MicroAssignment = {
      id: 'ma_' + randomUUID().slice(0, 8),
      scheduleId: schedule.id,
      studentId,
      studentName: student.name,
      competency,
      questions,
      assignedAt: now,
      completedAt: now,
      correctCount,
      totalCount: questions.length
    };
    await dbStore.addMicroAssignment(assignment);

    // Update the schedule's real-content position (levelId/subIdx), resolved
    // flag, and next due date together using the three-tier scoring logic.
    // schedule.currentLevelId is guaranteed set here — getOrInitPracticeSchedule
    // above never returns a schedule without one.
    const nextState = calculateNextScheduleState(
      schedule.intervalDays,
      schedule.currentLevelId!,
      schedule.currentSubIdx || 0,
      correctCount,
      questions.length
    );
    const nextDue = nextDueDateIST(new Date(), nextState.intervalDays);
    await dbStore.updatePracticeSchedule(schedule.id, {
      intervalDays: nextState.intervalDays,
      currentLevelId: nextState.levelId,
      currentSubIdx: nextState.subIdx,
      resolved: nextState.resolved,
      nextDueDate: nextDue.toISOString(),
      lastCompletedAt: now
    });

    // If this submission is tied to an uploaded paper (paperId supplied),
    // record this competency as graded and only flip the paper's overall
    // gradingStatus to 'graded' once every part has been submitted —
    // a 3-competency paper shouldn't drop off the pending list after just
    // one of its parts is done.
    if (paperId) {
      const uploadedPaper = await dbStore.getUploadedPaperByPaperId(paperId);
      if (uploadedPaper && uploadedPaper.gradingStatus !== 'graded') {
        const gradedCompetencies = uploadedPaper.gradedCompetencies.includes(competency)
          ? uploadedPaper.gradedCompetencies
          : [...uploadedPaper.gradedCompetencies, competency];
        const isFullyGraded = gradedCompetencies.length >= uploadedPaper.totalParts;
        await dbStore.updateUploadedPaper(uploadedPaper.id, {
          gradedCompetencies,
          ...(isFullyGraded ? { gradingStatus: 'graded' as const, gradedAt: now } : {})
        });
      }
    }

    res.json({
      success: true,
      correctCount,
      totalCount: questions.length,
      scorePercent: Math.round((correctCount / questions.length) * 100)
    });
  });

  // Papers that have been photographed/uploaded but not yet fully graded
  // (see UploadedPaper in db.ts). Scoped the same way as /api/practice/due:
  // teachers see their own uploads, admin-tier roles see everything, other
  // roles get nothing since this feature is teacher-driven.
  app.get('/api/practice/pending-papers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const uploadedPapers = await dbStore.getUploadedPapers();

    let scoped = uploadedPapers;
    if (user.role === UserRole.TEACHER) {
      scoped = uploadedPapers.filter(p => p.teacherId === user.id);
    } else if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN, UserRole.SCHOOL].includes(user.role)) {
      scoped = [];
    }

    const pending = scoped.filter(p => p.gradingStatus === 'pending');
    res.json(pending);
  });

  // Overview of all practiced competencies per student, independent of due
  // status. Groups completed micro-assignments by (studentId, competency) and
  // returns the latest score + attempt count for each — this powers the
  // "Student Progress" section, separate from the due-today scheduling list.
  app.get('/api/practice/progress', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const assignments = await dbStore.getMicroAssignments();
    const completed = assignments.filter(a => a.completedAt);

    // Scope to the teacher's own students where relevant, matching the
    // existing pattern used for /api/practice/due.
    const schedules = await dbStore.getPracticeSchedules();
    let scopedScheduleIds: Set<string> | null = null;
    if (user.role === UserRole.TEACHER) {
      scopedScheduleIds = new Set(schedules.filter(s => s.teacherId === user.id).map(s => s.id));
    }

    const scopedCompleted = scopedScheduleIds
      ? completed.filter(a => scopedScheduleIds!.has(a.scheduleId))
      : completed;

    // Group by studentId -> competency -> list of attempts (chronological)
    const grouped: Record<string, Record<string, any[]>> = {};
    for (const a of scopedCompleted) {
      if (!grouped[a.studentId]) grouped[a.studentId] = {};
      if (!grouped[a.studentId][a.competency]) grouped[a.studentId][a.competency] = [];
      grouped[a.studentId][a.competency].push({
        id: a.id,
        completedAt: a.completedAt,
        correctCount: a.correctCount || 0,
        totalCount: a.totalCount,
        scorePercent: a.totalCount > 0 ? Math.round(((a.correctCount || 0) / a.totalCount) * 100) : 0
      });
    }

    // Build the response: one entry per student, with a list of competencies,
    // each showing its latest score and total attempt count.
    const result = Object.entries(grouped).map(([studentId, competencies]) => {
      const studentName = scopedCompleted.find(a => a.studentId === studentId)?.studentName || 'Unknown';
      const competencyList = Object.entries(competencies).map(([competency, attempts]) => {
        const sorted = [...attempts].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
        const latest = sorted[sorted.length - 1];
        return {
          competency,
          latestScorePercent: latest.scorePercent,
          attemptCount: sorted.length,
          lastPracticedAt: latest.completedAt
        };
      });
      return { studentId, studentName, competencies: competencyList };
    });

    res.json(result);
  });

  // Mastery-over-time trend for a specific student+competency — shows how
  // scores on repeated micro-practice sets have changed, giving a genuine
  // "is this actually improving" signal beyond a single snapshot.
  app.get('/api/practice/history/:studentId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { competency } = req.query;
    const assignments = await dbStore.getMicroAssignments();

    let history = assignments.filter(a => a.studentId === req.params.studentId && a.completedAt);
    if (competency && typeof competency === 'string') {
      history = history.filter(a => a.competency === competency);
    }

    history.sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

    res.json(history.map(a => ({
      id: a.id,
      competency: a.competency,
      completedAt: a.completedAt,
      correctCount: a.correctCount,
      totalCount: a.totalCount,
      scorePercent: a.totalCount > 0 ? Math.round(((a.correctCount || 0) / a.totalCount) * 100) : 0
    })));
  });

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
