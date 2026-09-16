/**
 * In-flight vault transaction counter (Phase 6 — graceful shutdown).
 *
 * Tracks the number of vault writes that are currently inside a
 * `session.withTransaction(...)` block so the server's shutdown
 * sequence can wait for them to complete before closing the Mongo
 * client.
 *
 * Why a dedicated counter (and not just `server.close()`):
 *
 *   `server.close()` already waits for in-flight HTTP requests to
 *   finish, and every vault write is awaited inside an HTTP handler,
 *   so in practice server.close() is sufficient. The dedicated
 *   counter is the *defensive* surface: a future refactor that moves
 *   a vault write out of an HTTP request scope (e.g. a background
 *   reconciliation job, a webhook handler, a queue consumer) would
 *   silently orphan a `withTransaction` past the server.close()
 *   callback. The counter makes the invariant explicit and the
 *   shutdown sequence enforces it.
 *
 * The counter is process-local. There is one Node process per
 * backend instance; horizontal scaling does not change the model
 * because each instance drains its own in-flight writes.
 *
 * The counter is intentionally separate from any other observability
 * counter so it can be folded into a future metrics pipeline without
 * a refactor.
 */

// ---------------------------------------------------------------------------
// Internal counter state
// ---------------------------------------------------------------------------

/** Current number of vault transactions inside a `withTransaction` block. */
let activeCount = 0;

/** Resolvers for `waitForDrain` — woken (in insertion order) when the
 *  counter drops to zero. */
const drainWaiters: Array<() => void> = [];

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Increment the active-transaction count. Callers MUST pair this
 *  with a {@link release} in the same scope, typically a `finally`. */
export function acquire(): void {
  activeCount += 1;
}

/** Decrement the active-transaction count. If the count drops to zero
 *  and any drain waiters are registered, they are all resolved (in
 *  FIFO order) on the next microtask. */
export function release(): void {
  if (activeCount <= 0) {
    // Defensive: a logic error in the caller (release without
    // acquire, or a double-release). Don't go negative; surface
    // it so a future test can flag the regression.
    console.warn(
      '[vault] vault-transaction-counter: release() called with no outstanding acquire().',
    );
    return;
  }
  activeCount -= 1;
  if (activeCount === 0) {
    // Resolve waiters in FIFO order. Copy to a local so the
    // consumer side can re-register without mutating during
    // iteration.
    const waiters = drainWaiters.splice(0, drainWaiters.length);
    for (const resolve of waiters) {
      resolve();
    }
  }
}

/** Current number of in-flight vault transactions. For tests +
 *  the shutdown sequence. */
export function getActiveCount(): number {
  return activeCount;
}

/**
 * Wait until the active-transaction count reaches zero, or the
 * timeout elapses — whichever happens first. Resolves with `true`
 * if drained, `false` on timeout.
 *
 * Designed for the shutdown sequence. The implementation polls the
 * counter rather than waiting on a single long-lived promise so a
 * racing `acquire()` (a request that snuck in after the count hit
 * zero but before the shutdown handler's `server.close()` callback
 * fired) gets a chance to bump the counter and re-arm the wait.
 *
 * The polling interval is small (50ms) so the shutdown handler is
 * responsive; the timeout (caller-supplied, default 30s) bounds
 * the wait so a stuck transaction cannot wedge the process.
 */
export async function waitForDrain(timeoutMs: number = 30_000): Promise<boolean> {
  if (activeCount === 0) return true;
  const deadline = Date.now() + timeoutMs;
  return new Promise<boolean>(resolve => {
    let settled = false;
    const tryResolve = (drained: boolean) => {
      if (settled) return;
      settled = true;
      // Remove the waiter if it is still registered.
      const idx = drainWaiters.indexOf(onDrain);
      if (idx >= 0) drainWaiters.splice(idx, 1);
      resolve(drained);
    };
    const onDrain = () => tryResolve(true);
    drainWaiters.push(onDrain);
    // Polling fallback: every 50ms, check the count. If a
    // racing `acquire()` bumps the count up after we observed
    // zero, the drain promise still wakes via onDrain when the
    // subsequent release drops it back to zero.
    const interval = setInterval(() => {
      if (activeCount === 0) {
        clearInterval(interval);
        tryResolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(interval);
        tryResolve(false);
      }
    }, 50);
  });
}
