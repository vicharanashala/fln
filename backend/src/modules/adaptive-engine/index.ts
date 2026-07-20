/**
 * Adaptive Engine — Public API
 *
 * Other parts of the backend (route handlers, future services) should
 * import from here, not from the individual files. This keeps the
 * module's surface area stable while internals can be refactored.
 */

export * from './types';
export { getAdaptiveEngine, resetAdaptiveEngine } from './engine';
export { DeterministicAdaptiveEngine } from './deterministic';
export { analyzeStudent } from './analyzer';
export {
  analyzeStudentForWorksheet,
  generateAdaptiveWorksheet
} from './generator';