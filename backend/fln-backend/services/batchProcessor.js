/**
 * services/batchProcessor.js
 *
 * Orchestrates a whole-class generation run:
 *   roster entries  x  resolved sublevels (per entry's levelId)  x  setsPerSub
 *
 * Uses a small pool of Puppeteer pages (default 4, override with
 * RENDER_CONCURRENCY env var) so a class of 30+ students doesn't render
 * one worksheet at a time, while keeping memory/CPU bounded.
 *
 * Batch progress is tracked in-memory (batchStatus map) so
 * GET /api/batch-status/:batchId can report {status, processed, total,
 * message} — mirroring the setStatus()-style progress messages already
 * used by the original client.
 */

const crypto = require('crypto');
const {
  createRenderPage,
  resolveSublevels,
  renderStudentSet
} = require('./renderWorksheet');
const {
  studentFolderName,
  saveStudentSet,
  saveManifest
} = require('./storage');

// Native PDF generation is memory-heavy and can fail intermittently when
// several Chromium pages render at once. Keep the default reliable; operators
// can opt into higher parallelism explicitly with RENDER_CONCURRENCY.
const CONCURRENCY = Math.max(1, parseInt(process.env.RENDER_CONCURRENCY || '1', 10));
const MAX_RENDER_ATTEMPTS = Math.max(1, parseInt(process.env.RENDER_MAX_ATTEMPTS || '3', 10));
const RENDER_TIMEOUT_MS = Math.max(10_000, parseInt(process.env.RENDER_TIMEOUT_MS || '60_000', 10));

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** batchId -> {status, processed, total, message, startedAt, finishedAt, error} */
const batchStatus = new Map();

function newBatchId() {
  return crypto.randomBytes(6).toString('hex');
}

function updateStatus(batchId, patch) {
  const current = batchStatus.get(batchId) || {};
  batchStatus.set(batchId, { ...current, ...patch });
}

function getBatchStatus(batchId) {
  return batchStatus.get(batchId) || null;
}

function createBatch() {
  const batchId = newBatchId();
  updateStatus(batchId, {
    status: 'running',
    processed: 0,
    total: 0,
    message: 'Queued for rendering...',
    startedAt: new Date().toISOString()
  });
  return batchId;
}

function failBatch(batchId, error) {
  updateStatus(batchId, {
    status: 'failed',
    message: error.message || 'Batch generation failed.',
    error: error.message || String(error),
    finishedAt: new Date().toISOString()
  });
}

/** Simple fixed-size worker pool over an async task queue. */
async function runPool(tasks, worker, concurrency) {
  let cursor = 0;
  async function next(workerIndex) {
    while (cursor < tasks.length) {
      const idx = cursor++;
      await worker(tasks[idx], idx, workerIndex);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    (_, workerIndex) => next(workerIndex)
  );
  await Promise.all(workers);
}

/**
 * roster: [{ studentName, rollNumber, levelId, sublevelId?, setsPerSub? }]
 */
async function processBatch(roster, existingBatchId) {
  const batchId = existingBatchId || createBatch();
  updateStatus(batchId, {
    status: 'running',
    processed: 0,
    total: 0,
    message: 'Resolving sublevels...',
    startedAt: new Date().toISOString()
  });

  // One page is enough to resolve sublevels for the whole roster up front.
  const resolverPage = await createRenderPage();

  // Build the flat list of render jobs: one per student x sublevel x set.
  const jobs = [];
  const manifestStudents = [];

  try {
    for (const entry of roster) {
      const { studentName, rollNumber, levelId, sublevelId, setsPerSub, studentData } = entry;
      const setsCount = Math.max(1, parseInt(setsPerSub || 1, 10));
      const resolved = await resolveSublevels(resolverPage, Number(levelId), sublevelId || 'all');

      if (!resolved) {
        manifestStudents.push({
          studentName, rollNumber, levelId, error: `Unknown levelId ${levelId}`, files: []
        });
        continue;
      }

      const folder = studentFolderName(rollNumber, studentName);
      const studentFiles = [];

      resolved.sublevelIds.forEach((subLevelId, i) => {
        const subIdx = resolved.subIdxs[i];
        for (let setNum = 1; setNum <= setsCount; setNum++) {
          jobs.push({
            studentName, rollNumber, studentData, folder,
            levelId: Number(levelId), levelTitle: resolved.levelTitle, slug: resolved.slug,
            subIdx, sublevelId: subLevelId, setNum
          });
          studentFiles.push({ sublevelId: subLevelId, setNum, folder: `${folder}/${subLevelId}_set${setNum}` });
        }
      });

      manifestStudents.push({
        studentName, rollNumber, levelId: Number(levelId), levelTitle: resolved.levelTitle,
        sublevels: resolved.sublevelIds, files: studentFiles
      });
    }
  } finally {
    await resolverPage.close();
  }

  updateStatus(batchId, { total: jobs.length, message: `Rendering ${jobs.length} file(s)...` });

  // Render pool: each worker owns its own page for the whole run.
  const pages = await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, Math.max(1, jobs.length)) }, () => createRenderPage())
  );

  let processed = 0;
  const errors = [];

  try {
    await runPool(
      jobs,
      async (job, _jobIndex, workerIndex) => {
        // Each worker exclusively owns one page. Sharing a page makes
        // page.evaluate calls queue and defeats concurrent rendering.
        let page = pages[workerIndex];
        let lastError;
        for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt += 1) {
          try {
            const rendered = await withTimeout(renderStudentSet(page, job.levelId, job.subIdx, job.setNum, {
              studentName: job.studentName,
              studentId: job.rollNumber,
              ...job.studentData
            }), RENDER_TIMEOUT_MS, `Render timed out after ${RENDER_TIMEOUT_MS}ms`);
            await saveStudentSet(batchId, job.folder, job.sublevelId, job.setNum, rendered);
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            console.error(`[batchProcessor] failed job attempt ${attempt}/${MAX_RENDER_ATTEMPTS}`, job, err);
            await page.close().catch(() => {});
            if (attempt < MAX_RENDER_ATTEMPTS) {
              page = await createRenderPage();
              pages[workerIndex] = page;
              await new Promise(resolve => setTimeout(resolve, 250 * attempt));
            }
          }
        }
        if (lastError) {
          errors.push({ job: { ...job }, error: lastError.message });
        }
        processed++;
        updateStatus(batchId, {
          processed,
          message: `Rendered ${processed}/${jobs.length} (${job.studentName} — ${job.sublevelId} set ${job.setNum})`
        });
      },
      CONCURRENCY
    );
  } finally {
    await Promise.all(pages.map((p) => p.close()));
  }

  const manifest = {
    batchId,
    generatedAt: new Date().toISOString(),
    studentCount: manifestStudents.length,
    totalFiles: jobs.length,
    errors,
    students: manifestStudents
  };
  await saveManifest(batchId, manifest);

  updateStatus(batchId, {
    status: errors.length ? 'completed_with_errors' : 'completed',
    processed,
    total: jobs.length,
    message: errors.length
      ? `Done with ${errors.length} error(s) out of ${jobs.length} file(s).`
      : `Done — ${jobs.length} file(s) generated.`,
    finishedAt: new Date().toISOString()
  });

  return {
    batchId,
    studentsProcessed: manifestStudents.length,
    totalFiles: jobs.length,
    errors
  };
}

module.exports = {
  createBatch,
  failBatch,
  processBatch,
  getBatchStatus
};
