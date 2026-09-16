/**
 * In-flight vault transaction counter — unit test (Phase 6).
 *
 * Run:  npx tsx --test backend/src/modules/vault/tests/transaction-counter.test.ts
 *
 * The counter is the shutdown sequence's only line of defence
 * against a SIGTERM mid-transaction. A regression here would
 * silently orphan a multi-document vault write, so the test
 * covers the surface that matters:
 *
 *   - acquire/release pairing: count tracks active transactions
 *     exactly.
 *   - getActiveCount: synchronous read, matches acquire/release
 *     state.
 *   - waitForDrain: returns true when count is already zero
 *     (fast path).
 *   - waitForDrain: resolves when the last release fires after
 *     the wait is registered.
 *   - waitForDrain: times out when transactions are still in
 *     flight past the deadline.
 *   - FIFO waiter resolution: multiple concurrent waitForDrain
 *     calls all resolve when the count drops to zero.
 *   - Defensive release without acquire: surfaces a warning,
 *     does not drive the count negative.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  acquire,
  release,
  getActiveCount,
  waitForDrain,
} from '../infrastructure/db/vault-transaction-counter';

// Each test should start with a clean counter. The test file is
// process-local, so any leaked state from one test would poison
// the next. The drain-counter module is also a global; reset it
// after each test by releasing any count that survived.
afterEach(() => {
  while (getActiveCount() > 0) release();
  assert.equal(getActiveCount(), 0, 'counter must be zero after teardown');
});

test('counter: acquire/release tracks the active count exactly', () => {
  assert.equal(getActiveCount(), 0);

  acquire();
  assert.equal(getActiveCount(), 1);

  acquire();
  acquire();
  assert.equal(getActiveCount(), 3);

  release();
  assert.equal(getActiveCount(), 2);

  release();
  release();
  assert.equal(getActiveCount(), 0);
});

test('counter: getActiveCount is synchronous', () => {
  acquire();
  acquire();
  // No await — must be a synchronous read.
  const count = getActiveCount();
  assert.equal(count, 2);
});

test('drain: returns true immediately when no transactions are in flight', async () => {
  const t0 = Date.now();
  const drained = await waitForDrain(1000);
  const elapsed = Date.now() - t0;
  assert.equal(drained, true);
  // Fast path — no polling, no setInterval. A 1s budget is more
  // than enough; a 100ms guard catches a regression that
  // accidentally re-introduces a polling delay.
  assert.ok(elapsed < 100, `expected fast-path drain, took ${elapsed}ms`);
});

test('drain: resolves when the last release fires after wait is registered', async () => {
  acquire();
  acquire();
  assert.equal(getActiveCount(), 2);

  // Schedule a release in 50ms — between the waitForDrain
  // registration and the polling fallback.
  setTimeout(() => release(), 50);
  setTimeout(() => release(), 60);

  const drained = await waitForDrain(2000);
  assert.equal(drained, true);
  assert.equal(getActiveCount(), 0);
});

test('drain: times out when transactions remain in flight past the deadline', async () => {
  acquire();
  // Never release. The drain must time out and return false.
  const t0 = Date.now();
  const drained = await waitForDrain(150);
  const elapsed = Date.now() - t0;
  assert.equal(drained, false);
  // Polling interval is 50ms; 150ms budget gives 2-3 polls
  // before deadline. Allow a small margin.
  assert.ok(elapsed >= 100, `expected drain to wait at least one poll, took ${elapsed}ms`);
  assert.ok(elapsed < 1000, `expected drain to honor the 150ms budget, took ${elapsed}ms`);
});

test('drain: FIFO resolution — multiple concurrent waiters all wake when count hits zero', async () => {
  acquire();
  acquire();
  acquire();

  const w1 = waitForDrain(2000);
  const w2 = waitForDrain(2000);
  const w3 = waitForDrain(2000);

  // Release in a tight burst — all three waiters should resolve.
  release();
  release();
  release();

  const [r1, r2, r3] = await Promise.all([w1, w2, w3]);
  assert.equal(r1, true);
  assert.equal(r2, true);
  assert.equal(r3, true);
});

test('counter: defensive release without acquire logs a warning and does not go negative', async () => {
  // Capture console.warn so the test does not spam test output.
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => { warnings.push(msg); };
  try {
    release();
  } finally {
    console.warn = original;
  }
  assert.equal(getActiveCount(), 0, 'counter must not go negative');
  assert.ok(
    warnings.some(w => w.includes('release() called with no outstanding acquire')),
    'must surface a warning so a future test can flag a regression',
  );
});

test('counter: simulate the production shape — many acquires, sequential releases, single drain', async () => {
  // Mimic the real boot path: a burst of acquires (concurrent
  // tokenize requests) followed by a graceful shutdown. The
  // drain must wait for the slowest release.
  for (let i = 0; i < 10; i++) acquire();
  assert.equal(getActiveCount(), 10);

  // Release 9 of them immediately, then the last one after a
  // short delay.
  for (let i = 0; i < 9; i++) release();
  assert.equal(getActiveCount(), 1);

  const drainPromise = waitForDrain(2000);
  setTimeout(() => release(), 30);
  const drained = await drainPromise;
  assert.equal(drained, true);
  assert.equal(getActiveCount(), 0);
});
