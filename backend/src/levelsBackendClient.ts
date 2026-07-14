/**
 * levelsBackendClient.ts
 *
 * Thin HTTP client for the standalone "Levels_backend" service
 * (Express + Puppeteer, batch-generates worksheets/answer-keys/coords by
 * driving app/index.html headlessly). This backend does not reimplement
 * any worksheet-generation logic — it only calls the three endpoints that
 * service exposes and unpacks the ZIP it returns.
 *
 * Configure the target with LEVELS_BACKEND_URL (defaults to
 * http://127.0.0.1:4000, matching that service's own default PORT).
 */

import JSZip from 'jszip';

// Use IPv4 explicitly. On Windows, `localhost` may resolve to IPv6 (`::1`)
// first while the standalone renderer listens only on IPv4, causing undici's
// fetch to fail before a batch request reaches the service.
const LEVELS_BACKEND_URL = (process.env.LEVELS_BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');

export interface RosterEntry {
  studentName: string;
  rollNumber: string;
  levelId: number;
  /** 'all' (default), or a specific sublevel id like "26.0" */
  sublevelId?: string;
  setsPerSub?: number;
  /** Non-sensitive child/placement details embedded in the worksheet QR. */
  studentData?: Record<string, unknown>;
}

export interface GenerateBatchResult {
  batchId: string;
  studentsProcessed: number;
  totalFiles: number;
  errors: Array<{ job?: any; error: string }>;
}

export interface BatchStatus {
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed' | string;
  processed: number;
  total: number;
  message: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

/** POST /api/generate-batch — kicks off rendering for a whole roster. */
export async function generateBatch(roster: RosterEntry[]): Promise<GenerateBatchResult> {
  const res = await fetch(`${LEVELS_BACKEND_URL}/api/generate-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roster)
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `levels-backend generate-batch failed (HTTP ${res.status})`);
  }
  return data as GenerateBatchResult;
}

/** GET /api/batch-status/:batchId */
export async function getBatchStatus(batchId: string): Promise<BatchStatus | null> {
  const res = await fetch(`${LEVELS_BACKEND_URL}/api/batch-status/${encodeURIComponent(batchId)}`);
  if (res.status === 404) return null;
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `levels-backend batch-status failed (HTTP ${res.status})`);
  }
  return data as BatchStatus;
}

/**
 * Polls GET /api/batch-status/:batchId until it reports completed /
 * completed_with_errors (or fails / times out). generate-batch itself
 * already runs synchronously to completion server-side, so in practice
 * this resolves on the first poll — but polling keeps us correct if that
 * service is ever switched to fire-and-poll.
 */
export async function waitForBatch(
  batchId: string,
  { intervalMs = 2000, timeoutMs = 10 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<BatchStatus> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getBatchStatus(batchId);
    if (status && (status.status === 'completed' || status.status === 'completed_with_errors')) {
      return status;
    }
    if (status && status.status === 'failed') {
      throw new Error(status.message || status.error || 'Batch generation failed.');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for levels-backend batch ${batchId} to complete.`);
}

/** GET /api/download-batch/:batchId — raw ZIP bytes. */
export async function downloadBatchZip(batchId: string): Promise<Buffer> {
  const res = await fetch(`${LEVELS_BACKEND_URL}/api/download-batch/${encodeURIComponent(batchId)}`);
  if (!res.ok) {
    let msg = `levels-backend download-batch failed (HTTP ${res.status})`;
    try {
      const data: any = await res.json();
      msg = data.error || msg;
    } catch {
      /* body wasn't JSON (it's a zip on success) */
    }
    throw new Error(msg);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export interface ExtractedFile {
  /** e.g. "RollNo-12_John_Doe" */
  studentFolder: string;
  sublevelId: string;
  setNum: number;
  pdfBuffer: Buffer;
  answerKey: any;
  coords: any;
}

export interface ExtractedBatch {
  manifest: any;
  files: ExtractedFile[];
}

/**
 * Unpacks a batch ZIP (storage/{batchId}/{studentFolder}/{sublevelId}_set{n}/
 * {worksheet.pdf, answer_key.json, coords.json} + a top-level manifest.json)
 * into structured records, grouped by student x sublevel x set.
 */
export async function extractBatchZip(zipBuffer: Buffer): Promise<ExtractedBatch> {
  const zip = await JSZip.loadAsync(zipBuffer);

  const manifestEntry = zip.file('manifest.json');
  const manifest = manifestEntry ? JSON.parse(await manifestEntry.async('string')) : null;

  const groups = new Map<string, { pdf?: Buffer; answerKey?: any; coords?: any }>();

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const relPath = entry.name; // "RollNo-12_John_Doe/26.0_set1/worksheet.pdf"
    const parts = relPath.split('/');
    if (parts.length < 3) continue; // skip manifest.json / stray top-level files

    const groupKey = parts.slice(0, 2).join('/');
    const filename = parts[parts.length - 1];
    if (!groups.has(groupKey)) groups.set(groupKey, {});
    const g = groups.get(groupKey)!;

    if (filename === 'worksheet.pdf') {
      g.pdf = await entry.async('nodebuffer');
    } else if (filename === 'answer_key.json') {
      g.answerKey = JSON.parse(await entry.async('string'));
    } else if (filename === 'coords.json') {
      g.coords = JSON.parse(await entry.async('string'));
    }
  }

  const files: ExtractedFile[] = [];
  for (const [groupKey, g] of groups) {
    if (!g.pdf) continue; // incomplete group, skip
    const [studentFolder, subFolder] = groupKey.split('/');
    const m = subFolder.match(/^(.+)_set(\d+)$/);
    const sublevelId = m ? m[1] : subFolder;
    const setNum = m ? parseInt(m[2], 10) : 1;
    files.push({ studentFolder, sublevelId, setNum, pdfBuffer: g.pdf, answerKey: g.answerKey, coords: g.coords });
  }

  return { manifest, files };
}
