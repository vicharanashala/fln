import { HttpError } from '../http';

/**
 * Lets only `concurrent` jobs run at once and keeps at most `queue` waiting; anything beyond that is refused at
 * once instead of piling up. Used around the photo reader, which costs real time and quota per call.
 */
export function createLimiter(options: { concurrent: number; queue: number }) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    running--;
    waiting.shift()?.();
  };
  return async function run<T>(job: () => Promise<T>): Promise<T> {
    if (running >= options.concurrent) {
      if (waiting.length >= options.queue) throw new HttpError(503, 'Many photos are being read right now. Please wait a minute, or mark this paper by hand.');
      await new Promise<void>(resolve => waiting.push(resolve));
    }
    running++;
    try { return await job(); } finally { release(); }
  };
}
