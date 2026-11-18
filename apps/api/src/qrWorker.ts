// Runs in a worker thread: reads the QR code of one photo at a time, off the thread that serves requests (#904).
import { parentPort } from 'node:worker_threads';
import { readQrFromImage } from '@fln/domain';

interface Job { id: number; image: Uint8Array }

parentPort?.on('message', (job: Job) => {
  let text: string | null = null;
  try { text = readQrFromImage(Buffer.from(job.image.buffer, job.image.byteOffset, job.image.byteLength)); } catch { /* an unreadable photo has no code */ }
  parentPort?.postMessage({ id: job.id, text });
});
