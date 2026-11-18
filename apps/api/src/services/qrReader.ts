import { Worker } from 'node:worker_threads';
import { readQrFromImage } from '@fln/domain';

/** Reads the text of the QR code in a photo (JPEG or PNG): null when there is none or the photo cannot be read. */
export type ReadQr = (image: Buffer) => Promise<string | null>;

/** In the thread that is serving requests. Simple, but a large photo holds every other request for its 0.2 to 1 second; used in tests and as the fallback. */
export const readQrInThread: ReadQr = async image => readQrFromImage(image);

export interface QrWorker { read: ReadQr; close(): Promise<void> }
export interface QrWorkerOptions {
  /** The worker script. */
  file: URL;
  /** Extra Node options for the worker, such as `--import tsx` when it runs from TypeScript. */
  execArgv?: string[];
  /** A photo that takes longer than this is read in the main thread instead, and the worker is replaced. */
  timeoutMs?: number;
}

/**
 * Where the worker script is: next to the bundle in a release (`qrWorker.mjs`), or the TypeScript source when running from source.
 * `import.meta.url` is the bundle's own file once the API is bundled into one file.
 */
export function defaultQrWorkerOptions(): QrWorkerOptions {
  const fromSource = import.meta.url.endsWith('.ts');
  return fromSource
    ? { file: new URL('../qrWorker.ts', import.meta.url), execArgv: ['--import', 'tsx'] }
    : { file: new URL('./qrWorker.mjs', import.meta.url) };
}

/**
 * A reader that decodes in one worker thread, one photo at a time, so serving requests never waits for a photo.
 * If the worker cannot start, dies, or is too slow, that photo is read in the main thread and the worker is replaced: a scan always gets an answer.
 */
export function createQrWorker(options: QrWorkerOptions): QrWorker {
  const timeoutMs = options.timeoutMs ?? 20_000;
  let worker: Worker | null = null;
  let nextId = 1;
  let closed = false;
  const waiting = new Map<number, { image: Buffer; resolve: (t: string | null) => void; timer: NodeJS.Timeout }>();

  const failAll = () => {
    // Every photo that was waiting on this worker is read here instead.
    for (const [id, job] of [...waiting]) {
      waiting.delete(id); clearTimeout(job.timer);
      job.resolve(readQrFromImage(job.image));
    }
  };
  const start = (): Worker | null => {
    try {
      const w = new Worker(options.file, { execArgv: options.execArgv });
      w.on('message', (m: { id: number; text: string | null }) => {
        const job = waiting.get(m.id);
        if (!job) return;
        waiting.delete(m.id); clearTimeout(job.timer); job.resolve(m.text);
      });
      const gone = (err?: Error) => {
        if (worker === w) worker = null;
        if (!closed && err) console.warn(`QR worker stopped (${err.message}); reading in the main thread until it is replaced.`);
        failAll();
      };
      w.on('error', gone);
      w.on('exit', () => gone());
      w.unref();
      return w;
    } catch (err) {
      console.warn(`QR worker could not start (${err instanceof Error ? err.message : err}); reading in the main thread.`);
      return null;
    }
  };

  return {
    read(image) {
      if (closed) return Promise.reject(new Error('The QR reader is closed.'));
      worker ??= start();
      if (!worker) return Promise.resolve(readQrFromImage(image));
      const w = worker;
      return new Promise<string | null>(resolve => {
        const id = nextId++;
        const timer = setTimeout(() => {
          waiting.delete(id);
          if (worker === w) worker = null;
          void w.terminate();
          failAll();
          resolve(readQrFromImage(image));
        }, timeoutMs);
        waiting.set(id, { image, resolve, timer });
        // The photo is copied to the worker, so this thread's copy stays usable if the worker fails.
        const copy = new Uint8Array(image.byteLength); copy.set(image);
        w.postMessage({ id, image: copy }, [copy.buffer]);
      });
    },
    async close() {
      closed = true;
      const w = worker; worker = null;
      failAll();
      if (w) await w.terminate();
    },
  };
}
