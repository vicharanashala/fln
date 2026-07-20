/**
 * Adaptive Engine — Engine Selection / Factory
 *
 * Today this picks the deterministic engine unconditionally. When an
 * LLM-backed engine is added later, this factory is the single place
 * to choose between them (e.g. based on GEMINI_API_KEY presence, A/B
 * flag, or per-tenant config). The rest of the system depends only on
 * the AdaptiveEngine interface.
 */

import type { AdaptiveEngine } from './types';
import { DeterministicAdaptiveEngine } from './deterministic';

let cachedEngine: AdaptiveEngine | null = null;

/**
 * Resolve the active adaptive engine.
 *
 * Selection rule (current): always deterministic. The fallback is
 * robust — even when an LLM is wired in later, missing config / errors
 * must collapse back to the deterministic engine rather than failing the
 * request.
 */
export function getAdaptiveEngine(): AdaptiveEngine {
  if (cachedEngine) return cachedEngine;
  // Future hook:
  //   if (shouldUseLLM()) cachedEngine = new HybridAdaptiveEngine(...)
  //   else cachedEngine = new DeterministicAdaptiveEngine();
  cachedEngine = new DeterministicAdaptiveEngine();
  return cachedEngine;
}

/**
 * For tests / future hot-swap. Not used by request handlers today.
 */
export function resetAdaptiveEngine(): void {
  cachedEngine = null;
}
